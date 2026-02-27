from __future__ import annotations

import re
import time
from datetime import datetime
from pathlib import Path
from typing import Callable
from urllib.parse import quote

import requests


class ProviderService:
    def __init__(
        self,
        *,
        clash_api: str,
        clash_headers: Callable[[], dict],
        provider_recovery_file: Path,
        provider_auto_refresh_enabled: bool,
        provider_recovery_check_interval: int,
        provider_zero_alive_minutes: int,
        provider_auto_refresh_max_per_day: int,
        load_json: Callable[[Path, object], object],
        save_json: Callable[[Path, object], None],
        emit_log: Callable[..., None],
        provider_recovery_lock,
    ) -> None:
        self.clash_api = clash_api
        self.clash_headers = clash_headers
        self.provider_recovery_file = provider_recovery_file
        self.provider_auto_refresh_enabled = provider_auto_refresh_enabled
        self.provider_recovery_check_interval = provider_recovery_check_interval
        self.provider_zero_alive_minutes = provider_zero_alive_minutes
        self.provider_auto_refresh_max_per_day = provider_auto_refresh_max_per_day
        self.load_json = load_json
        self.save_json = save_json
        self.emit_log = emit_log
        self.provider_recovery_lock = provider_recovery_lock

    def normalize_provider_name(self, raw: str, fallback: str = "Sub") -> str:
        base = str(raw or fallback).strip() or fallback
        return re.sub(r"[^A-Za-z0-9_-]", "_", base)

    def default_provider_recovery_state(self) -> dict:
        return {"providers": {}}

    def sanitize_provider_recovery_state(self, data: dict) -> dict:
        rows = data.get("providers", {}) if isinstance(data, dict) else {}
        if not isinstance(rows, dict):
            rows = {}

        providers: dict[str, dict] = {}
        for raw_name, raw_item in rows.items():
            name = str(raw_name or "").strip()
            if not name:
                continue
            item = raw_item if isinstance(raw_item, dict) else {}

            zero_since = str(item.get("zero_since") or "").strip() or None
            last_checked = str(item.get("last_checked") or "").strip() or None
            daily_date = str(item.get("daily_date") or "").strip()

            try:
                daily_updates = int(item.get("daily_updates", 0))
            except Exception:
                daily_updates = 0
            daily_updates = max(0, daily_updates)

            providers[name] = {
                "zero_since": zero_since,
                "last_checked": last_checked,
                "daily_date": daily_date,
                "daily_updates": daily_updates,
            }

        return {"providers": providers}

    def load_provider_recovery_state(self) -> dict:
        raw = self.load_json(self.provider_recovery_file, self.default_provider_recovery_state())
        if not isinstance(raw, dict):
            raw = {}
        return self.sanitize_provider_recovery_state(raw)

    def save_provider_recovery_state(self, data: dict) -> None:
        payload = self.sanitize_provider_recovery_state(data)
        self.save_json(self.provider_recovery_file, payload)

    def build_provider_rows(self, payload) -> list[dict]:
        raw_providers = payload.get("providers", {}) if isinstance(payload, dict) else {}
        if not isinstance(raw_providers, dict):
            raw_providers = {}

        rows: list[dict] = []
        for provider_name, item in raw_providers.items():
            if not isinstance(item, dict):
                continue

            proxies = item.get("proxies", [])
            proxy_count = 0
            alive_count = 0
            if isinstance(proxies, list):
                proxy_count = len(proxies)
                alive_count = sum(
                    1
                    for proxy in proxies
                    if isinstance(proxy, dict) and proxy.get("alive") is True
                )

            subscription_info = item.get("subscriptionInfo")
            if not isinstance(subscription_info, dict):
                subscription_info = {}

            rows.append(
                {
                    "name": str(provider_name),
                    "type": str(item.get("type", "")),
                    "vehicle_type": str(item.get("vehicleType", "")),
                    "proxy_count": proxy_count,
                    "alive_count": alive_count,
                    "updated_at": str(item.get("updatedAt", "")),
                    "has_subscription_info": bool(subscription_info),
                    "subscription_info": subscription_info,
                }
            )

        rows.sort(key=lambda x: x["name"].lower())
        return rows

    def fetch_provider_rows(self, timeout: int = 8) -> list[dict]:
        resp = requests.get(
            f"{self.clash_api}/providers/proxies",
            headers=self.clash_headers(),
            timeout=timeout,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"clash api error: {resp.status_code}")
        payload = resp.json() if resp.content else {}
        return self.build_provider_rows(payload)

    def refresh_provider_subscription(self, provider_name: str) -> tuple[bool, str]:
        encoded_name = quote(provider_name, safe="")
        try:
            resp = requests.put(
                f"{self.clash_api}/providers/proxies/{encoded_name}",
                headers=self.clash_headers(),
                timeout=12,
            )
        except Exception as exc:
            return False, str(exc)

        if resp.status_code in (200, 204):
            return True, "ok"

        message = ""
        try:
            payload = resp.json() if resp.content else {}
            if isinstance(payload, dict):
                message = str(payload.get("message", "")).strip()
        except Exception:
            message = ""
        if not message:
            message = (resp.text or "").strip()
        if not message:
            message = f"http {resp.status_code}"
        return False, message

    def provider_auto_recovery_loop(self) -> None:
        threshold_seconds = self.provider_zero_alive_minutes * 60
        while True:
            time.sleep(self.provider_recovery_check_interval)
            if not self.provider_auto_refresh_enabled:
                continue

            try:
                rows = self.fetch_provider_rows(timeout=8)
            except Exception as exc:
                self.emit_log(f"provider auto-refresh skipped: fetch providers failed ({exc})", "WARN")
                continue

            now = datetime.now().replace(microsecond=0)
            now_iso_text = now.isoformat()
            today = now.strftime("%Y-%m-%d")
            pending_refresh: list[tuple[str, int, int]] = []
            state_changed = False

            with self.provider_recovery_lock:
                state = self.load_provider_recovery_state()
                providers = state.get("providers", {})
                if not isinstance(providers, dict):
                    providers = {}
                    state["providers"] = providers

                for row in rows:
                    provider_name = str(row.get("name", "")).strip()
                    if not provider_name:
                        continue

                    key = self.normalize_provider_name(provider_name, provider_name)
                    entry = providers.get(key, {})
                    if not isinstance(entry, dict):
                        entry = {}

                    zero_since_raw = str(entry.get("zero_since") or "").strip()
                    zero_since_dt = None
                    if zero_since_raw:
                        try:
                            zero_since_dt = datetime.fromisoformat(zero_since_raw)
                        except Exception:
                            zero_since_dt = None
                    try:
                        daily_updates = max(0, int(entry.get("daily_updates", 0)))
                    except Exception:
                        daily_updates = 0
                    daily_date = str(entry.get("daily_date") or "").strip()
                    if daily_date != today:
                        daily_date = today
                        daily_updates = 0

                    try:
                        proxy_count = max(0, int(row.get("proxy_count", 0)))
                    except Exception:
                        proxy_count = 0
                    try:
                        alive_count = max(0, int(row.get("alive_count", 0)))
                    except Exception:
                        alive_count = 0

                    vehicle_type = str(row.get("vehicle_type", "")).strip().lower()
                    supports_refresh = vehicle_type == "http"

                    if proxy_count <= 0 or alive_count > 0 or not supports_refresh:
                        if zero_since_dt is not None:
                            state_changed = True
                        zero_since_dt = None
                    else:
                        if zero_since_dt is None:
                            zero_since_dt = now
                        elapsed_seconds = max(
                            0,
                            int((now - zero_since_dt).total_seconds()),
                        )
                        if elapsed_seconds >= threshold_seconds:
                            if daily_updates < self.provider_auto_refresh_max_per_day:
                                daily_updates += 1
                                pending_refresh.append(
                                    (
                                        provider_name,
                                        elapsed_seconds,
                                        daily_updates,
                                    )
                                )
                                # Reset timing window after each refresh attempt.
                                zero_since_dt = now
                                state_changed = True

                    next_zero_since = zero_since_dt.isoformat() if zero_since_dt else None
                    next_entry = {
                        "zero_since": next_zero_since,
                        "last_checked": now_iso_text,
                        "daily_date": daily_date,
                        "daily_updates": daily_updates,
                    }
                    if providers.get(key) != next_entry:
                        state_changed = True
                    providers[key] = next_entry

                if state_changed:
                    self.save_provider_recovery_state(state)

            for provider_name, elapsed_seconds, daily_updates in pending_refresh:
                ok, message = self.refresh_provider_subscription(provider_name)
                elapsed_minutes = max(1, elapsed_seconds // 60)
                if ok:
                    self.emit_log(
                        (
                            f"provider auto-refresh triggered: {provider_name}, "
                            f"zero_for={elapsed_minutes}m, "
                            f"daily={daily_updates}/{self.provider_auto_refresh_max_per_day}"
                        ),
                        "SUCCESS",
                    )
                else:
                    self.emit_log(
                        (
                            f"provider auto-refresh failed: {provider_name}, "
                            f"zero_for={elapsed_minutes}m, "
                            f"daily={daily_updates}/{self.provider_auto_refresh_max_per_day}, msg={message}"
                        ),
                        "WARN",
                    )
