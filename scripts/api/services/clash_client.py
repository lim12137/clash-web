from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Callable

import requests


def build_clash_headers(clash_secret: str) -> dict[str, str]:
    if not clash_secret:
        return {}
    return {"Authorization": f"Bearer {clash_secret}"}


def _reload_clash_with_path(
    path: Path,
    *,
    clash_api: str,
    headers: dict[str, str],
) -> tuple[bool, str]:
    try:
        response = requests.put(
            f"{clash_api}/configs",
            json={"path": str(path)},
            headers=headers,
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
    items: list[Path] = []
    for part in raw.split(","):
        path_str = part.strip().strip("\"'").strip()
        if not path_str:
            continue
        try:
            items.append(Path(path_str))
        except Exception:
            continue
    return items


def _prepare_safe_reload_file(config_file: Path, target_path: Path) -> bool:
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(config_file, target_path)
        return True
    except Exception:
        return False


def reload_clash_config(
    *,
    config_file: Path,
    clash_api: str,
    clash_secret: str,
    emit_log: Callable[..., None],
    preferred_reload_path: str = "",
) -> bool:
    headers = build_clash_headers(clash_secret)

    # Optional override path for environments where clash only accepts specific safe directories.
    preferred_path = str(preferred_reload_path or "").strip()
    if preferred_path:
        prefer_target = Path(preferred_path)
        if _prepare_safe_reload_file(config_file, prefer_target):
            ok, msg = _reload_clash_with_path(prefer_target, clash_api=clash_api, headers=headers)
            if ok:
                return True
            emit_log(f"reload via CLASH_RELOAD_PATH failed: {msg}", "WARN")
        else:
            emit_log(f"failed to sync config to CLASH_RELOAD_PATH: {prefer_target}", "WARN")

    ok, msg = _reload_clash_with_path(config_file, clash_api=clash_api, headers=headers)
    if ok:
        return True

    # Auto-fallback for clients like FlClash that restrict reload path to safe directories.
    allowed_paths = _extract_allowed_paths_from_error(msg)
    if not allowed_paths:
        return False

    for safe_dir in allowed_paths:
        safe_target = safe_dir / "clash-web-runtime-config.yaml"
        if not _prepare_safe_reload_file(config_file, safe_target):
            continue
        ok2, msg2 = _reload_clash_with_path(safe_target, clash_api=clash_api, headers=headers)
        if ok2:
            emit_log(f"reload succeeded via safe path: {safe_target}")
            return True
        emit_log(f"reload retry failed with safe path {safe_target}: {msg2}", "WARN")

    return False
