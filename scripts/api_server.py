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
import threading
import time
from datetime import datetime
from functools import wraps
from pathlib import Path
from urllib.parse import quote

import requests
import yaml
from flask import Flask, Response, jsonify, request, send_from_directory, stream_with_context
from flask_cors import CORS

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
MERGE_SCRIPT_FILE = SCRIPTS_DIR / "merge.py"

PYTHON_BIN = os.environ.get("PYTHON_BIN", "/usr/bin/python3")
NODE_BIN = os.environ.get("NODE_BIN", "node")
JS_VALIDATE_TIMEOUT = int(os.environ.get("JS_VALIDATE_TIMEOUT", "10"))
CLASH_API = os.environ.get("CLASH_API", "http://127.0.0.1:9090")
CLASH_SECRET = os.environ.get("CLASH_SECRET", "")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")

SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
AUTO_SET_BLOCK_START = "// === AUTO-SUB-SETS:START ==="
AUTO_SET_BLOCK_END = "// === AUTO-SUB-SETS:END ==="
MAX_SCHEDULE_HISTORY = 200

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

merge_lock = threading.Lock()
log_lock = threading.Lock()
schedule_lock = threading.Lock()
history_lock = threading.Lock()
log_queues: list[queue.Queue] = []
log_history: list[dict] = []
MAX_LOG_HISTORY = 500


def emit_log(msg: str, level: str = "INFO") -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = {"time": now, "level": level, "msg": msg}
    with log_lock:
        log_history.append(entry)
        if len(log_history) > MAX_LOG_HISTORY:
            log_history.pop(0)
        stale: list[queue.Queue] = []
        for item in log_queues:
            try:
                item.put_nowait(entry)
            except Exception:
                stale.append(item)
        for item in stale:
            try:
                log_queues.remove(item)
            except ValueError:
                pass
    print(f"[{now}] [{level}] {msg}", flush=True)


def json_error(message: str, status: int = 400):
    return jsonify({"success": False, "error": message}), status


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data
    except Exception:
        return default


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


def load_yaml(path: Path, default):
    if not path.exists():
        return default
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
        return data if data is not None else default
    except Exception:
        return default


