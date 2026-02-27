#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import threading
import time
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import requests


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _safe_list_of_str(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = _safe_str(item)
        if text:
            result.append(text)
    return result


class ProxyRecordStore:
    def __init__(self, file_path: Path, max_records: int = 1000) -> None:
        self.file_path = Path(file_path)
        self.max_records = max(100, _safe_int(max_records, 1000))
        self.lock = threading.Lock()

    def ensure_file(self) -> None:
        with self.lock:
            if self.file_path.exists():
                return
            self._save_unlocked({"records": [], "version": 1})

    def _load_unlocked(self) -> dict:
        try:
            if self.file_path.exists():
                with self.file_path.open("r", encoding="utf-8") as fh:
                    loaded = json.load(fh)
                    if isinstance(loaded, dict):
                        records = loaded.get("records", [])
                        if isinstance(records, list):
                            return {"records": records, "version": loaded.get("version", 1)}
        except Exception:
            pass
        return {"records": [], "version": 1}

    def _save_unlocked(self, data: dict) -> bool:
        try:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            with self.file_path.open("w", encoding="utf-8") as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False

    def _cleanup_old_records(self, records: list[dict]) -> list[dict]:
        if len(records) <= self.max_records:
            return records
        sorted_records = sorted(
            records,
            key=lambda x: _safe_int(x.get("timestamp"), 0),
            reverse=True,
        )
        return sorted_records[: self.max_records]

    def query_records(
        self,
        keyword: str = "",
        subscription: str = "",
        record_type: str = "",
        app_name: str = "",
        host: str = "",
        limit: int = 100,
    ) -> tuple[list[dict], dict]:
        limit = max(10, min(500, _safe_int(limit, 100)))
        keyword_lower = _safe_str(keyword).lower()
        subscription_lower = _safe_str(subscription).lower()
        record_type_text = _safe_str(record_type)
        app_lower = _safe_str(app_name).lower()
        host_lower = _safe_str(host).lower()

        with self.lock:
            data = self._load_unlocked()
            records = data.get("records", [])
            if not isinstance(records, list):
                records = []

        filtered: list[dict] = []
        for item_raw in records:
            item = item_raw if isinstance(item_raw, dict) else {}
            proxy_name = _safe_str(item.get("proxy_name"))
            group_name = _safe_str(item.get("group_name"))
            target_node = _safe_str(item.get("target_node"))
            record_subscription = _safe_str(item.get("subscription"))
            record_item_type = _safe_str(item.get("type"))
            record_app = _safe_str(item.get("app_name"))
            record_process_path = _safe_str(item.get("process_path"))
            record_host = _safe_str(item.get("host"))
            record_destination = _safe_str(item.get("destination"))
            record_rule = _safe_str(item.get("rule"))

            if keyword_lower:
                keyword_hit = any(
                    keyword_lower in text.lower()
                    for text in [
                        proxy_name,
                        group_name,
                        target_node,
                        record_app,
                        record_process_path,
                        record_host,
                        record_destination,
                        record_rule,
                    ]
                )
                if not keyword_hit:
                    continue

            if subscription_lower and subscription_lower not in record_subscription.lower():
                continue
            if record_type_text and record_type_text != record_item_type:
                continue
            if app_lower:
                app_hit = app_lower in record_app.lower() or app_lower in record_process_path.lower()
                if not app_hit:
                    continue
            if host_lower:
                host_hit = host_lower in record_host.lower() or host_lower in record_destination.lower()
                if not host_hit:
                    continue

            filtered.append(item)

        filtered.sort(key=lambda x: _safe_int(x.get("timestamp"), 0), reverse=True)
        result = filtered[:limit]
        stats = {
            "total": len(records),
            "filtered": len(filtered),
            "returned": len(result),
        }
        return result, stats

    def _build_record(self, body: dict, record_id_seed: int) -> dict:
        now_ts = int(time.time())
        chains = _safe_list_of_str(body.get("chains"))
        upload = max(0, _safe_int(body.get("upload"), 0))
        download = max(0, _safe_int(body.get("download"), 0))
        hit_count = max(1, _safe_int(body.get("hit_count"), 1))
        return {
            "id": f"rec_{int(time.time() * 1000)}_{record_id_seed}",
            "timestamp": now_ts,
            "type": _safe_str(body.get("type")) or "switch",
            "proxy_name": _safe_str(body.get("proxy_name")),
            "group_name": _safe_str(body.get("group_name")),
            "target_node": _safe_str(body.get("target_node")),
            "subscription": _safe_str(body.get("subscription")),
            "provider": _safe_str(body.get("provider")),
            "delay_ms": _safe_int(body.get("delay_ms"), -1),
            "success": bool(body.get("success", True)),
            "note": _safe_str(body.get("note")),
            "app_name": _safe_str(body.get("app_name")),
            "process_path": _safe_str(body.get("process_path")),
            "host": _safe_str(body.get("host")),
            "destination": _safe_str(body.get("destination")),
            "rule": _safe_str(body.get("rule")),
            "rule_payload": _safe_str(body.get("rule_payload")),
            "network": _safe_str(body.get("network")),
            "conn_type": _safe_str(body.get("conn_type")),
            "chains": chains,
            "hit_count": hit_count,
            "upload": upload,
            "download": download,
            "merge_key": _safe_str(body.get("merge_key")),
        }

    def add_record(self, body: dict) -> tuple[bool, dict | None]:
        payload = body if isinstance(body, dict) else {}
        with self.lock:
            data = self._load_unlocked()
            records = data.get("records", [])
            if not isinstance(records, list):
                records = []
            record = self._build_record(payload, len(records))
            records.append(record)
            records = self._cleanup_old_records(records)
            data["records"] = records
            ok = self._save_unlocked(data)
            if not ok:
                return False, None
            return True, record

    @staticmethod
    def _hash_text(parts: list[str]) -> str:
        raw = "|".join(parts)
        return hashlib.sha1(raw.encode("utf-8", errors="ignore")).hexdigest()

    def _apply_connection_update(self, current: dict, event: dict, now_ts: int) -> None:
        current["timestamp"] = now_ts
        current["type"] = "connection"
        current["delay_ms"] = -1
        current["success"] = True
        current["proxy_name"] = _safe_str(event.get("target_node")) or _safe_str(current.get("proxy_name"))
        current["group_name"] = _safe_str(event.get("group_name")) or _safe_str(current.get("group_name"))
        current["target_node"] = _safe_str(event.get("target_node")) or _safe_str(current.get("target_node"))
        current["app_name"] = _safe_str(event.get("app_name")) or _safe_str(current.get("app_name"))
        current["process_path"] = _safe_str(event.get("process_path")) or _safe_str(
            current.get("process_path")
        )
        current["host"] = _safe_str(event.get("host")) or _safe_str(current.get("host"))
        current["destination"] = _safe_str(event.get("destination")) or _safe_str(
            current.get("destination")
        )
        current["rule"] = _safe_str(event.get("rule")) or _safe_str(current.get("rule"))
        current["rule_payload"] = _safe_str(event.get("rule_payload")) or _safe_str(
            current.get("rule_payload")
        )
        current["network"] = _safe_str(event.get("network")) or _safe_str(current.get("network"))
        current["conn_type"] = _safe_str(event.get("conn_type")) or _safe_str(current.get("conn_type"))
        chains = _safe_list_of_str(event.get("chains"))
        if chains:
            current["chains"] = chains
        current["merge_key"] = _safe_str(event.get("merge_key")) or _safe_str(current.get("merge_key"))
        current["hit_count"] = max(1, _safe_int(current.get("hit_count"), 1) + 1)
        current["upload"] = max(_safe_int(current.get("upload"), 0), _safe_int(event.get("upload"), 0))
        current["download"] = max(
            _safe_int(current.get("download"), 0),
            _safe_int(event.get("download"), 0),
        )

    def _build_connection_record(self, event: dict, record_id_seed: int, now_ts: int) -> dict:
        return {
            "id": f"rec_{int(time.time() * 1000)}_{record_id_seed}",
            "timestamp": now_ts,
            "type": "connection",
            "proxy_name": _safe_str(event.get("target_node")),
            "group_name": _safe_str(event.get("group_name")),
            "target_node": _safe_str(event.get("target_node")),
            "subscription": "",
            "provider": "",
            "delay_ms": -1,
            "success": True,
            "note": _safe_str(event.get("note")),
            "app_name": _safe_str(event.get("app_name")),
            "process_path": _safe_str(event.get("process_path")),
            "host": _safe_str(event.get("host")),
            "destination": _safe_str(event.get("destination")),
            "rule": _safe_str(event.get("rule")),
            "rule_payload": _safe_str(event.get("rule_payload")),
            "network": _safe_str(event.get("network")),
            "conn_type": _safe_str(event.get("conn_type")),
            "chains": _safe_list_of_str(event.get("chains")),
            "hit_count": max(1, _safe_int(event.get("hit_count"), 1)),
            "upload": max(0, _safe_int(event.get("upload"), 0)),
            "download": max(0, _safe_int(event.get("download"), 0)),
            "merge_key": _safe_str(event.get("merge_key")),
        }

    def merge_connection_events(self, events: list[dict]) -> int:
        if not events:
            return 0

        with self.lock:
            data = self._load_unlocked()
            records = data.get("records", [])
            if not isinstance(records, list):
                records = []

            index_by_key: dict[str, int] = {}
            for idx, item in enumerate(records):
                if not isinstance(item, dict):
                    continue
                merge_key = _safe_str(item.get("merge_key"))
                if merge_key:
                    index_by_key[merge_key] = idx

            now_ts = int(time.time())
            merged_count = 0
            for event_raw in events:
                event = event_raw if isinstance(event_raw, dict) else {}
                merge_key = _safe_str(event.get("merge_key"))
                if not merge_key:
                    merge_key = self._hash_text(
                        [
                            _safe_str(event.get("app_name")),
                            _safe_str(event.get("host")),
                            _safe_str(event.get("destination")),
                            _safe_str(event.get("group_name")),
                            _safe_str(event.get("target_node")),
                            _safe_str(event.get("network")),
                            _safe_str(event.get("conn_type")),
                            _safe_str(event.get("rule")),
                            _safe_str(event.get("rule_payload")),
                        ]
                    )
                    event["merge_key"] = merge_key

                idx = index_by_key.get(merge_key)
                if idx is None:
                    record = self._build_connection_record(event, len(records), now_ts)
                    records.append(record)
                    index_by_key[merge_key] = len(records) - 1
                    merged_count += 1
                    continue

                item = records[idx] if isinstance(records[idx], dict) else {}
                self._apply_connection_update(item, event, now_ts)
                records[idx] = item
                merged_count += 1

            records = self._cleanup_old_records(records)
            data["records"] = records
            if not self._save_unlocked(data):
                return 0
            return merged_count

    def delete_record(self, record_id: str) -> tuple[bool, bool]:
        target_id = _safe_str(record_id)
        if not target_id:
            return False, False

        with self.lock:
            data = self._load_unlocked()
            records = data.get("records", [])
            if not isinstance(records, list):
                records = []
            original_len = len(records)
            records = [r for r in records if _safe_str((r or {}).get("id")) != target_id]
            found = len(records) != original_len
            if not found:
                return False, False
            data["records"] = records
            ok = self._save_unlocked(data)
            return ok, True

    def clear_records(self) -> bool:
        with self.lock:
            return self._save_unlocked({"records": [], "version": 1})

    def get_stats(self) -> dict:
        with self.lock:
            data = self._load_unlocked()
            records = data.get("records", [])
            if not isinstance(records, list):
                records = []

        subscriptions = Counter(_safe_str((r or {}).get("subscription")) or "未知" for r in records)
        providers = Counter(_safe_str((r or {}).get("provider")) or "未知" for r in records)
        types = Counter(_safe_str((r or {}).get("type")) or "unknown" for r in records)
        apps = Counter(_safe_str((r or {}).get("app_name")) or "未知" for r in records)
        hosts = Counter(
            (_safe_str((r or {}).get("host")) or _safe_str((r or {}).get("destination")) or "未知")
            for r in records
        )

        daily_counts = Counter()
        for item in records:
            ts = _safe_int((item or {}).get("timestamp"), 0)
            if ts <= 0:
                continue
            day = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
            daily_counts[day] += 1

        return {
            "total": len(records),
            "subscriptions": dict(subscriptions),
            "providers": dict(providers),
            "types": dict(types),
            "apps": dict(apps),
            "hosts": dict(hosts),
            "daily_counts": dict(daily_counts),
        }


class ClashConnectionRecorder:
    def __init__(
        self,
        clash_api: str,
        headers_func: Callable[[], dict],
        store: ProxyRecordStore,
        emit_log: Callable[[str, str], None] | Callable[[str], None],
        poll_interval: int = 6,
        request_timeout: int = 5,
    ) -> None:
        self.clash_api = _safe_str(clash_api).rstrip("/")
        self.headers_func = headers_func
        self.store = store
        self.emit_log = emit_log
        self.poll_interval = max(3, _safe_int(poll_interval, 6))
        self.request_timeout = max(3, _safe_int(request_timeout, 5))

        self._stop_event = threading.Event()
        self._state_lock = threading.Lock()
        self._capture_lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._active_connection_fingerprints: dict[str, str] = {}

    def _log(self, message: str, level: str = "INFO") -> None:
        try:
            self.emit_log(message, level)  # type: ignore[misc]
        except TypeError:
            self.emit_log(message)  # type: ignore[misc]
        except Exception:
            pass

    @staticmethod
    def _hash_text(parts: list[str]) -> str:
        raw = "|".join(parts)
        return hashlib.sha1(raw.encode("utf-8", errors="ignore")).hexdigest()

    def _extract_destination(self, metadata: dict) -> str:
        remote_destination = _safe_str(metadata.get("remoteDestination"))
        if remote_destination:
            return remote_destination
        dst_ip = _safe_str(metadata.get("destinationIP"))
        dst_port = _safe_str(metadata.get("destinationPort"))
        if dst_ip and dst_port:
            return f"{dst_ip}:{dst_port}"
        return dst_ip

    def _extract_source(self, metadata: dict) -> str:
        src_ip = _safe_str(metadata.get("sourceIP"))
        src_port = _safe_str(metadata.get("sourcePort"))
        if src_ip and src_port:
            return f"{src_ip}:{src_port}"
        return src_ip

    def _parse_connection(self, item: dict) -> dict | None:
        if not isinstance(item, dict):
            return None
        metadata = item.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}

        process_name = (
            _safe_str(metadata.get("process"))
            or _safe_str(metadata.get("processName"))
            or _safe_str(metadata.get("process_name"))
        )
        process_path = _safe_str(metadata.get("processPath")) or _safe_str(metadata.get("process_path"))
        host = (
            _safe_str(metadata.get("host"))
            or _safe_str(metadata.get("sniffHost"))
            or _safe_str(metadata.get("sniff_host"))
        )
        destination = self._extract_destination(metadata)
        source = self._extract_source(metadata)

        chains = _safe_list_of_str(item.get("chains"))
        group_name = chains[0] if len(chains) > 1 else ""
        target_node = chains[-1] if chains else (_safe_str(item.get("outbound")) or _safe_str(item.get("outboundName")))

        rule = _safe_str(item.get("rule"))
        rule_payload = _safe_str(item.get("rulePayload"))
        network = _safe_str(metadata.get("network"))
        conn_type = _safe_str(metadata.get("type"))
        start_text = _safe_str(item.get("start"))

        if not (process_name or process_path or host or destination or target_node):
            return None

        connection_id = _safe_str(item.get("id"))
        if not connection_id:
            connection_id = self._hash_text(
                [
                    source,
                    destination,
                    host,
                    process_name,
                    process_path,
                    start_text,
                    target_node,
                ]
            )
        fingerprint = self._hash_text(
            [
                process_name,
                process_path,
                host,
                destination,
                target_node,
                group_name,
                rule,
                rule_payload,
                start_text,
            ]
        )
        merge_key = self._hash_text(
            [
                process_name,
                host,
                destination,
                group_name,
                target_node,
                network,
                conn_type,
                rule,
                rule_payload,
            ]
        )

        return {
            "connection_id": connection_id,
            "fingerprint": fingerprint,
            "merge_key": merge_key,
            "group_name": group_name,
            "target_node": target_node,
            "app_name": process_name,
            "process_path": process_path,
            "host": host,
            "destination": destination,
            "rule": rule,
            "rule_payload": rule_payload,
            "network": network,
            "conn_type": conn_type,
            "chains": chains,
            "upload": max(0, _safe_int(item.get("upload"), 0)),
            "download": max(0, _safe_int(item.get("download"), 0)),
        }

    def _fetch_connections(self) -> list[dict]:
        if not self.clash_api:
            return []
        try:
            response = requests.get(
                f"{self.clash_api}/connections",
                headers=self.headers_func() or {},
                timeout=self.request_timeout,
            )
            if response.status_code != 200:
                return []
            payload = response.json() if response.content else {}
            if not isinstance(payload, dict):
                return []
            connections = payload.get("connections", [])
            if not isinstance(connections, list):
                return []
            return [item for item in connections if isinstance(item, dict)]
        except Exception:
            return []

    def capture_once(self) -> int:
        with self._capture_lock:
            connections = self._fetch_connections()
            if not connections:
                self._active_connection_fingerprints = {}
                return 0

            previous = self._active_connection_fingerprints
            next_active: dict[str, str] = {}
            events: list[dict] = []
            for item in connections:
                parsed = self._parse_connection(item)
                if not parsed:
                    continue

                connection_id = _safe_str(parsed.pop("connection_id"))
                fingerprint = _safe_str(parsed.pop("fingerprint"))
                if not connection_id or not fingerprint:
                    continue
                next_active[connection_id] = fingerprint
                if previous.get(connection_id) == fingerprint:
                    continue
                events.append(parsed)

            self._active_connection_fingerprints = next_active
            if not events:
                return 0
            return self.store.merge_connection_events(events)

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.capture_once()
            except Exception as exc:
                self._log(f"connection recorder capture failed: {exc}", "WARN")
            self._stop_event.wait(self.poll_interval)

    def start(self) -> None:
        with self._state_lock:
            if self._thread and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._loop, daemon=True, name="connection-recorder")
            self._thread.start()

    def stop(self) -> None:
        with self._state_lock:
            self._stop_event.set()

    def status(self) -> dict:
        active = 0
        with self._state_lock:
            if self._thread and self._thread.is_alive():
                active = 1
        return {
            "running": bool(active),
            "poll_interval": self.poll_interval,
            "request_timeout": self.request_timeout,
            "active_connections": len(self._active_connection_fingerprints),
        }
