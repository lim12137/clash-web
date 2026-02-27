#!/usr/bin/env python3
"""
Management API for Clash single-host deployment.
"""

from __future__ import annotations

import json
import os
import queue
import re
import shutil
import subprocess
import tempfile
import threading
import time
import hashlib
import gzip
from collections import Counter
from datetime import datetime
from pathlib import Path
import signal
from urllib.parse import quote

import requests
import yaml
from flask import Flask, Response, jsonify, request, send_from_directory, stream_with_context
from flask_cors import CORS
from connection_recorder import ClashConnectionRecorder, ProxyRecordStore
from api.common.auth import configure_write_auth, require_write_auth
from api.common.io import load_json, load_yaml, make_backup, read_text, save_json, save_yaml, write_text
from api.common.logging import emit_log, get_recent_logs, subscribe_log_queue, unsubscribe_log_queue
from api.common.responses import json_error
from api.services.clash_client import build_clash_headers, reload_clash_config
from api.services.file_service import validate_js_override
from api.services.geo_service import GeoService
from api.services.kernel_service import KernelService
from api.services.merge_service import MergeService
from api.services.provider_service import ProviderService

BASE_DIR = Path(os.environ.get("MIHOMO_DIR", "/root/.config/mihomo"))
SCRIPTS_DIR = Path(os.environ.get("SCRIPTS_DIR", "/scripts"))
PROJECT_DIR = SCRIPTS_DIR.parent
WEB_DIR = Path(os.environ.get("WEB_DIR", str(PROJECT_DIR / "web")))

SUBS_DIR = BASE_DIR / "subs"
BACKUP_DIR = BASE_DIR / "backups"
CONFIG_FILE = BASE_DIR / "config.yaml"

SUBS_CONFIG = SCRIPTS_DIR / "subscriptions.json"
OVERRIDE_FILE = SCRIPTS_DIR / "override.yaml"
OVERRIDE_SCRIPT_FILE = SCRIPTS_DIR / "override.js"
TEMPLATE_FILE = SCRIPTS_DIR / "template.yaml"
SITE_POLICY_FILE = SCRIPTS_DIR / "site_policy.yaml"
SUBSCRIPTION_SETS_FILE = SCRIPTS_DIR / "subscription_sets.json"
SCHEDULE_FILE = SCRIPTS_DIR / "schedule.json"
SCHEDULE_HISTORY_FILE = SCRIPTS_DIR / "schedule_history.json"
PROVIDER_RECOVERY_FILE = SCRIPTS_DIR / "provider_recovery_state.json"
MERGE_SCRIPT_FILE = SCRIPTS_DIR / "merge.py"
PROXY_RECORDS_FILE = SCRIPTS_DIR / "proxy_records.json"

PYTHON_BIN = os.environ.get("PYTHON_BIN", "/usr/bin/python3")
NODE_BIN = os.environ.get("NODE_BIN", "node")
JS_VALIDATE_TIMEOUT = int(os.environ.get("JS_VALIDATE_TIMEOUT", "10"))
CLASH_API = os.environ.get("CLASH_API", "http://127.0.0.1:9090")
CLASH_SECRET = os.environ.get("CLASH_SECRET", "")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
MIHOMO_CORE_DIR = Path(os.environ.get("MIHOMO_CORE_DIR", "/opt/mihomo-core"))
MIHOMO_BIN = Path(os.environ.get("MIHOMO_BIN", str(MIHOMO_CORE_DIR / "mihomo")))
MIHOMO_PREV_BIN = Path(os.environ.get("MIHOMO_PREV_BIN", str(MIHOMO_CORE_DIR / "mihomo.prev")))

CORE_UPDATE_API = os.environ.get("CORE_UPDATE_API", "https://api.github.com").rstrip("/")
DEFAULT_CORE_REPO = str(os.environ.get("CORE_UPDATE_REPO", "MetaCubeX/mihomo")).strip() or "MetaCubeX/mihomo"
CORE_UPDATE_ALLOWED_REPOS = {
    item.strip()
    for item in str(os.environ.get("CORE_UPDATE_ALLOWED_REPOS", DEFAULT_CORE_REPO)).split(",")
    if item.strip()
}
if DEFAULT_CORE_REPO not in CORE_UPDATE_ALLOWED_REPOS:
    CORE_UPDATE_ALLOWED_REPOS.add(DEFAULT_CORE_REPO)

CORE_UPDATE_REQUIRE_CHECKSUM = str(
    os.environ.get("CORE_UPDATE_REQUIRE_CHECKSUM", "1")
).strip().lower() in {"1", "true", "yes", "on"}
try:
    CORE_UPDATE_DOWNLOAD_TIMEOUT = max(
        20,
        int(os.environ.get("CORE_UPDATE_DOWNLOAD_TIMEOUT", "180")),
    )
except ValueError:
    CORE_UPDATE_DOWNLOAD_TIMEOUT = 180
try:
    CORE_UPDATE_RESTART_DELAY = max(
        0.5,
        float(os.environ.get("CORE_UPDATE_RESTART_DELAY", "1.5")),
    )
except ValueError:
    CORE_UPDATE_RESTART_DELAY = 1.5

KERNEL_UPDATE_LOG_FILE = SCRIPTS_DIR / "kernel_update_history.jsonl"

SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
SAFE_REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
AUTO_SET_BLOCK_START = "// === AUTO-SUB-SETS:START ==="
AUTO_SET_BLOCK_END = "// === AUTO-SUB-SETS:END ==="
MAX_SCHEDULE_HISTORY = 200
SYSTEM_PROXY_NAMES = {"DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE"}

try:
    PROVIDER_AUTO_REFRESH_MAX_PER_DAY = max(
        1,
        int(os.environ.get("PROVIDER_AUTO_REFRESH_MAX_PER_DAY", "3")),
    )
except ValueError:
    PROVIDER_AUTO_REFRESH_MAX_PER_DAY = 3

try:
    PROVIDER_RECOVERY_CHECK_INTERVAL = max(
        10,
        int(os.environ.get("PROVIDER_RECOVERY_CHECK_INTERVAL", "60")),
    )
except ValueError:
    PROVIDER_RECOVERY_CHECK_INTERVAL = 60

try:
    PROVIDER_ZERO_ALIVE_MINUTES = max(
        1,
        int(os.environ.get("PROVIDER_ZERO_ALIVE_MINUTES", "30")),
    )
except ValueError:
    PROVIDER_ZERO_ALIVE_MINUTES = 30

PROVIDER_AUTO_REFRESH_ENABLED = os.environ.get(
    "PROVIDER_AUTO_REFRESH_ENABLED",
    "1",
).strip().lower() in {"1", "true", "yes", "on"}
CONNECTION_RECORD_ENABLED = os.environ.get(
    "CONNECTION_RECORD_ENABLED",
    "1",
).strip().lower() in {"1", "true", "yes", "on"}

try:
    CONNECTION_RECORD_INTERVAL = max(
        3,
        int(os.environ.get("CONNECTION_RECORD_INTERVAL", "6")),
    )
except ValueError:
    CONNECTION_RECORD_INTERVAL = 6

try:
    MAX_PROXY_RECORDS = max(
        100,
        int(os.environ.get("MAX_PROXY_RECORDS", "1000")),
    )
except ValueError:
    MAX_PROXY_RECORDS = 1000

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
configure_write_auth(ADMIN_TOKEN)

merge_lock = threading.Lock()
schedule_lock = threading.Lock()
history_lock = threading.Lock()
provider_recovery_lock = threading.Lock()
kernel_update_lock = threading.Lock()
restart_lock = threading.Lock()


def clash_headers() -> dict:
    return build_clash_headers(CLASH_SECRET)


def reload_clash() -> bool:
    return reload_clash_config(
        config_file=CONFIG_FILE,
        clash_api=CLASH_API,
        clash_secret=CLASH_SECRET,
        emit_log=emit_log,
        preferred_reload_path=os.environ.get("CLASH_RELOAD_PATH", "").strip(),
    )


merge_service = MergeService(
    python_bin=PYTHON_BIN,
    merge_script_file=MERGE_SCRIPT_FILE,
    schedule_file=SCHEDULE_FILE,
    schedule_history_file=SCHEDULE_HISTORY_FILE,
    max_schedule_history=MAX_SCHEDULE_HISTORY,
    load_json=load_json,
    save_json=save_json,
    emit_log=emit_log,
    reload_clash=reload_clash,
    merge_lock=merge_lock,
    schedule_lock=schedule_lock,
    history_lock=history_lock,
)

provider_service = ProviderService(
    clash_api=CLASH_API,
    clash_headers=clash_headers,
    provider_recovery_file=PROVIDER_RECOVERY_FILE,
    provider_auto_refresh_enabled=PROVIDER_AUTO_REFRESH_ENABLED,
    provider_recovery_check_interval=PROVIDER_RECOVERY_CHECK_INTERVAL,
    provider_zero_alive_minutes=PROVIDER_ZERO_ALIVE_MINUTES,
    provider_auto_refresh_max_per_day=PROVIDER_AUTO_REFRESH_MAX_PER_DAY,
    load_json=load_json,
    save_json=save_json,
    emit_log=emit_log,
    provider_recovery_lock=provider_recovery_lock,
)