def save_yaml(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        yaml.safe_dump(data, fh, allow_unicode=True, sort_keys=False)


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def make_backup(path: Path, label: str = "") -> None:
    if not path.exists():
        return
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix = f".{label}" if label else ""
    backup_path = path.parent / f"{path.name}.bak.{stamp}{suffix}"
    shutil.copy2(path, backup_path)


def clash_headers() -> dict:
    if not CLASH_SECRET:
        return {}
    return {"Authorization": f"Bearer {CLASH_SECRET}"}


def _reload_clash_with_path(path: Path) -> tuple[bool, str]:
    try:
        response = requests.put(
            f"{CLASH_API}/configs",
            json={"path": str(path)},
            headers=clash_headers(),
            timeout=5,
        )
    except Exception as exc:
        return False, str(exc)

    if response.status_code == 204:
        return True, ""

    message = ""
    try:
        payload = response.json()
        if isinstance(payload, dict):
            message = str(payload.get("message", ""))
    except Exception:
        message = response.text or ""
    return False, message


def _extract_allowed_paths_from_error(message: str) -> list[Path]:
    text = str(message or "")
    match = re.search(r"allowed paths:\s*\[(.*?)\]", text, re.IGNORECASE | re.DOTALL)
    if not match:
        return []
    raw = match.group(1)
    items = []
    for part in raw.split(","):
        path_str = part.strip().strip("\"'").strip()
        if not path_str:
            continue
        try:
            items.append(Path(path_str))
        except Exception:
            continue
    return items


def _prepare_safe_reload_file(target_path: Path) -> bool:
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(CONFIG_FILE, target_path)
        return True
    except Exception:
        return False


def reload_clash() -> bool:
    # Optional override path for environments where clash only accepts specific safe directories.
    preferred_reload_path = os.environ.get("CLASH_RELOAD_PATH", "").strip()
    if preferred_reload_path:
        prefer_path = Path(preferred_reload_path)
        if _prepare_safe_reload_file(prefer_path):
            ok, msg = _reload_clash_with_path(prefer_path)
            if ok:
                return True
            emit_log(f"reload via CLASH_RELOAD_PATH failed: {msg}", "WARN")
        else:
            emit_log(f"failed to sync config to CLASH_RELOAD_PATH: {prefer_path}", "WARN")

    ok, msg = _reload_clash_with_path(CONFIG_FILE)
    if ok:
        return True

    # Auto-fallback for clients like FlClash that restrict reload path to safe directories.
    allowed_paths = _extract_allowed_paths_from_error(msg)
    if not allowed_paths:
        return False

    for safe_dir in allowed_paths:
        safe_target = safe_dir / "clash-web-runtime-config.yaml"
        if not _prepare_safe_reload_file(safe_target):
            continue
        ok2, msg2 = _reload_clash_with_path(safe_target)
        if ok2:
            emit_log(f"reload succeeded via safe path: {safe_target}")
            return True
        emit_log(f"reload retry failed with safe path {safe_target}: {msg2}", "WARN")

    return False


def validate_js_override(content: str) -> tuple[bool, str]:
    script = str(content or "").strip()
    if not script:
        return False, "script is empty"

    js_checker = r"""
const fs = require("fs");
const code = fs.readFileSync(0, "utf8");
try {
  const runner = new Function(
    code +
      "\nif (typeof main !== 'function') { throw new Error('override.js must define main(config)'); }\nreturn true;"
  );
  runner();
} catch (err) {
  const msg = err && err.stack ? err.stack : String(err);
  console.error(msg);
  process.exit(2);
}
"""
    try:
        result = subprocess.run(
            [NODE_BIN, "-e", js_checker],
            input=script,
            capture_output=True,
            text=True,
            timeout=JS_VALIDATE_TIMEOUT,
        )
    except FileNotFoundError:
        return False, "node runtime not found"
    except subprocess.TimeoutExpired:
        return False, "javascript validation timeout"

    if result.returncode != 0:
        return False, (result.stderr.strip() or "javascript parse error")
    return True, ""


def require_write_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not ADMIN_TOKEN:
            return fn(*args, **kwargs)
        header_value = request.headers.get("Authorization", "")
        direct_token = request.headers.get("X-Admin-Token", "")
        token = ""
        if header_value.lower().startswith("bearer "):
            token = header_value[7:].strip()
        if not token:
            token = direct_token.strip()
        if token != ADMIN_TOKEN:
            return json_error("Unauthorized", 401)
        return fn(*args, **kwargs)

    return wrapper


def ensure_safe_name(name: str) -> bool:
    return bool(SAFE_NAME_RE.fullmatch(name))


def ensure_json_body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


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


def default_subscription_sets() -> dict:
    return {"set1": [], "set2": []}


def load_subscription_sets() -> dict:
    data = load_json(SUBSCRIPTION_SETS_FILE, default_subscription_sets())
    return {
        "set1": normalize_subscription_set_entries(data.get("set1")),
        "set2": normalize_subscription_set_entries(data.get("set2")),
    }


def save_subscription_sets(data: dict) -> dict:
    payload = {
        "set1": normalize_subscription_set_entries(data.get("set1")),
        "set2": normalize_subscription_set_entries(data.get("set2")),
    }
    save_json(SUBSCRIPTION_SETS_FILE, payload)
    return payload


def render_auto_set_block(sub_sets: dict) -> str:
    set1 = sub_sets.get("set1", [])
    set2 = sub_sets.get("set2", [])
    set1_json = json.dumps(set1, ensure_ascii=False, indent=2)
    set2_json = json.dumps(set2, ensure_ascii=False, indent=2)
    lines = [
        AUTO_SET_BLOCK_START,
        "// 自动生成区块：请在管理面板的“订阅集合”里维护，不建议手工改这里。",
        f"const SUB_SET1 = {set1_json};",
        f"const SUB_SET2 = {set2_json};",
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
    return {
        "enabled": False,
        "interval_minutes": 60,
        "next_run": None,
        "last_run": None,
        "last_status": "",
    }


def sanitize_schedule(data: dict) -> dict:
    payload = default_schedule()
    payload["enabled"] = bool(data.get("enabled", False))
    interval = data.get("interval_minutes", 60)
    try:
        interval = int(interval)
    except Exception:
        interval = 60
    payload["interval_minutes"] = max(5, min(1440, interval))
    payload["next_run"] = data.get("next_run")
    payload["last_run"] = data.get("last_run")
    payload["last_status"] = str(data.get("last_status", ""))
    return payload


def load_schedule() -> dict:
    raw = load_json(SCHEDULE_FILE, default_schedule())
    return sanitize_schedule(raw)


def save_schedule(data: dict) -> dict:
    payload = sanitize_schedule(data)
    save_json(SCHEDULE_FILE, payload)
    return payload


def default_schedule_history() -> dict:
    return {"items": []}


def sanitize_schedule_history_items(items) -> list[dict]:
    if not isinstance(items, list):
        return []
    rows: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        rows.append(
            {
                "started_at": str(item.get("started_at", "")),
                "ended_at": str(item.get("ended_at", "")),
                "trigger": str(item.get("trigger", "")),
                "action": str(item.get("action", "")),
                "status": str(item.get("status", "")),
                "message": str(item.get("message", "")),
            }
        )
    if len(rows) > MAX_SCHEDULE_HISTORY:
        rows = rows[-MAX_SCHEDULE_HISTORY:]
    return rows


def load_schedule_history() -> list[dict]:
    raw = load_json(SCHEDULE_HISTORY_FILE, default_schedule_history())
    items = sanitize_schedule_history_items(raw.get("items", []))
    return items


def save_schedule_history(items: list[dict]) -> None:
    payload = {"items": sanitize_schedule_history_items(items)}
    save_json(SCHEDULE_HISTORY_FILE, payload)


def append_schedule_history(
    trigger: str,
    do_reload: bool,
    status: str,
    message: str,
    started_at: str | None = None,
    ended_at: str | None = None,
) -> None:
    entry = {
        "started_at": started_at or now_iso(),
        "ended_at": ended_at or now_iso(),
        "trigger": trigger,
        "action": "merge_and_reload" if do_reload else "merge",
        "status": status,
        "message": message,
    }
    with history_lock:
        items = load_schedule_history()
        items.append(entry)
        save_schedule_history(items)


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def add_minutes_iso(minutes: int) -> str:
    next_dt = datetime.now().timestamp() + minutes * 60
    return datetime.fromtimestamp(next_dt).replace(microsecond=0).isoformat()


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def web_entry(path: str):
    if path.startswith("api/"):
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


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"success": True, "time": datetime.now().isoformat()})


