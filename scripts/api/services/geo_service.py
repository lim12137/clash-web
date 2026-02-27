from __future__ import annotations

import time
from typing import Callable
from urllib.parse import quote

import requests

RETRYABLE_STATUS_CODES = {408, 409, 423, 425, 429, 500, 502, 503, 504}


class GeoService:
    def __init__(
        self,
        *,
        clash_api: str,
        clash_headers: Callable[[], dict],
        system_proxy_names: set[str],
    ) -> None:
        self.clash_api = clash_api
        self.clash_headers = clash_headers
        self.system_proxy_names = {str(x).upper() for x in system_proxy_names}

    def clash_delay_request(
        self,
        proxy_name: str,
        test_url: str = "http://www.gstatic.com/generate_204",
        timeout_ms: int = 6000,
    ) -> tuple[bool, int, str]:
        encoded = quote(proxy_name, safe="")
        timeout_ms = max(1000, min(20000, int(timeout_ms)))
        request_timeout = max(3.0, timeout_ms / 1000.0 + 2.0)
        try:
            resp = requests.get(
                f"{self.clash_api}/proxies/{encoded}/delay",
                headers=self.clash_headers(),
                params={"url": test_url, "timeout": timeout_ms},
                timeout=request_timeout,
            )
            if resp.status_code != 200:
                return False, -1, f"clash api error: {resp.status_code}"
            payload = resp.json() if resp.content else {}
            delay_raw = payload.get("delay") if isinstance(payload, dict) else None
            delay = int(delay_raw) if delay_raw is not None else -1
            if delay < 0:
                return False, -1, "delay timeout"
            return True, delay, ""
        except Exception as exc:
            return False, -1, str(exc)

    def fetch_rule_provider_rows(self) -> tuple[list[dict], str]:
        try:
            resp = requests.get(
                f"{self.clash_api}/providers/rules",
                headers=self.clash_headers(),
                timeout=8,
            )
            if resp.status_code != 200:
                return [], f"clash api error: {resp.status_code}"
            payload = resp.json() if resp.content else {}
            raw_providers = payload.get("providers", {}) if isinstance(payload, dict) else {}
            if not isinstance(raw_providers, dict):
                raw_providers = {}

            rows: list[dict] = []
            for provider_name, item in raw_providers.items():
                if not isinstance(item, dict):
                    continue
                rule_count_raw = item.get("ruleCount", 0)
                try:
                    rule_count = max(0, int(rule_count_raw))
                except Exception:
                    rule_count = 0
                rows.append(
                    {
                        "name": str(provider_name),
                        "type": str(item.get("type", "")),
                        "behavior": str(item.get("behavior", "")),
                        "format": str(item.get("format", "")),
                        "vehicle_type": str(item.get("vehicleType", "")),
                        "rule_count": rule_count,
                        "updated_at": str(item.get("updatedAt", "")),
                    }
                )

            rows.sort(key=lambda x: x["name"].lower())
            return rows, ""
        except Exception as exc:
            return [], str(exc)

    def geo_proxy_check(
        self,
        test_url: str = "http://www.gstatic.com/generate_204",
        timeout_ms: int = 6000,
    ) -> dict:
        try:
            resp = requests.get(f"{self.clash_api}/proxies", headers=self.clash_headers(), timeout=6)
            if resp.status_code != 200:
                return {
                    "ok": False,
                    "message": f"clash api error: {resp.status_code}",
                    "tested_url": test_url,
                    "attempts": [],
                }
            payload = resp.json() if resp.content else {}
            raw_proxies = payload.get("proxies", {}) if isinstance(payload, dict) else {}
            if not isinstance(raw_proxies, dict):
                raw_proxies = {}
        except Exception as exc:
            return {
                "ok": False,
                "message": str(exc),
                "tested_url": test_url,
                "attempts": [],
            }

        groups: list[dict] = []
        for group_name, item in raw_proxies.items():
            if not isinstance(item, dict):
                continue
            options = item.get("all")
            if not isinstance(options, list) or not options:
                continue
            name = str(group_name).strip()
            now = str(item.get("now", "")).strip()
            nodes = [str(x).strip() for x in options if str(x).strip()]
            if not nodes:
                continue
            groups.append({"name": name, "now": now, "nodes": nodes})

        def group_rank(group: dict) -> tuple[int, int]:
            lowered = str(group.get("name", "")).lower()
            score = 0
            if "proxy" in lowered:
                score += 120
            if "auto" in lowered:
                score += 90
            if "global" in lowered:
                score += 80
            if "select" in lowered or "选择" in lowered:
                score += 40
            if "google" in lowered:
                score += 20
            nodes = group.get("nodes", [])
            return (-score, -len(nodes) if isinstance(nodes, list) else 0)

        groups.sort(key=group_rank)

        attempts: list[dict] = []
        for group in groups:
            group_name = str(group["name"])
            nodes = list(group["nodes"])
            candidates: list[str] = []
            current = str(group.get("now", "")).strip()
            if current:
                candidates.append(current)
            candidates.extend(nodes)

            deduped: list[str] = []
            seen: set[str] = set()
            for node in candidates:
                key = node.upper()
                if key in seen:
                    continue
                seen.add(key)
                deduped.append(node)

            for node in deduped:
                if node.upper() in self.system_proxy_names:
                    continue
                ok, delay, error = self.clash_delay_request(
                    node,
                    test_url=test_url,
                    timeout_ms=timeout_ms,
                )
                attempt = {
                    "group": group_name,
                    "proxy": node,
                    "ok": ok,
                    "delay": delay,
                    "error": error,
                }
                attempts.append(attempt)
                if ok:
                    return {
                        "ok": True,
                        "message": "proxy reachable",
                        "tested_url": test_url,
                        "group": group_name,
                        "proxy": node,
                        "delay": delay,
                        "attempts": attempts[:6],
                    }
                if len(attempts) >= 8:
                    return {
                        "ok": False,
                        "message": "no reachable proxy in tested groups",
                        "tested_url": test_url,
                        "attempts": attempts,
                    }

        return {
            "ok": False,
            "message": "no candidate proxy groups",
            "tested_url": test_url,
            "attempts": attempts,
        }

    def infer_geo_new_data(self, message: str) -> str:
        lowered = message.lower()
        if not lowered:
            return "unknown"

        no_tokens = [
            "already",
            "up-to-date",
            "up to date",
            "latest",
            "no update",
            "unchanged",
            "已是最新",
            "无需更新",
            "没有更新",
            "无更新",
        ]
        yes_tokens = [
            "downloaded",
            "updated",
            "fetched",
            "success",
            "completed",
            "更新完成",
            "已更新",
            "下载完成",
        ]
        if any(token in lowered for token in no_tokens):
            return "no"
        if any(token in lowered for token in yes_tokens):
            return "yes"
        return "unknown"

    def format_geo_db_summary(self, geo_item: dict) -> str:
        status = str(geo_item.get("status", "unknown"))
        message = str(geo_item.get("message", "")).strip()
        new_data = str(geo_item.get("new_data", "unknown"))

        if status == "updated":
            if new_data == "yes":
                text = "GEO 库：已更新，检测到新数据"
            elif new_data == "no":
                text = "GEO 库：已检查，当前已是最新"
            else:
                text = "GEO 库：更新请求已执行，是否有新数据未知"
        elif status == "busy":
            text = "GEO 库：已有更新任务在进行，当前请求被跳过"
        elif status == "failed":
            text = "GEO 库：更新失败"
        elif status == "skipped":
            text = "GEO 库：未执行"
        else:
            text = f"GEO 库：状态 {status}"

        if message and message not in {"not requested", "geo database update triggered"}:
            text = f"{text}（{message}）"
        return text

    def clash_request_with_retry(
        self,
        method: str,
        path: str,
        timeout: float,
        attempts: int = 1,
    ) -> tuple[requests.Response | None, str]:
        safe_attempts = max(1, int(attempts))
        last_error = ""
        for attempt in range(1, safe_attempts + 1):
            try:
                response = requests.request(
                    method,
                    f"{self.clash_api}{path}",
                    headers=self.clash_headers(),
                    timeout=timeout,
                )
                if response.status_code in (200, 204):
                    return response, ""
                if response.status_code in RETRYABLE_STATUS_CODES and attempt < safe_attempts:
                    time.sleep(0.5 * attempt)
                    continue
                return response, ""
            except Exception as exc:
                last_error = str(exc)
                if attempt < safe_attempts:
                    time.sleep(0.5 * attempt)
                    continue
                return None, last_error
        return None, last_error

    def response_error_text(self, response: requests.Response) -> str:
        default_error = f"clash api error: {response.status_code}"
        try:
            payload = response.json() if response.content else {}
        except Exception:
            payload = {}

        if isinstance(payload, dict):
            detail = str(payload.get("message", "")).strip()
            if detail:
                return f"{default_error} ({detail})"

        raw_text = str(getattr(response, "text", "") or "").strip()
        if raw_text:
            return f"{default_error} ({raw_text[:180]})"
        return default_error

    def perform_geo_db_update(self) -> dict:
        geo_resp, geo_error = self.clash_request_with_retry(
            "POST",
            "/configs/geo",
            timeout=45,
            attempts=3,
        )
        if geo_resp is None:
            return {
                "status": "failed",
                "message": geo_error or "request failed",
                "new_data": "unknown",
            }

        payload: dict | list | str | int | float | None = {}
        if geo_resp.content:
            try:
                payload = geo_resp.json()
            except Exception:
                payload = {}
        message = ""
        if isinstance(payload, dict):
            message = str(payload.get("message", "")).strip()
        if not message:
            raw_text = str(getattr(geo_resp, "text", "") or "").strip()
            if raw_text:
                message = raw_text[:280]

        if geo_resp.status_code in (200, 204):
            if not message:
                message = "geo database update triggered"
            return {
                "status": "updated",
                "message": message,
                "new_data": self.infer_geo_new_data(message),
            }

        if not message:
            message = self.response_error_text(geo_resp)
        lowered = message.lower()
        if "updating" in lowered and "skip" in lowered:
            return {"status": "busy", "message": message, "new_data": "unknown"}
        return {"status": "failed", "message": message, "new_data": "unknown"}

    def empty_rule_provider_update_result(self) -> dict:
        return {
            "total": 0,
            "updated": 0,
            "failed": 0,
            "changed": 0,
            "unchanged": 0,
            "unknown": 0,
            "compare_error": "",
            "items": [],
            "failed_names": [],
        }

    def update_rule_providers(self) -> dict:
        provider_rows, providers_error = self.fetch_rule_provider_rows()
        provider_items: list[dict] = []
        provider_before_map: dict[str, dict] = {}
        provider_after_map: dict[str, dict] = {}
        provider_after_error = ""

        if providers_error:
            provider_items.append({"name": "_all_", "ok": False, "error": providers_error})
        else:
            for row in provider_rows:
                name = str(row.get("name", "")).strip()
                if not name:
                    continue
                provider_before_map[name] = {
                    "updated_at": str(row.get("updated_at", "")).strip(),
                    "rule_count": row.get("rule_count", 0),
                }
                encoded = quote(name, safe="")
                resp, request_error = self.clash_request_with_retry(
                    "PUT",
                    f"/providers/rules/{encoded}",
                    timeout=30,
                    attempts=2,
                )
                if resp is None:
                    provider_items.append(
                        {"name": name, "ok": False, "error": request_error or "request failed"}
                    )
                    continue

                ok = resp.status_code in (200, 204)
                err = "" if ok else self.response_error_text(resp)
                provider_items.append({"name": name, "ok": ok, "error": err})

            retry_candidates = [
                item
                for item in provider_items
                if not item.get("ok") and str(item.get("name", "")).strip() not in {"", "_all_"}
            ]
            if retry_candidates:
                time.sleep(1.0)
                for item in retry_candidates:
                    name = str(item.get("name", "")).strip()
                    if not name:
                        continue
                    encoded = quote(name, safe="")
                    resp, request_error = self.clash_request_with_retry(
                        "PUT",
                        f"/providers/rules/{encoded}",
                        timeout=35,
                        attempts=2,
                    )
                    if resp is None:
                        retry_error = request_error or "request failed"
                        prev_error = str(item.get("error", "")).strip()
                        if prev_error and prev_error != retry_error:
                            item["error"] = f"{prev_error}; retry={retry_error}"
                        else:
                            item["error"] = retry_error or prev_error
                        continue

                    ok = resp.status_code in (200, 204)
                    if ok:
                        item["ok"] = True
                        item["error"] = ""
                        continue

                    retry_error = self.response_error_text(resp)
                    prev_error = str(item.get("error", "")).strip()
                    if prev_error and prev_error != retry_error:
                        item["error"] = f"{prev_error}; retry={retry_error}"
                    else:
                        item["error"] = retry_error or prev_error

            provider_after_rows, provider_after_error = self.fetch_rule_provider_rows()
            if not provider_after_error:
                for row in provider_after_rows:
                    name = str(row.get("name", "")).strip()
                    if not name:
                        continue
                    provider_after_map[name] = {
                        "updated_at": str(row.get("updated_at", "")).strip(),
                        "rule_count": row.get("rule_count", 0),
                    }

        failed_count = len([x for x in provider_items if not x.get("ok")])
        updated_count = len([x for x in provider_items if x.get("ok")])
        total_count = len(provider_items)
        provider_changed_count = 0
        provider_unchanged_count = 0
        provider_unknown_count = 0
        provider_failed_names: list[str] = []

        for item in provider_items:
            name = str(item.get("name", "")).strip()
            ok = bool(item.get("ok"))
            if not ok:
                if name and name != "_all_":
                    provider_failed_names.append(name)
                item["status"] = "failed"
                item["new_data"] = "unknown"
                provider_unknown_count += 1
                continue

            before_meta = provider_before_map.get(name, {})
            after_meta = provider_after_map.get(name, {})
            before_updated_at = str(before_meta.get("updated_at", "")).strip()
            after_updated_at = str(after_meta.get("updated_at", "")).strip()
            item["before_updated_at"] = before_updated_at
            item["after_updated_at"] = after_updated_at

            try:
                before_rule_count = int(before_meta.get("rule_count", 0))
            except Exception:
                before_rule_count = 0
            try:
                after_rule_count = int(after_meta.get("rule_count", 0))
            except Exception:
                after_rule_count = 0
            item["before_rule_count"] = before_rule_count
            item["after_rule_count"] = after_rule_count

            if provider_after_error:
                item["status"] = "unknown"
                item["new_data"] = "unknown"
                provider_unknown_count += 1
                continue

            if not after_meta:
                item["status"] = "unknown"
                item["new_data"] = "unknown"
                provider_unknown_count += 1
                continue

            changed = False
            if before_updated_at and after_updated_at and before_updated_at != after_updated_at:
                changed = True
            elif before_rule_count != after_rule_count:
                changed = True
            elif (not before_updated_at) and after_updated_at:
                changed = True

            if changed:
                item["status"] = "updated"
                item["new_data"] = "yes"
                provider_changed_count += 1
            else:
                item["status"] = "no_change"
                item["new_data"] = "no"
                provider_unchanged_count += 1

        if providers_error and not provider_rows:
            total_count = 0
            updated_count = 0
            failed_count = 1
            provider_unknown_count = max(provider_unknown_count, 1)

        return {
            "total": total_count,
            "updated": updated_count,
            "failed": failed_count,
            "changed": provider_changed_count,
            "unchanged": provider_unchanged_count,
            "unknown": provider_unknown_count,
            "compare_error": provider_after_error,
            "items": provider_items,
            "failed_names": provider_failed_names,
        }

    def compose_geo_update_result(
        self,
        check_result: dict,
        geo_db_result: dict,
        provider_result: dict,
        *,
        update_geo_db: bool,
        update_rule_providers: bool,
    ) -> dict:
        failed_count = int(provider_result.get("failed", 0))
        updated_count = int(provider_result.get("updated", 0))
        total_count = int(provider_result.get("total", 0))
        provider_changed_count = int(provider_result.get("changed", 0))
        provider_unchanged_count = int(provider_result.get("unchanged", 0))
        provider_unknown_count = int(provider_result.get("unknown", 0))
        provider_after_error = str(provider_result.get("compare_error", "") or "")
        provider_items = provider_result.get("items", [])
        provider_failed_names = provider_result.get("failed_names", [])

        geo_ok = geo_db_result["status"] in {"updated", "busy", "skipped"}
        providers_ok = (not update_rule_providers) or failed_count == 0
        overall_ok = bool(check_result.get("ok")) and geo_ok and providers_ok
        geo_new_state = str(geo_db_result.get("new_data", "unknown"))

        rules_new_state = "unknown"
        if update_rule_providers:
            if provider_changed_count > 0:
                rules_new_state = "yes"
            elif failed_count == 0 and provider_unknown_count == 0 and total_count > 0:
                rules_new_state = "no"

        new_data_candidates: list[str] = []
        if update_geo_db:
            new_data_candidates.append(geo_new_state)
        if update_rule_providers:
            new_data_candidates.append(rules_new_state)

        new_data_state = "unknown"
        if "yes" in new_data_candidates:
            new_data_state = "yes"
        elif new_data_candidates and all(x == "no" for x in new_data_candidates):
            new_data_state = "no"

        if overall_ok:
            if new_data_state == "yes":
                message = "GEO 更新成功：检测到新数据并已刷新"
            elif new_data_state == "no":
                message = "GEO 更新成功：已检查完成，当前已是最新"
            else:
                message = "GEO 更新已执行：成功但无法确认是否有新数据"
        elif geo_db_result["status"] == "failed" and failed_count > 0:
            message = "GEO 更新失败：GEO 库和规则提供者都存在失败"
        elif geo_db_result["status"] == "failed":
            message = "GEO 更新部分失败：GEO 库更新失败"
        elif failed_count > 0:
            message = "GEO 更新部分失败：规则提供者更新失败"
        else:
            message = "GEO 更新部分失败或未执行"

        geo_db_summary = self.format_geo_db_summary(geo_db_result)
        rules_summary = (
            f"规则提供者：成功 {updated_count}/{total_count}，失败 {failed_count}，"
            f"有更新 {provider_changed_count}，无变化 {provider_unchanged_count}"
        )
        if provider_unknown_count:
            rules_summary = f"{rules_summary}，结果未知 {provider_unknown_count}"
        if provider_after_error:
            rules_summary = f"{rules_summary}（结果比对失败: {provider_after_error}）"

        return {
            "ok": overall_ok,
            "message": message,
            "new_data": new_data_state,
            "check": check_result,
            "geo_db": geo_db_result,
            "rule_providers": {
                "total": total_count,
                "updated": updated_count,
                "failed": failed_count,
                "changed": provider_changed_count,
                "unchanged": provider_unchanged_count,
                "unknown": provider_unknown_count,
                "compare_error": provider_after_error,
                "items": provider_items,
            },
            "update_summary": {
                "overall_ok": overall_ok,
                "overall_status": "success" if overall_ok else "partial_failed",
                "new_data": new_data_state,
                "message": message,
                "geo_db": geo_db_summary,
                "rules": rules_summary,
                "failed_rules": provider_failed_names,
            },
        }