kernel_service = KernelService(
    base_dir=BASE_DIR,
    config_file=CONFIG_FILE,
    scripts_dir=SCRIPTS_DIR,
    mihomo_core_dir=MIHOMO_CORE_DIR,
    mihomo_bin=MIHOMO_BIN,
    mihomo_prev_bin=MIHOMO_PREV_BIN,
    core_update_api=CORE_UPDATE_API,
    default_core_repo=DEFAULT_CORE_REPO,
    core_update_allowed_repos=CORE_UPDATE_ALLOWED_REPOS,
    core_update_require_checksum=CORE_UPDATE_REQUIRE_CHECKSUM,
    core_update_download_timeout=CORE_UPDATE_DOWNLOAD_TIMEOUT,
    core_update_restart_delay=CORE_UPDATE_RESTART_DELAY,
    kernel_update_log_file=KERNEL_UPDATE_LOG_FILE,
    emit_log=emit_log,
    kernel_update_lock=kernel_update_lock,
    restart_lock=restart_lock,
)

geo_service = GeoService(
    clash_api=CLASH_API,
    clash_headers=clash_headers,
    system_proxy_names=SYSTEM_PROXY_NAMES,
)


def ensure_safe_name(name: str) -> bool:
    return bool(SAFE_NAME_RE.fullmatch(name))


def ensure_json_body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


def parse_optional_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        text = value.strip().lower()
        if text in {"1", "true", "yes", "on"}:
            return True
        if text in {"0", "false", "no", "off"}:
            return False
    return None


def parse_optional_port(value):
    if value is None:
        return None
    try:
        port = int(value)
    except (TypeError, ValueError):
        return None
    if 1 <= port <= 65535:
        return port
    return None


def normalize_core_repo(value: str) -> str:
    return kernel_service.normalize_core_repo(value)


def ensure_core_repo_allowed(repo: str) -> None:
    kernel_service.ensure_core_repo_allowed(repo)


def detect_core_arch() -> str:
    return kernel_service.detect_core_arch()


def github_headers() -> dict:
    return kernel_service.github_headers()


def github_get_json(url: str, timeout: int = 20) -> dict:
    return kernel_service.github_get_json(url=url, timeout=timeout)


def fetch_core_release(repo: str, tag: str | None = None) -> dict:
    return kernel_service.fetch_core_release(repo=repo, tag=tag)


def select_core_release_asset(release_payload: dict, arch: str) -> dict:
    return kernel_service.select_core_release_asset(release_payload=release_payload, arch=arch)


def parse_sha256_from_checksum_text(content: str, target_name: str) -> str:
    return kernel_service.parse_sha256_from_checksum_text(content=content, target_name=target_name)


def extract_expected_sha256(release_payload: dict, asset_payload: dict) -> tuple[str, str]:
    return kernel_service.extract_expected_sha256(
        release_payload=release_payload,
        asset_payload=asset_payload,
    )


def download_file_sha256(url: str, output_path: Path) -> tuple[str, int]:
    return kernel_service.download_file_sha256(url=url, output_path=output_path)


def decompress_gzip_file(input_path: Path, output_path: Path) -> int:
    return kernel_service.decompress_gzip_file(input_path=input_path, output_path=output_path)


def run_cmd(args: list[str], timeout: int = 20) -> tuple[int, str, str]:
    return kernel_service.run_cmd(args=args, timeout=timeout)


def read_core_version(bin_path: Path) -> str:
    return kernel_service.read_core_version(bin_path=bin_path)


def verify_core_binary(bin_path: Path) -> tuple[bool, str]:
    return kernel_service.verify_core_binary(bin_path=bin_path)


def append_kernel_update_history(payload: dict) -> None:
    kernel_service.append_kernel_update_history(payload=payload)


def read_kernel_update_history(limit: int = 50) -> list[dict]:
    return kernel_service.read_kernel_update_history(limit=limit)


def schedule_self_restart(reason: str) -> bool:
    return kernel_service.schedule_self_restart(reason=reason)


def collect_kernel_status() -> dict:
    return kernel_service.collect_kernel_status()


def perform_kernel_update(repo: str, tag: str | None = None) -> dict:
    return kernel_service.perform_kernel_update(repo=repo, tag=tag)


def normalize_provider_name(raw: str, fallback: str = "Sub") -> str:
    return provider_service.normalize_provider_name(raw=raw, fallback=fallback)


def default_provider_recovery_state() -> dict:
    return provider_service.default_provider_recovery_state()


def sanitize_provider_recovery_state(data: dict) -> dict:
    return provider_service.sanitize_provider_recovery_state(data)


def load_provider_recovery_state() -> dict:
    return provider_service.load_provider_recovery_state()


def save_provider_recovery_state(data: dict) -> None:
    provider_service.save_provider_recovery_state(data)


def build_provider_rows(payload) -> list[dict]:
    return provider_service.build_provider_rows(payload)


def fetch_provider_rows(timeout: int = 8) -> list[dict]:
    return provider_service.fetch_provider_rows(timeout=timeout)


def refresh_provider_subscription(provider_name: str) -> tuple[bool, str]:
    return provider_service.refresh_provider_subscription(provider_name)


def provider_auto_recovery_loop() -> None:
    provider_service.provider_auto_recovery_loop()


def list_subscriptions():
    payload = load_json(SUBS_CONFIG, {"subscriptions": []})
    subs = payload.get("subscriptions", [])
    if not isinstance(subs, list):
        return []
    return subs


def save_subscriptions(subs: list[dict]) -> None:
    save_json(SUBS_CONFIG, {"subscriptions": subs})


def normalize_subscription_set_entries(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    result: list[dict] = []
    for idx, item in enumerate(raw, start=1):
        if isinstance(item, dict):
            name = str(item.get("name", "")).strip()
            url = str(item.get("url", "")).strip()
        else:
            name = ""
            url = str(item).strip()
        if not url:
            continue
        if not name:
            name = f"Sub{idx}"
        result.append({"name": name, "url": url})
    return result


def normalize_us_auto_priority(raw_value) -> str:
    text = str(raw_value or "").strip()
    if len(text) > 128:
        text = text[:128]
    return text


def normalize_us_auto_config(raw) -> dict:
    data = raw if isinstance(raw, dict) else {}
    return {
        "priority1": normalize_us_auto_priority(data.get("priority1")),
        "priority2": normalize_us_auto_priority(data.get("priority2")),
    }


def default_subscription_sets() -> dict:
    return {
        "set1": [],
        "set2": [],
        "us_auto": normalize_us_auto_config({}),
    }


def load_subscription_sets() -> dict:
    data = load_json(SUBSCRIPTION_SETS_FILE, default_subscription_sets())
    return {
        "set1": normalize_subscription_set_entries(data.get("set1")),
        "set2": normalize_subscription_set_entries(data.get("set2")),
        "us_auto": normalize_us_auto_config(data.get("us_auto")),
    }


def save_subscription_sets(data: dict) -> dict:
    payload = {
        "set1": normalize_subscription_set_entries(data.get("set1")),
        "set2": normalize_subscription_set_entries(data.get("set2")),
        "us_auto": normalize_us_auto_config(data.get("us_auto")),
    }
    save_json(SUBSCRIPTION_SETS_FILE, payload)
    return payload


def render_auto_set_block(sub_sets: dict) -> str:
    set1 = sub_sets.get("set1", [])
    set2 = sub_sets.get("set2", [])
    us_auto = normalize_us_auto_config(sub_sets.get("us_auto"))
    set1_json = json.dumps(set1, ensure_ascii=False, indent=2)
    set2_json = json.dumps(set2, ensure_ascii=False, indent=2)
    us_auto_json = json.dumps(us_auto, ensure_ascii=False, indent=2)
    lines = [
        AUTO_SET_BLOCK_START,
        "// 自动生成区块：请在管理面板的“订阅集合”里维护，不建议手工改这里。",
        f"const SUB_SET1 = {set1_json};",
        f"const SUB_SET2 = {set2_json};",
        f"const US_AUTO_PRIORITY = {us_auto_json};",
        "const US_AUTO_PRIORITY1 = String(US_AUTO_PRIORITY.priority1 || \"\").trim();",
        "const US_AUTO_PRIORITY2 = String(US_AUTO_PRIORITY.priority2 || \"\").trim();",
        "const SUB_SET1_URLS = SUB_SET1.map((x) => x.url).filter(Boolean);",
        "const SUB_SET2_URLS = SUB_SET2.map((x) => x.url).filter(Boolean);",
        AUTO_SET_BLOCK_END,
    ]
    return "\n".join(lines)


def inject_auto_set_block(script: str, block: str) -> str:
    text = script or ""
    start_idx = text.find(AUTO_SET_BLOCK_START)
    end_idx = text.find(AUTO_SET_BLOCK_END)
    if start_idx >= 0 and end_idx > start_idx:
        end_cut = end_idx + len(AUTO_SET_BLOCK_END)
        prefix = text[:start_idx].rstrip()
        suffix = text[end_cut:].lstrip("\r\n")
        if prefix:
            return f"{prefix}\n\n{block}\n\n{suffix}" if suffix else f"{prefix}\n\n{block}\n"
        return f"{block}\n\n{suffix}" if suffix else f"{block}\n"
    if text.strip():
        return f"{block}\n\n{text.lstrip()}"
    return f"{block}\n"


def sync_override_script_with_sets(sub_sets: dict) -> None:
    current = read_text(OVERRIDE_SCRIPT_FILE)
    block = render_auto_set_block(sub_sets)
    updated = inject_auto_set_block(current, block)
    if updated != current:
        write_text(OVERRIDE_SCRIPT_FILE, updated)


def default_schedule() -> dict:
    return merge_service.default_schedule()


def sanitize_schedule(data: dict) -> dict:
    return merge_service.sanitize_schedule(data)


def load_schedule() -> dict:
    return merge_service.load_schedule()


def save_schedule(data: dict) -> dict:
    return merge_service.save_schedule(data)


def default_schedule_history() -> dict:
    return merge_service.default_schedule_history()


def sanitize_schedule_history_items(items) -> list[dict]:
    return merge_service.sanitize_schedule_history_items(items)


def load_schedule_history() -> list[dict]:
    return merge_service.load_schedule_history()


def save_schedule_history(items: list[dict]) -> None:
    merge_service.save_schedule_history(items)


def append_schedule_history(
    trigger: str,
    do_reload: bool,
    status: str,
    message: str,
    started_at: str | None = None,
    ended_at: str | None = None,
) -> None:
    merge_service.append_schedule_history(
        trigger=trigger,
        do_reload=do_reload,
        status=status,
        message=message,
        started_at=started_at,
        ended_at=ended_at,
    )


def now_iso() -> str:
    return merge_service.now_iso()


def add_minutes_iso(minutes: int) -> str:
    return merge_service.add_minutes_iso(minutes)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"success": True, "time": datetime.now().isoformat()})