@app.route("/api/status", methods=["GET"])
def status():
    return jsonify(
        {
            "success": True,
            "admin_token_enabled": bool(ADMIN_TOKEN),
            "runtime": {
                "clash_api": CLASH_API,
            },
            "paths": {
                "base": str(BASE_DIR),
                "scripts": str(SCRIPTS_DIR),
                "config": str(CONFIG_FILE),
            },
        }
    )


def run_merge_job(do_reload: bool, trigger: str) -> tuple[bool, str]:
    emit_log(f"{trigger}: merge started")
    try:
        process = subprocess.run(
            [PYTHON_BIN, str(MERGE_SCRIPT_FILE), "merge"],
            capture_output=True,
            text=True,
            timeout=240,
        )
    except subprocess.TimeoutExpired:
        emit_log(f"{trigger}: merge timeout", "ERROR")
        return False, "merge timeout"
    except Exception as exc:
        emit_log(f"{trigger}: merge error {exc}", "ERROR")
        return False, f"merge error: {exc}"

    stdout = (process.stdout or "").strip()
    stderr = (process.stderr or "").strip()
    if stdout:
        for line in stdout.splitlines():
            emit_log(line)
    if stderr:
        for line in stderr.splitlines():
            emit_log(line, "WARN")

    if process.returncode != 0:
        emit_log(f"{trigger}: merge failed, rc={process.returncode}", "ERROR")
        return False, f"merge failed rc={process.returncode}"

    if do_reload:
        ok = reload_clash()
        if ok:
            emit_log(f"{trigger}: reload done", "SUCCESS")
            return True, "merge and reload success"
        emit_log(f"{trigger}: reload failed", "ERROR")
        return False, "merge success but reload failed"

    emit_log(f"{trigger}: merge done", "SUCCESS")
    return True, "merge success"


def start_merge_job(do_reload: bool, trigger: str) -> bool:
    if not merge_lock.acquire(blocking=False):
        return False

    def runner():
        started_at = now_iso()
        success = False
        message = "unknown"
        try:
            success, message = run_merge_job(do_reload=do_reload, trigger=trigger)
        finally:
            ended_at = now_iso()
            append_schedule_history(
                trigger=trigger,
                do_reload=do_reload,
                status="success" if success else "failed",
                message=message,
                started_at=started_at,
                ended_at=ended_at,
            )
            if trigger == "scheduler":
                with schedule_lock:
                    schedule = load_schedule()
                    schedule["last_run"] = ended_at
                    schedule["last_status"] = "success" if success else "failed"
                    save_schedule(schedule)
            merge_lock.release()

    threading.Thread(target=runner, daemon=True).start()
    return True