@app.route("/api/status", methods=["GET"])
def status():
    kernel_status_payload = collect_kernel_status()
    return jsonify(
        {
            "success": True,
            "admin_token_enabled": bool(ADMIN_TOKEN),
            "runtime": {
                "clash_api": CLASH_API,
                "core_bin": kernel_status_payload.get("core_bin"),
                "core_version": kernel_status_payload.get("core_version"),
            },
            "kernel": kernel_status_payload,
            "paths": {
                "base": str(BASE_DIR),
                "scripts": str(SCRIPTS_DIR),
                "config": str(CONFIG_FILE),
            },
        }
    )


@app.route("/api/kernel/status", methods=["GET"])
def kernel_status():
    return jsonify({"success": True, "data": collect_kernel_status()})


@app.route("/api/kernel/updates", methods=["GET"])
def kernel_update_history():
    try:
        limit = int(request.args.get("limit", "50"))
    except (TypeError, ValueError):
        limit = 50
    limit = max(1, min(200, limit))
    return jsonify({"success": True, "data": read_kernel_update_history(limit=limit)})


@app.route("/api/kernel/release/latest", methods=["GET"])
def kernel_release_latest():
    raw_repo = str(request.args.get("repo", DEFAULT_CORE_REPO)).strip()
    try:
        repo = normalize_core_repo(raw_repo)
        ensure_core_repo_allowed(repo)
    except Exception as exc:
        return json_error(str(exc), 400)

    try:
        arch = detect_core_arch()
        release_payload = fetch_core_release(repo=repo, tag=None)
        asset_payload = select_core_release_asset(release_payload=release_payload, arch=arch)
        expected_sha256, checksum_source = extract_expected_sha256(release_payload, asset_payload)
    except Exception as exc:
        return json_error(f"query release failed: {exc}", 500)

    return jsonify(
        {
            "success": True,
            "data": {
                "repo": repo,
                "arch": arch,
                "tag": str(release_payload.get("tag_name", "")).strip(),
                "name": str(release_payload.get("name", "")).strip(),
                "published_at": str(release_payload.get("published_at", "")).strip(),
                "asset_name": str(asset_payload.get("name", "")).strip(),
                "asset_size": int(asset_payload.get("size", 0) or 0),
                "checksum": expected_sha256,
                "checksum_source": checksum_source,
            },
        }
    )


@app.route("/api/actions/kernel/update", methods=["POST"])
@require_write_auth
def action_kernel_update():
    if not kernel_update_lock.acquire(blocking=False):
        return json_error("kernel update already running", 429)

    body = ensure_json_body()
    raw_repo = str(body.get("repo", body.get("source_repo", DEFAULT_CORE_REPO))).strip()
    raw_tag = str(body.get("tag", "")).strip()
    target_tag = raw_tag or None
    restart = parse_optional_bool(body.get("restart"))
    if restart is None:
        restart = True

    try:
        repo = normalize_core_repo(raw_repo)
        ensure_core_repo_allowed(repo)
    except Exception as exc:
        kernel_update_lock.release()
        return json_error(str(exc), 400)

    try:
        result = perform_kernel_update(repo=repo, tag=target_tag)
        append_kernel_update_history(
            {
                "status": "success",
                "repo": result.get("repo"),
                "release_tag": result.get("release_tag"),
                "asset_name": result.get("asset_name"),
                "old_version": result.get("old_version"),
                "new_version": result.get("new_version"),
                "checksum_source": result.get("checksum_source"),
                "sha256": result.get("checksum") or result.get("downloaded_sha256"),
            }
        )
        emit_log(
            (
                "kernel update success: "
                f"{result.get('old_version') or '-'} -> {result.get('new_version') or result.get('release_tag')}"
            ),
            "SUCCESS",
        )
    except Exception as exc:
        message = str(exc)
        append_kernel_update_history(
            {
                "status": "failed",
                "repo": repo,
                "release_tag": target_tag or "latest",
                "error": message,
            }
        )
        emit_log(f"kernel update failed: {message}", "ERROR")
        return json_error(f"kernel update failed: {message}", 500)
    finally:
        kernel_update_lock.release()

    restart_scheduled = False
    if restart:
        restart_scheduled = schedule_self_restart("kernel update success")
        if restart_scheduled:
            emit_log("kernel update: container restart requested", "WARN")
        else:
            emit_log("kernel update: restart already pending", "WARN")

    data = {**result, "restart_requested": bool(restart), "restart_scheduled": restart_scheduled}
    return jsonify({"success": True, "message": "kernel updated", "data": data})


def run_merge_job(do_reload: bool, trigger: str) -> tuple[bool, str]:
    return merge_service.run_merge_job(do_reload=do_reload, trigger=trigger)


def start_merge_job(do_reload: bool, trigger: str) -> bool:
    return merge_service.start_merge_job(do_reload=do_reload, trigger=trigger)


def scheduler_loop() -> None:
    merge_service.scheduler_loop()


@app.route("/api/subscriptions", methods=["GET"])
def get_subscriptions():
    subs = list_subscriptions()
    result = []
    for sub in subs:
        item = dict(sub)
        name = str(item.get("name", "")).strip()
        cache_file = SUBS_DIR / f"{name}.yaml"
        item["cached"] = cache_file.exists()
        if cache_file.exists():
            parsed = load_yaml(cache_file, {"proxies": []})
            proxies = parsed.get("proxies", [])
            item["node_count"] = len(proxies) if isinstance(proxies, list) else 0
            item["cached_time"] = datetime.fromtimestamp(cache_file.stat().st_mtime).strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        else:
            item["node_count"] = 0
            item["cached_time"] = None
        result.append(item)
    return jsonify({"success": True, "data": result})


@app.route("/api/subscription-sets", methods=["GET"])
def get_subscription_sets():
    data = load_subscription_sets()
    return jsonify({"success": True, "data": data})


@app.route("/api/subscription-sets", methods=["PUT"])
@require_write_auth
def put_subscription_sets():
    body = ensure_json_body()
    data = save_subscription_sets(body)
    sync_override_script_with_sets(data)
    us_auto = data.get("us_auto", {})
    p1 = str(us_auto.get("priority1", "")).strip()
    p2 = str(us_auto.get("priority2", "")).strip()
    emit_log(
        (
            "subscription sets updated: "
            f"set1={len(data['set1'])}, "
            f"set2={len(data['set2'])}, "
            f"us_auto_priority1={'set' if p1 else 'empty'}, "
            f"us_auto_priority2={'set' if p2 else 'empty'}"
        ),
        "INFO",
    )
    return jsonify({"success": True, "data": data})


@app.route("/api/schedule", methods=["GET"])
def get_schedule():
    with schedule_lock:
        data = load_schedule()
    return jsonify({"success": True, "data": data})


@app.route("/api/schedule", methods=["PUT"])
@require_write_auth
def put_schedule():
    body = ensure_json_body()
    with schedule_lock:
        current = load_schedule()
        old_enabled = bool(current.get("enabled", False))
        old_interval = int(current.get("interval_minutes", 60))
        current["enabled"] = bool(body.get("enabled", current["enabled"]))
        if "interval_minutes" in body:
            current["interval_minutes"] = body.get("interval_minutes")
        current = sanitize_schedule(current)
        enabled_changed = current["enabled"] != old_enabled
        interval_changed = current["interval_minutes"] != old_interval
        if current["enabled"] and (enabled_changed or interval_changed or not current.get("next_run")):
            # Keep scheduler behavior intuitive: changing interval/enabled should recalculate next run.
            current["next_run"] = add_minutes_iso(current["interval_minutes"])
        if not current["enabled"]:
            current["next_run"] = None
        saved = save_schedule(current)
    emit_log(
        f"schedule updated: enabled={saved['enabled']} interval={saved['interval_minutes']}m"
    )
    return jsonify({"success": True, "data": saved})


@app.route("/api/schedule/history", methods=["GET"])
def get_schedule_history():
    with history_lock:
        items = load_schedule_history()
    items = list(reversed(items))
    return jsonify({"success": True, "data": items})


@app.route("/api/schedule/history", methods=["DELETE"])
@require_write_auth
def clear_schedule_history():
    with history_lock:
        save_schedule_history([])
    emit_log("schedule history cleared")
    return jsonify({"success": True})


@app.route("/api/subscriptions", methods=["POST"])
@require_write_auth
def add_subscription():
    body = ensure_json_body()
    name = str(body.get("name", "")).strip()
    url = str(body.get("url", "")).strip()
    if not name or not url:
        return json_error("name and url are required", 400)
    if not ensure_safe_name(name):
        return json_error("name must match [A-Za-z0-9._-]{1,64}", 400)

    subs = list_subscriptions()
    if any(str(item.get("name")) == name for item in subs):
        return json_error("subscription already exists", 409)

    new_item = {
        "name": name,
        "url": url,
        "enabled": bool(body.get("enabled", True)),
        "prefix": str(body.get("prefix", "")),
        "exclude_filter": str(body.get("exclude_filter", "(?i)(expired|官网|剩余|流量)")),
        "include_filter": str(body.get("include_filter", "")),
    }
    subs.append(new_item)
    save_subscriptions(subs)
    emit_log(f"subscription added: {name}")
    return jsonify({"success": True, "data": new_item})


@app.route("/api/subscriptions/<name>", methods=["PUT"])
@require_write_auth
def update_subscription(name):
    if not ensure_safe_name(name):
        return json_error("invalid name", 400)
    body = ensure_json_body()
    subs = list_subscriptions()
    target = None
    for item in subs:
        if str(item.get("name")) == name:
            target = item
            break
    if target is None:
        return json_error("not found", 404)

    new_name = str(body.get("new_name", name)).strip()
    if not ensure_safe_name(new_name):
        return json_error("invalid new_name", 400)
    if new_name != name and any(str(item.get("name")) == new_name for item in subs):
        return json_error("new_name already exists", 409)

    for key in ["url", "prefix", "exclude_filter", "include_filter"]:
        if key in body:
            target[key] = str(body.get(key, ""))
    if "enabled" in body:
        target["enabled"] = bool(body.get("enabled"))

    if new_name != name:
        old_cache = SUBS_DIR / f"{name}.yaml"
        new_cache = SUBS_DIR / f"{new_name}.yaml"
        target["name"] = new_name
        if old_cache.exists():
            old_cache.rename(new_cache)

    save_subscriptions(subs)
    emit_log(f"subscription updated: {name}")
    return jsonify({"success": True})


@app.route("/api/subscriptions/<name>", methods=["DELETE"])
@require_write_auth
def delete_subscription(name):
    if not ensure_safe_name(name):
        return json_error("invalid name", 400)
    subs = list_subscriptions()
    new_subs = [item for item in subs if str(item.get("name")) != name]
    save_subscriptions(new_subs)
    cache_file = SUBS_DIR / f"{name}.yaml"
    if cache_file.exists():
        cache_file.unlink()
    emit_log(f"subscription deleted: {name}")
    return jsonify({"success": True})


@app.route("/api/subscriptions/<name>/toggle", methods=["POST"])
@require_write_auth
def toggle_subscription(name):
    if not ensure_safe_name(name):
        return json_error("invalid name", 400)
    subs = list_subscriptions()
    for item in subs:
        if str(item.get("name")) != name:
            continue
        item["enabled"] = not bool(item.get("enabled", True))
        save_subscriptions(subs)
        emit_log(f"subscription toggled: {name} -> {item['enabled']}")
        return jsonify({"success": True, "enabled": item["enabled"]})
    return json_error("not found", 404)


@app.route("/api/subscriptions/<name>/test", methods=["POST"])
@require_write_auth
def test_subscription(name):
    if not ensure_safe_name(name):
        return json_error("invalid name", 400)
    subs = list_subscriptions()
    target = next((item for item in subs if str(item.get("name")) == name), None)
    if not target:
        return json_error("not found", 404)
    try:
        resp = requests.get(
            str(target.get("url")),
            headers={"User-Agent": "clash-manager/1.0"},
            timeout=15,
        )
        resp.raise_for_status()
        parsed = yaml.safe_load(resp.text) or {}
        proxies = parsed.get("proxies", []) if isinstance(parsed, dict) else []
        sample = []
        if isinstance(proxies, list):
            sample = [str(item.get("name", "?")) for item in proxies[:10] if isinstance(item, dict)]
        return jsonify(
            {
                "success": True,
                "node_count": len(proxies) if isinstance(proxies, list) else 0,
                "sample_nodes": sample,
                "response_size": len(resp.text),
            }
        )
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)})


@app.route("/api/actions/merge", methods=["POST"])
@require_write_auth
def run_merge():
    started = start_merge_job(do_reload=False, trigger="manual")
    if not started:
        return json_error("merge already running", 429)
    return jsonify({"success": True, "message": "merge launched"})


@app.route("/api/actions/reload", methods=["POST"])
@require_write_auth
def action_reload():
    ok = reload_clash()
    if ok:
        emit_log("clash reloaded", "SUCCESS")
    else:
        emit_log("clash reload failed", "ERROR")
    return jsonify({"success": ok})


@app.route("/api/actions/merge-and-reload", methods=["POST"])
@require_write_auth
def merge_and_reload():
    started = start_merge_job(do_reload=True, trigger="manual")
    if not started:
        return json_error("merge already running", 429)
    return jsonify({"success": True, "message": "merge+reload launched"})


@app.route("/api/clash/status", methods=["GET"])
def clash_status():
    try:
        resp = requests.get(CLASH_API, headers=clash_headers(), timeout=3)
        info = resp.json()
        return jsonify(
            {
                "success": True,
                "running": True,
                "version": info.get("version", "unknown"),
                "mode": info.get("mode", "unknown"),
            }
        )
    except Exception:
        return jsonify({"success": True, "running": False})


@app.route("/api/clash/traffic", methods=["GET"])
def clash_traffic():
    try:
        resp = requests.get(
            f"{CLASH_API}/traffic",
            headers=clash_headers(),
            timeout=(3, 3),
            stream=True,
        )
        if resp.status_code != 200:
            return json_error(f"clash api error: {resp.status_code}", 502)

        payload = {}
        # Some runtimes expose /traffic as a streaming endpoint (JSON lines).
        # Read the first non-empty line and parse it as the current snapshot.
        try:
            for line in resp.iter_lines(chunk_size=1, decode_unicode=True):
                line_text = str(line or "").strip()
                if not line_text:
                    continue
                loaded = json.loads(line_text)
                if isinstance(loaded, dict):
                    payload = loaded
                break
        finally:
            resp.close()

        if not payload:
            # Fallback for adapters that do not yield promptly via iter_lines.
            resp2 = requests.get(
                f"{CLASH_API}/traffic",
                headers=clash_headers(),
                timeout=(3, 3),
                stream=True,
            )
            try:
                raw_line = resp2.raw.readline()
                if isinstance(raw_line, bytes):
                    line_text = raw_line.decode("utf-8", errors="ignore").strip()
                else:
                    line_text = str(raw_line or "").strip()
                if line_text:
                    loaded = json.loads(line_text)
                    if isinstance(loaded, dict):
                        payload = loaded
            finally:
                resp2.close()

        raw_speed_up = payload.get("up", 0)
        raw_speed_down = payload.get("down", 0)
        raw_total_up = payload.get("upTotal", raw_speed_up)
        raw_total_down = payload.get("downTotal", raw_speed_down)
        try:
            speed_up = max(0, int(raw_speed_up))
        except Exception:
            speed_up = 0
        try:
            speed_down = max(0, int(raw_speed_down))
        except Exception:
            speed_down = 0
        try:
            total_up = max(0, int(raw_total_up))
        except Exception:
            total_up = 0
        try:
            total_down = max(0, int(raw_total_down))
        except Exception:
            total_down = 0

        return jsonify(
            {
                "success": True,
                "data": {
                    # Backward compatible keys used by existing dashboard logic.
                    "up": total_up,
                    "down": total_down,
                    # Explicit keys for clarity and future UI usage.
                    "up_total": total_up,
                    "down_total": total_down,
                    "speed_up": speed_up,
                    "speed_down": speed_down,
                },
            }
        )
    except Exception as exc:
        return json_error(f"failed to load traffic: {exc}", 500)