def scheduler_loop() -> None:
    while True:
        time.sleep(5)
        with schedule_lock:
            schedule = load_schedule()

        if not schedule.get("enabled", False):
            continue

        next_run = str(schedule.get("next_run") or "").strip()
        if not next_run:
            schedule["next_run"] = add_minutes_iso(schedule["interval_minutes"])
            with schedule_lock:
                save_schedule(schedule)
            continue

        try:
            next_dt = datetime.fromisoformat(next_run)
        except Exception:
            schedule["next_run"] = add_minutes_iso(schedule["interval_minutes"])
            with schedule_lock:
                save_schedule(schedule)
            continue

        if datetime.now() < next_dt:
            continue

        started_at = now_iso()
        started = start_merge_job(do_reload=True, trigger="scheduler")
        schedule["last_run"] = started_at
        schedule["last_status"] = "started" if started else "skipped_busy"
        schedule["next_run"] = add_minutes_iso(schedule["interval_minutes"])
        with schedule_lock:
            save_schedule(schedule)
        if started:
            emit_log("scheduler: merge+reload launched")
        else:
            append_schedule_history(
                trigger="scheduler",
                do_reload=True,
                status="skipped_busy",
                message="skip because previous merge task is running",
                started_at=started_at,
                ended_at=started_at,
            )
            emit_log("scheduler: skipped, merge busy", "WARN")


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
    emit_log(
        f"subscription sets updated: set1={len(data['set1'])}, set2={len(data['set2'])}",
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


@app.route("/api/clash/config", methods=["PUT"])
@require_write_auth
def clash_config():
    body = ensure_json_body()
    mode = str(body.get("mode", "")).strip().lower()
    if mode not in {"rule", "global", "direct"}:
        return json_error("invalid mode", 400)

    payload = {"mode": mode}
    try:
        resp = requests.patch(
            f"{CLASH_API}/configs",
            headers=clash_headers(),
            json=payload,
            timeout=5,
        )
        if resp.status_code not in (200, 204) and resp.status_code in (404, 405, 501):
            # Compatibility fallback for runtimes that only accept PUT /configs.
            resp = requests.put(
                f"{CLASH_API}/configs",
                headers=clash_headers(),
                json=payload,
                timeout=5,
            )
        if resp.status_code not in (200, 204):
            return json_error(f"clash api error: {resp.status_code}", 502)

        emit_log(f"clash mode updated: {mode}")
        return jsonify({"success": True, "mode": mode})
    except Exception as exc:
        return json_error(f"failed to update clash config: {exc}", 500)


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
        resp = requests.get(
            f"{CLASH_API}/providers/proxies",
            headers=clash_headers(),
            timeout=8,
        )
        if resp.status_code != 200:
            return json_error(f"clash api error: {resp.status_code}", 502)

        payload = resp.json() if resp.content else {}
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
    ok, reason = validate_js_override(content)
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
            ok, reason = validate_js_override(content)
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
    with log_lock:
        items = list(log_history[-200:])
    return jsonify({"success": True, "data": items})


@app.route("/api/logs/stream", methods=["GET"])
def log_stream():
    def generate():
        q: queue.Queue = queue.Queue(maxsize=128)
        with log_lock:
            log_queues.append(q)
            history = list(log_history[-30:])
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
            with log_lock:
                try:
                    log_queues.remove(q)
                except ValueError:
                    pass

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
    if not SUBS_CONFIG.exists():
        save_json(SUBS_CONFIG, {"subscriptions": []})
    if not SUBSCRIPTION_SETS_FILE.exists():
        save_json(SUBSCRIPTION_SETS_FILE, default_subscription_sets())
    if not SCHEDULE_FILE.exists():
        save_json(SCHEDULE_FILE, default_schedule())
    if not SCHEDULE_HISTORY_FILE.exists():
        save_json(SCHEDULE_HISTORY_FILE, default_schedule_history())
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


if __name__ == "__main__":
    bootstrap_files()
    threading.Thread(target=scheduler_loop, daemon=True).start()
    host = os.environ.get("API_HOST", "0.0.0.0")
    try:
        port = int(os.environ.get("API_PORT", "19092"))
    except ValueError:
        port = 19092
    emit_log(f"management api starting on {host}:{port}")
    app.run(host=host, port=port, debug=False, threaded=True)