@app.route("/api/clash/config", methods=["GET"])
def get_clash_config():
    try:
        resp = requests.get(f"{CLASH_API}/configs", headers=clash_headers(), timeout=5)
        if resp.status_code != 200:
            return json_error(f"clash api error: {resp.status_code}", 502)

        payload = resp.json() if resp.content else {}
        if not isinstance(payload, dict):
            payload = {}

        mode = str(payload.get("mode", "rule")).strip().lower() or "rule"
        if mode not in {"rule", "global", "direct"}:
            mode = "rule"

        allow_lan = parse_optional_bool(payload.get("allow-lan"))
        if allow_lan is None:
            allow_lan = False

        bind_address = str(payload.get("bind-address", "")).strip()
        external_controller = str(payload.get("external-controller", "")).strip()
        http_port = parse_optional_port(payload.get("port"))
        mixed_port = parse_optional_port(payload.get("mixed-port"))
        socks_port = parse_optional_port(payload.get("socks-port"))

        tun_enabled = False
        tun_payload = payload.get("tun")
        if isinstance(tun_payload, dict):
            parsed = parse_optional_bool(tun_payload.get("enable"))
            if parsed is not None:
                tun_enabled = parsed
        elif parse_optional_bool(tun_payload) is not None:
            tun_enabled = bool(parse_optional_bool(tun_payload))

        return jsonify(
            {
                "success": True,
                "data": {
                    "mode": mode,
                    "allow_lan": bool(allow_lan),
                    "bind_address": bind_address,
                    "external_controller": external_controller,
                    "http_port": http_port,
                    "mixed_port": mixed_port,
                    "socks_port": socks_port,
                    "tun_enabled": bool(tun_enabled),
                },
            }
        )
    except Exception as exc:
        return json_error(f"failed to read clash config: {exc}", 500)


@app.route("/api/clash/config", methods=["PUT"])
@require_write_auth
def put_clash_config():
    body = ensure_json_body()
    payload: dict = {}
    changed_items: list[str] = []

    if "mode" in body:
        mode = str(body.get("mode", "")).strip().lower()
        if mode not in {"rule", "global", "direct"}:
            return json_error("invalid mode", 400)
        payload["mode"] = mode
        changed_items.append(f"mode={mode}")

    allow_lan_raw = body.get("allow_lan", body.get("allow-lan"))
    allow_lan = parse_optional_bool(allow_lan_raw)
    if allow_lan is not None:
        payload["allow-lan"] = allow_lan
        changed_items.append(f"allow-lan={str(allow_lan).lower()}")

    bind_address_raw = body.get("bind_address", body.get("bind-address"))
    if bind_address_raw is not None:
        bind_address = str(bind_address_raw).strip()
        if not bind_address:
            return json_error("bind_address is required when provided", 400)
        payload["bind-address"] = bind_address
        changed_items.append(f"bind-address={bind_address}")

    # Enabling LAN proxy usually requires wildcard bind address.
    if (
        allow_lan is True
        and "bind-address" not in payload
    ):
        payload["bind-address"] = "*"
        changed_items.append("bind-address=*")

    tun_enabled_raw = body.get("tun_enabled", body.get("tun-enabled"))
    tun_enabled = parse_optional_bool(tun_enabled_raw)
    if tun_enabled is not None:
        payload["tun"] = {"enable": tun_enabled}
        changed_items.append(f"tun.enable={str(tun_enabled).lower()}")

    if not payload:
        return json_error("no valid config fields", 400)

    try:
        resp = _apply_clash_config_patch(payload, timeout=5)
        if resp.status_code not in (200, 204):
            return json_error(f"clash api error: {resp.status_code}", 502)

        emit_log(f"clash config updated: {', '.join(changed_items)}")
        return jsonify({"success": True, "data": payload})
    except Exception as exc:
        return json_error(f"failed to update clash config: {exc}", 500)


def _apply_clash_config_patch(payload: dict, timeout: float = 5):
    resp = requests.patch(
        f"{CLASH_API}/configs",
        headers=clash_headers(),
        json=payload,
        timeout=timeout,
    )
    if resp.status_code not in (200, 204) and resp.status_code in (404, 405, 501):
        # Compatibility fallback for runtimes that only accept PUT /configs.
        resp = requests.put(
            f"{CLASH_API}/configs",
            headers=clash_headers(),
            json=payload,
            timeout=timeout,
        )
    return resp


def _clash_delay_request(
    proxy_name: str,
    test_url: str = "http://www.gstatic.com/generate_204",
    timeout_ms: int = 6000,
) -> tuple[bool, int, str]:
    return geo_service.clash_delay_request(
        proxy_name=proxy_name,
        test_url=test_url,
        timeout_ms=timeout_ms,
    )


def _fetch_rule_provider_rows() -> tuple[list[dict], str]:
    return geo_service.fetch_rule_provider_rows()


def _geo_proxy_check(
    test_url: str = "http://www.gstatic.com/generate_204",
    timeout_ms: int = 6000,
) -> dict:
    return geo_service.geo_proxy_check(test_url=test_url, timeout_ms=timeout_ms)


def _infer_geo_new_data(message: str) -> str:
    return geo_service.infer_geo_new_data(message=message)


def _format_geo_db_summary(geo_item: dict) -> str:
    return geo_service.format_geo_db_summary(geo_item=geo_item)


def _clash_request_with_retry(
    method: str,
    path: str,
    timeout: float,
    attempts: int = 1,
) -> tuple[requests.Response | None, str]:
    return geo_service.clash_request_with_retry(
        method=method,
        path=path,
        timeout=timeout,
        attempts=attempts,
    )


def _response_error_text(response: requests.Response) -> str:
    return geo_service.response_error_text(response=response)


def _perform_geo_db_update() -> dict:
    return geo_service.perform_geo_db_update()


def _empty_rule_provider_update_result() -> dict:
    return geo_service.empty_rule_provider_update_result()


def _update_rule_providers() -> dict:
    return geo_service.update_rule_providers()


def _compose_geo_update_result(
    check_result: dict,
    geo_db_result: dict,
    provider_result: dict,
    *,
    update_geo_db: bool,
    update_rule_providers: bool,
) -> dict:
    return geo_service.compose_geo_update_result(
        check_result=check_result,
        geo_db_result=geo_db_result,
        provider_result=provider_result,
        update_geo_db=update_geo_db,
        update_rule_providers=update_rule_providers,
    )


@app.route("/api/clash/geo/settings", methods=["PUT"])
@require_write_auth
def put_geo_settings():
    body = ensure_json_body()
    payload: dict = {}
    changed_items: list[str] = []

    auto_update_raw = body.get("geo_auto_update", body.get("geo-auto-update"))
    auto_update = parse_optional_bool(auto_update_raw)
    if auto_update is not None:
        payload["geo-auto-update"] = auto_update
        changed_items.append(f"geo-auto-update={str(auto_update).lower()}")

    interval_raw = body.get("geo_update_interval", body.get("geo-update-interval"))
    if interval_raw is not None:
        try:
            interval_hours = int(interval_raw)
        except Exception:
            return json_error("geo_update_interval must be integer", 400)
        # Keep it practical while preventing accidental extreme values.
        interval_hours = max(1, min(720, interval_hours))
        payload["geo-update-interval"] = interval_hours
        changed_items.append(f"geo-update-interval={interval_hours}h")

    if not payload:
        return json_error("no valid geo setting fields", 400)

    try:
        resp = _apply_clash_config_patch(payload, timeout=5)
        if resp.status_code not in (200, 204):
            return json_error(f"clash api error: {resp.status_code}", 502)

        # Read back runtime value. Some cores acknowledge but don't apply these fields dynamically.
        verify_resp = requests.get(f"{CLASH_API}/configs", headers=clash_headers(), timeout=5)
        runtime_applied = False
        runtime_values: dict = {}
        if verify_resp.status_code == 200:
            runtime_payload = verify_resp.json() if verify_resp.content else {}
            if isinstance(runtime_payload, dict):
                runtime_values = runtime_payload
                runtime_applied = True
                if "geo-auto-update" in payload:
                    runtime_applied = runtime_applied and (
                        parse_optional_bool(runtime_values.get("geo-auto-update"))
                        == bool(payload["geo-auto-update"])
                    )
                if "geo-update-interval" in payload:
                    try:
                        runtime_interval = int(runtime_values.get("geo-update-interval"))
                    except Exception:
                        runtime_interval = -1
                    runtime_applied = runtime_applied and (
                        runtime_interval == int(payload["geo-update-interval"])
                    )

        reloaded = False
        applied_via = "runtime"
        if not runtime_applied:
            # Fallback: persist to current config file then reload clash.
            config_payload = load_yaml(CONFIG_FILE, {})
            if not isinstance(config_payload, dict):
                config_payload = {}
            config_payload.update(payload)
            make_backup(CONFIG_FILE, "geo_settings")
            save_yaml(CONFIG_FILE, config_payload)
            reloaded = reload_clash()
            applied_via = "config_reload"
            if not reloaded:
                emit_log("geo settings fallback reload failed", "WARN")

        emit_log(
            f"geo settings updated: {', '.join(changed_items)} (via={applied_via}, reload={reloaded})"
        )
        return jsonify(
            {
                "success": True,
                "data": payload,
                "applied_via": applied_via,
                "reloaded": reloaded,
            }
        )
    except Exception as exc:
        return json_error(f"failed to update geo settings: {exc}", 500)


@app.route("/api/clash/geo/status", methods=["GET"])
def clash_geo_status():
    try:
        config_resp = requests.get(f"{CLASH_API}/configs", headers=clash_headers(), timeout=6)
        if config_resp.status_code != 200:
            return json_error(f"clash api error: {config_resp.status_code}", 502)
        config_payload = config_resp.json() if config_resp.content else {}
        if not isinstance(config_payload, dict):
            config_payload = {}
    except Exception as exc:
        return json_error(f"failed to load clash config: {exc}", 500)

    geo_auto_update = parse_optional_bool(config_payload.get("geo-auto-update"))
    if geo_auto_update is None:
        geo_auto_update = False

    geodata_mode = parse_optional_bool(config_payload.get("geodata-mode"))
    if geodata_mode is None:
        geodata_mode = False

    interval_raw = config_payload.get("geo-update-interval", 24)
    try:
        geo_update_interval = max(1, int(interval_raw))
    except Exception:
        geo_update_interval = 24

    rows, rows_error = _fetch_rule_provider_rows()

    return jsonify(
        {
            "success": True,
            "data": {
                "config": {
                    "geo_auto_update": bool(geo_auto_update),
                    "geo_update_interval": geo_update_interval,
                    "geodata_mode": bool(geodata_mode),
                    "geodata_loader": str(config_payload.get("geodata-loader", "")),
                    "geosite_matcher": str(config_payload.get("geosite-matcher", "")),
                    "geox_url": config_payload.get("geox-url", {}),
                },
                "rule_providers": rows,
                "rule_providers_error": rows_error or "",
            },
        }
    )


@app.route("/api/clash/geo/check", methods=["GET"])
def clash_geo_check():
    timeout_raw = request.args.get("timeout", 6000)
    try:
        timeout_ms = int(timeout_raw)
    except Exception:
        timeout_ms = 6000
    timeout_ms = max(1000, min(20000, timeout_ms))
    test_url = str(request.args.get("url") or "http://www.gstatic.com/generate_204").strip()
    if not test_url:
        test_url = "http://www.gstatic.com/generate_204"
    result = _geo_proxy_check(test_url=test_url, timeout_ms=timeout_ms)
    return jsonify({"success": True, "data": result})


@app.route("/api/actions/geo/update", methods=["POST"])
@require_write_auth
def action_geo_update():
    body = ensure_json_body()
    check_proxy = parse_optional_bool(body.get("check_proxy"))
    if check_proxy is None:
        check_proxy = True
    update_geo_db = parse_optional_bool(body.get("update_geo_db"))
    if update_geo_db is None:
        update_geo_db = True
    update_rule_providers = parse_optional_bool(body.get("update_rule_providers"))
    if update_rule_providers is None:
        update_rule_providers = True

    check_result = {
        "ok": True,
        "message": "skipped",
        "tested_url": "http://www.gstatic.com/generate_204",
        "attempts": [],
    }
    if check_proxy:
        check_result = _geo_proxy_check()

    if check_proxy and not bool(check_result.get("ok")):
        cancel_message = "代理连通性检查未通过，已取消 GEO 更新"
        return jsonify(
            {
                "success": True,
                "data": {
                    "ok": False,
                    "message": cancel_message,
                    "new_data": "unknown",
                    "check": check_result,
                    "geo_db": {
                        "status": "skipped",
                        "message": "skipped by failed check",
                        "new_data": "unknown",
                    },
                    "rule_providers": {
                        "total": 0,
                        "updated": 0,
                        "failed": 0,
                        "changed": 0,
                        "unchanged": 0,
                        "unknown": 0,
                        "compare_error": "",
                        "items": [],
                    },
                    "update_summary": {
                        "overall_ok": False,
                        "overall_status": "failed",
                        "new_data": "unknown",
                        "message": cancel_message,
                        "geo_db": "GEO 库：未执行（代理检查未通过）",
                        "rules": "规则提供者：未执行",
                        "failed_rules": [],
                    },
                },
            }
        )

    geo_db_result = (
        _perform_geo_db_update()
        if update_geo_db
        else {"status": "skipped", "message": "not requested", "new_data": "unknown"}
    )
    provider_result = (
        _update_rule_providers() if update_rule_providers else _empty_rule_provider_update_result()
    )

    result = _compose_geo_update_result(
        check_result,
        geo_db_result,
        provider_result,
        update_geo_db=update_geo_db,
        update_rule_providers=update_rule_providers,
    )

    summary_parts = [f"ok={result['ok']}"]
    summary_parts.append(f"new_data={result['new_data']}")
    if update_geo_db:
        summary_parts.append(f"geo_db={geo_db_result['status']}")
        summary_parts.append(f"geo_new={geo_db_result.get('new_data', 'unknown')}")
    if update_rule_providers:
        summary_parts.append(f"rules={provider_result['updated']}/{provider_result['total']}")
        summary_parts.append(
            f"rules_changed={provider_result['changed']},"
            f"rules_unchanged={provider_result['unchanged']}"
        )
        if provider_result["failed"]:
            summary_parts.append(f"rules_failed={provider_result['failed']}")
        failed_names = provider_result.get("failed_names", [])
        if failed_names:
            summary_parts.append(f"failed_names={'|'.join(failed_names[:3])}")
        if provider_result.get("compare_error"):
            summary_parts.append("rules_compare=failed")
    emit_log(f"geo update finished: {', '.join(summary_parts)}")

    return jsonify({"success": True, "data": result})


@app.route("/api/clash/groups", methods=["GET"])
def clash_groups():
    try:
        resp = requests.get(f"{CLASH_API}/proxies", headers=clash_headers(), timeout=5)
        data = resp.json()
        proxies = data.get("proxies", {})
        groups = []
        for group_name, item in proxies.items():
            if not isinstance(item, dict):
                continue
            options = item.get("all")
            now = item.get("now")
            if not isinstance(options, list):
                continue
            groups.append(
                {
                    "name": group_name,
                    "type": item.get("type", "selector"),
                    "now": now,
                    "all": options,
                }
            )
        groups.sort(key=lambda x: x["name"])
        return jsonify({"success": True, "data": groups})
    except Exception as exc:
        return json_error(f"failed to load groups: {exc}", 500)


@app.route("/api/clash/proxy-meta", methods=["GET"])
def clash_proxy_meta():
    try:
        resp = requests.get(f"{CLASH_API}/proxies", headers=clash_headers(), timeout=6)
        if resp.status_code != 200:
            return json_error(f"clash api error: {resp.status_code}", 502)

        payload = resp.json() if resp.content else {}
        proxies = payload.get("proxies", {}) if isinstance(payload, dict) else {}
        if not isinstance(proxies, dict):
            proxies = {}

        mapping: dict[str, str] = {}
        for proxy_name, item in proxies.items():
            if not isinstance(item, dict):
                continue
            provider_name = str(item.get("provider-name", "")).strip()
            if not provider_name:
                continue
            mapping[str(proxy_name)] = provider_name

        return jsonify({"success": True, "data": mapping})
    except Exception as exc:
        return json_error(f"failed to load proxy metadata: {exc}", 500)


@app.route("/api/clash/providers", methods=["GET"])
def clash_proxy_providers():
    try:
        rows = fetch_provider_rows(timeout=8)
        return jsonify({"success": True, "data": rows})
    except Exception as exc:
        return json_error(f"failed to load providers: {exc}", 500)


@app.route("/api/clash/proxies/delay", methods=["GET", "POST"])
def clash_proxy_delay():
    body = ensure_json_body()
    proxy_name = str(body.get("name") or request.args.get("name", "")).strip()
    if not proxy_name:
        return json_error("name is required", 400)

    test_url = str(
        body.get("url")
        or request.args.get("url")
        or "http://www.gstatic.com/generate_204"
    ).strip()
    if not test_url:
        test_url = "http://www.gstatic.com/generate_204"

    timeout_ms = body.get("timeout")
    if timeout_ms is None:
        timeout_ms = request.args.get("timeout", 6000)
    try:
        timeout_ms = int(timeout_ms)
    except Exception:
        timeout_ms = 6000
    timeout_ms = max(1000, min(20000, timeout_ms))

    encoded = quote(proxy_name, safe="")
    request_timeout = max(3.0, timeout_ms / 1000.0 + 2.0)
    try:
        resp = requests.get(
            f"{CLASH_API}/proxies/{encoded}/delay",
            headers=clash_headers(),
            params={"url": test_url, "timeout": timeout_ms},
            timeout=request_timeout,
        )
        if resp.status_code != 200:
            return json_error(f"clash api error: {resp.status_code}", 502)

        data = resp.json() if resp.content else {}
        delay = data.get("delay", None) if isinstance(data, dict) else None
        delay_ms = -1
        if delay is not None:
            try:
                delay_ms = int(delay)
            except Exception:
                delay_ms = -1

        return jsonify(
            {
                "success": True,
                "name": proxy_name,
                "delay": delay_ms,
                "url": test_url,
                "timeout": timeout_ms,
            }
        )
    except Exception as exc:
        return json_error(f"failed to test delay: {exc}", 500)


@app.route("/api/clash/groups/<group_name>/select", methods=["POST"])
@require_write_auth
def clash_group_select(group_name):
    body = ensure_json_body()
    target = str(body.get("name", "")).strip()
    if not target:
        return json_error("name is required", 400)
    encoded = quote(group_name, safe="")
    try:
        resp = requests.put(
            f"{CLASH_API}/proxies/{encoded}",
            headers=clash_headers(),
            json={"name": target},
            timeout=5,
        )
        if resp.status_code not in (200, 204):
            return json_error(f"clash api error: {resp.status_code}", 502)
        emit_log(f"group switched: {group_name} -> {target}")
        return jsonify({"success": True})
    except Exception as exc:
        return json_error(str(exc), 500)


@app.route("/api/override", methods=["GET"])
def get_override():
    return jsonify({"success": True, "content": read_text(OVERRIDE_FILE)})


@app.route("/api/override", methods=["PUT"])
@require_write_auth
def put_override():
    body = ensure_json_body()
    content = str(body.get("content", ""))
    try:
        yaml.safe_load(content)
    except yaml.YAMLError as exc:
        return json_error(f"yaml error: {exc}", 400)
    make_backup(OVERRIDE_FILE, "override")
    write_text(OVERRIDE_FILE, content)
    emit_log("override.yaml updated")
    return jsonify({"success": True})


@app.route("/api/override-script", methods=["GET"])
def get_override_script():
    return jsonify({"success": True, "content": read_text(OVERRIDE_SCRIPT_FILE)})


@app.route("/api/override-script", methods=["PUT"])
@require_write_auth
def put_override_script():
    body = ensure_json_body()
    content = str(body.get("content", ""))
    ok, reason = validate_js_override(content, node_bin=NODE_BIN, timeout=JS_VALIDATE_TIMEOUT)
    if not ok:
        return json_error(f"javascript error: {reason}", 400)
    make_backup(OVERRIDE_SCRIPT_FILE, "override_js")
    write_text(OVERRIDE_SCRIPT_FILE, content)
    emit_log("override.js updated")
    return jsonify({"success": True})


@app.route("/api/site-policy", methods=["GET"])
def get_site_policy():
    return jsonify({"success": True, "content": read_text(SITE_POLICY_FILE)})


@app.route("/api/site-policy", methods=["PUT"])
@require_write_auth
def put_site_policy():
    body = ensure_json_body()
    content = str(body.get("content", ""))
    try:
        parsed = yaml.safe_load(content) or {}
        if not isinstance(parsed, dict):
            return json_error("site policy must be yaml object", 400)
    except yaml.YAMLError as exc:
        return json_error(f"yaml error: {exc}", 400)
    make_backup(SITE_POLICY_FILE, "site_policy")
    write_text(SITE_POLICY_FILE, content)
    emit_log("site_policy.yaml updated")
    return jsonify({"success": True})


@app.route("/api/template", methods=["GET"])
def get_template():
    return jsonify({"success": True, "content": read_text(TEMPLATE_FILE)})


@app.route("/api/template", methods=["PUT"])
@require_write_auth
def put_template():
    body = ensure_json_body()
    content = str(body.get("content", ""))
    try:
        yaml.safe_load(content)
    except yaml.YAMLError as exc:
        return json_error(f"yaml error: {exc}", 400)
    make_backup(TEMPLATE_FILE, "template")
    write_text(TEMPLATE_FILE, content)
    emit_log("template.yaml updated")
    return jsonify({"success": True})


@app.route("/api/merge-script", methods=["GET"])
def get_merge_script():
    return jsonify({"success": True, "content": read_text(MERGE_SCRIPT_FILE)})


@app.route("/api/merge-script", methods=["PUT"])
@require_write_auth
def put_merge_script():
    body = ensure_json_body()
    content = str(body.get("content", ""))
    try:
        compile(content, str(MERGE_SCRIPT_FILE), "exec")
    except SyntaxError as exc:
        return json_error(f"python error: {exc}", 400)
    make_backup(MERGE_SCRIPT_FILE, "merge")
    write_text(MERGE_SCRIPT_FILE, content)
    emit_log("merge.py updated")
    return jsonify({"success": True})


@app.route("/api/config", methods=["GET"])
def get_config():
    return jsonify({"success": True, "content": read_text(CONFIG_FILE)})


EDITABLE_FILES = {
    "subscriptions": SUBS_CONFIG,
    "subscription_sets": SUBSCRIPTION_SETS_FILE,
    "override": OVERRIDE_FILE,
    "override_script": OVERRIDE_SCRIPT_FILE,
    "site_policy": SITE_POLICY_FILE,
    "schedule": SCHEDULE_FILE,
    "schedule_history": SCHEDULE_HISTORY_FILE,
    "template": TEMPLATE_FILE,
    "merge_script": MERGE_SCRIPT_FILE,
    "config": CONFIG_FILE,
}


@app.route("/api/files", methods=["GET"])
def list_files():
    data = []
    for key, path in EDITABLE_FILES.items():
        data.append(
            {
                "key": key,
                "path": str(path),
                "exists": path.exists(),
                "size": path.stat().st_size if path.exists() else 0,
                "modified": datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                if path.exists()
                else None,
            }
        )
    return jsonify({"success": True, "data": data})


@app.route("/api/files/<key>", methods=["GET"])
def get_file(key):
    path = EDITABLE_FILES.get(key)
    if not path:
        return json_error("unknown key", 404)
    return jsonify({"success": True, "path": str(path), "content": read_text(path)})


@app.route("/api/files/<key>", methods=["PUT"])
@require_write_auth
def put_file(key):
    path = EDITABLE_FILES.get(key)
    if not path:
        return json_error("unknown key", 404)
    body = ensure_json_body()
    content = str(body.get("content", ""))

    suffix = path.suffix.lower()
    try:
        if suffix in (".yaml", ".yml"):
            yaml.safe_load(content)
        elif suffix == ".json":
            json.loads(content)
        elif suffix == ".py":
            compile(content, str(path), "exec")
        elif suffix == ".js":
            ok, reason = validate_js_override(content, node_bin=NODE_BIN, timeout=JS_VALIDATE_TIMEOUT)
            if not ok:
                raise ValueError(reason)
    except Exception as exc:
        return json_error(f"validation failed: {exc}", 400)

    make_backup(path, key)
    write_text(path, content)
    emit_log(f"file updated: {key}")
    return jsonify({"success": True})


@app.route("/api/logs", methods=["GET"])
def get_logs():
    items = get_recent_logs(limit=200)
    return jsonify({"success": True, "data": items})


@app.route("/api/logs/stream", methods=["GET"])
def log_stream():
    def generate():
        q, history = subscribe_log_queue(maxsize=128, history_limit=30)
        try:
            for item in history:
                yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
            while True:
                try:
                    item = q.get(timeout=25)
                    yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
                except queue.Empty:
                    yield ": ping\n\n"
        finally:
            unsubscribe_log_queue(q)

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/api/backups", methods=["GET"])
def backups():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for item in sorted(BACKUP_DIR.glob("*"), reverse=True):
        if not item.is_file():
            continue
        rows.append(
            {
                "name": item.name,
                "size": item.stat().st_size,
                "time": datetime.fromtimestamp(item.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            }
        )
    return jsonify({"success": True, "data": rows})


@app.route("/api/backups/<name>", methods=["DELETE"])
@require_write_auth
def delete_backup(name):
    if "/" in name or "\\" in name:
        return json_error("invalid backup name", 400)
    backup_file = BACKUP_DIR / name
    if backup_file.exists() and backup_file.is_file():
        backup_file.unlink()
        emit_log(f"backup deleted: {name}")
    return jsonify({"success": True})


@app.route("/api/backups/<name>/restore", methods=["POST"])
@require_write_auth
def restore_backup(name):
    if "/" in name or "\\" in name:
        return json_error("invalid backup name", 400)
    backup_file = BACKUP_DIR / name
    if not backup_file.exists() or not backup_file.is_file():
        return json_error("backup not found", 404)
    shutil.copy2(backup_file, CONFIG_FILE)
    ok = reload_clash()
    emit_log(f"backup restored: {name} (reload={ok})")
    return jsonify({"success": True, "reloaded": ok})


def bootstrap_files():
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    SUBS_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    MIHOMO_CORE_DIR.mkdir(parents=True, exist_ok=True)
    if not SUBS_CONFIG.exists():
        save_json(SUBS_CONFIG, {"subscriptions": []})
    if not SUBSCRIPTION_SETS_FILE.exists():
        save_json(SUBSCRIPTION_SETS_FILE, default_subscription_sets())
    if not SCHEDULE_FILE.exists():
        save_json(SCHEDULE_FILE, default_schedule())
    if not SCHEDULE_HISTORY_FILE.exists():
        save_json(SCHEDULE_HISTORY_FILE, default_schedule_history())
    if not PROVIDER_RECOVERY_FILE.exists():
        save_json(PROVIDER_RECOVERY_FILE, default_provider_recovery_state())
    if not SITE_POLICY_FILE.exists():
        save_yaml(
            SITE_POLICY_FILE,
            {
                "groups": [{"name": "AI", "type": "select", "use_all_proxies": True}],
                "rules": [
                    "DOMAIN-SUFFIX,openai.com,AI",
                    "DOMAIN-SUFFIX,chatgpt.com,AI",
                ],
            },
        )
    if not OVERRIDE_FILE.exists():
        save_yaml(
            OVERRIDE_FILE,
            {
                "dns": {
                    "enable": True,
                    "listen": "0.0.0.0:1053",
                    "enhanced-mode": "fake-ip",
                }
            },
        )
    if not OVERRIDE_SCRIPT_FILE.exists():
        write_text(
            OVERRIDE_SCRIPT_FILE,
            "\n".join(
                [
                    "// JS override script",
                    "// Must define: const main = (config) => config",
                    "const main = (config) => {",
                    "  config ??= {};",
                    "  config.mode = config.mode || \"rule\";",
                    "  return config;",
                    "};",
                    "",
                ]
            ),
        )
    sync_override_script_with_sets(load_subscription_sets())
    proxy_record_store.ensure_file()


# ==================== Proxy Records ====================

proxy_record_store = ProxyRecordStore(PROXY_RECORDS_FILE, max_records=MAX_PROXY_RECORDS)
connection_recorder: ClashConnectionRecorder | None = None


@app.route("/api/proxy-records", methods=["GET"])
def get_proxy_records():
    """获取代理记录列表，支持筛选"""
    try:
        keyword = request.args.get("keyword", "").strip()
        subscription = request.args.get("subscription", "").strip()
        record_type = request.args.get("type", "").strip()
        app_name = request.args.get("app", "").strip()
        host = request.args.get("host", "").strip()
        limit = request.args.get("limit", 100)
        result, stats = proxy_record_store.query_records(
            keyword=keyword,
            subscription=subscription,
            record_type=record_type,
            app_name=app_name,
            host=host,
            limit=limit,
        )

        return jsonify({"success": True, "data": result, "stats": stats})
    except Exception as exc:
        return json_error(f"failed to load proxy records: {exc}", 500)


@app.route("/api/proxy-records", methods=["POST"])
@require_write_auth
def add_proxy_record():
    """添加代理记录"""
    body = ensure_json_body()
    try:
        ok, record = proxy_record_store.add_record(body)
        if ok and record is not None:
            return jsonify({"success": True, "record": record})
        return json_error("failed to save proxy record", 500)
    except Exception as exc:
        return json_error(f"failed to add proxy record: {exc}", 500)


@app.route("/api/proxy-records/<record_id>", methods=["DELETE"])
@require_write_auth
def delete_proxy_record(record_id):
    """删除指定代理记录"""
    try:
        ok, found = proxy_record_store.delete_record(record_id)
        if not found:
            return json_error("record not found", 404)
        if ok:
            return jsonify({"success": True})
        return json_error("failed to save proxy records", 500)
    except Exception as exc:
        return json_error(f"failed to delete proxy record: {exc}", 500)


@app.route("/api/proxy-records/clear", methods=["POST"])
@require_write_auth
def clear_proxy_records():
    """清空所有代理记录"""
    try:
        body = ensure_json_body() or {}
        confirm = str(body.get("confirm", ""))
        if confirm != "yes":
            return json_error("confirmation required", 400)

        if proxy_record_store.clear_records():
            emit_log("proxy records cleared")
            return jsonify({"success": True})
        return json_error("failed to clear proxy records", 500)
    except Exception as exc:
        return json_error(f"failed to clear proxy records: {exc}", 500)


@app.route("/api/proxy-records/stats", methods=["GET"])
def get_proxy_records_stats():
    """获取代理记录统计信息"""
    try:
        return jsonify({"success": True, "data": proxy_record_store.get_stats()})
    except Exception as exc:
        return json_error(f"failed to get proxy records stats: {exc}", 500)


@app.route("/api/proxy-records/capture", methods=["POST"])
@require_write_auth
def capture_proxy_records():
    """手动采样一次连接记录"""
    if not CONNECTION_RECORD_ENABLED or connection_recorder is None:
        return json_error("connection recorder disabled", 400)
    try:
        captured = int(connection_recorder.capture_once())
        return jsonify({"success": True, "captured": captured})
    except Exception as exc:
        return json_error(f"capture failed: {exc}", 500)


@app.route("/api/proxy-records/recorder", methods=["GET"])
def get_proxy_recorder_status():
    data = {
        "enabled": bool(CONNECTION_RECORD_ENABLED),
        "running": False,
        "poll_interval": CONNECTION_RECORD_INTERVAL,
        "active_connections": 0,
    }
    if connection_recorder is not None:
        status = connection_recorder.status()
        if isinstance(status, dict):
            data.update(status)
    return jsonify({"success": True, "data": data})


# === WEB ENTRY ===
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def web_entry(path: str):
    # Skip API-like paths so explicit routes handle them.
    if (
        path in {"api", "clash-api", "logs"}
        or path.startswith("api/")
        or path.startswith("clash-api/")
        or path.startswith("logs/")
    ):
        return json_error("not found", 404)

    if not WEB_DIR.exists():
        return json_error(f"web dir not found: {WEB_DIR}", 404)

    safe_root = WEB_DIR.resolve()
    target = (safe_root / path).resolve()
    inside_root = target == safe_root or safe_root in target.parents

    if path and inside_root and target.exists() and target.is_file():
        return send_from_directory(str(safe_root), path)

    index_file = safe_root / "index.html"
    if index_file.exists():
        return send_from_directory(str(safe_root), "index.html")
    return json_error("index.html not found", 404)


runtime_init_lock = threading.Lock()
runtime_initialized = False


def start_runtime_services() -> None:
    global runtime_initialized, connection_recorder
    with runtime_init_lock:
        if runtime_initialized:
            return
        bootstrap_files()
        threading.Thread(target=scheduler_loop, daemon=True).start()
        threading.Thread(target=provider_auto_recovery_loop, daemon=True).start()
        if CONNECTION_RECORD_ENABLED:
            connection_recorder = ClashConnectionRecorder(
                clash_api=CLASH_API,
                headers_func=clash_headers,
                store=proxy_record_store,
                emit_log=emit_log,
                poll_interval=CONNECTION_RECORD_INTERVAL,
                request_timeout=5,
            )
            connection_recorder.start()
            emit_log(
                (
                    "connection recorder enabled, "
                    f"interval={CONNECTION_RECORD_INTERVAL}s, max_records={MAX_PROXY_RECORDS}"
                )
            )
        else:
            emit_log("connection recorder disabled")
        emit_log(
            (
                "provider auto-refresh "
                f"{'enabled' if PROVIDER_AUTO_REFRESH_ENABLED else 'disabled'}, "
                f"interval={PROVIDER_RECOVERY_CHECK_INTERVAL}s, "
                f"zero_window={PROVIDER_ZERO_ALIVE_MINUTES}m, "
                f"max_per_day={PROVIDER_AUTO_REFRESH_MAX_PER_DAY}"
            )
        )
        emit_log(
            (
                "kernel update "
                f"repo={DEFAULT_CORE_REPO}, allowed={','.join(sorted(CORE_UPDATE_ALLOWED_REPOS))}, "
                f"checksum_required={CORE_UPDATE_REQUIRE_CHECKSUM}, core_bin={MIHOMO_BIN}"
            )
        )
        runtime_initialized = True


# Gunicorn imports `api_server:app` directly, so init must happen outside __main__.
start_runtime_services()


if __name__ == "__main__":
    host = os.environ.get("API_HOST", "0.0.0.0")
    try:
        port = int(os.environ.get("API_PORT", "19092"))
    except ValueError:
        port = 19092
    emit_log(f"management api starting on {host}:{port}")
    # Keep local script mode single-threaded to avoid routing anomalies in Werkzeug threaded mode.
    app.run(host=host, port=port, debug=False, threaded=False)
