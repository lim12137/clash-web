#!/usr/bin/env python3
"""
Merge multiple Clash subscriptions with online-editable policy files.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
import yaml

DEFAULT_EXTERNAL_CONTROLLER = "0.0.0.0:9090"

# Import unified configuration
# Note: When merge.py is imported as a module, cfg is already available in api_server.py
# When run standalone, we need to initialize it
try:
    from api.common.config import get_config
    cfg = get_config()
except ImportError:
    # Fallback for standalone execution
    MIHOMO_DIR = Path(os.environ.get("MIHOMO_DIR", "/root/.config/mihomo"))
    SCRIPTS_DIR = Path(os.environ.get("SCRIPTS_DIR", "/scripts"))
    SUBS_DIR = MIHOMO_DIR / "subs"
    BACKUP_DIR = MIHOMO_DIR / "backups"
    CONFIG_FILE = MIHOMO_DIR / "config.yaml"
    SUBS_CONFIG = SCRIPTS_DIR / "subscriptions.json"
    TEMPLATE_FILE = SCRIPTS_DIR / "template.yaml"
    OVERRIDE_FILE = SCRIPTS_DIR / "override.yaml"
    OVERRIDE_SCRIPT_FILE = SCRIPTS_DIR / "override.js"
    SITE_POLICY_FILE = SCRIPTS_DIR / "site_policy.yaml"
    REQUEST_TIMEOUT = int(os.environ.get("SUB_REQUEST_TIMEOUT", "20"))
    JS_OVERRIDE_TIMEOUT = int(os.environ.get("JS_OVERRIDE_TIMEOUT", "20"))
    NODE_BIN = os.environ.get("NODE_BIN", "node")

    class _FallbackConfig:
        paths = type('obj', (object,), {
            'subs_dir': SUBS_DIR,
            'backup_dir': BACKUP_DIR,
            'base_dir': MIHOMO_DIR,
            'config_file': CONFIG_FILE,
        })()
        script_paths = type('obj', (object,), {
            'subs_config': SUBS_CONFIG,
            'template_file': TEMPLATE_FILE,
            'override_file': OVERRIDE_FILE,
            'override_script_file': OVERRIDE_SCRIPT_FILE,
            'site_policy_file': SITE_POLICY_FILE,
        })()
        runtime = type('obj', (object,), {
            'sub_request_timeout': REQUEST_TIMEOUT,
            'js_override_timeout': JS_OVERRIDE_TIMEOUT,
            'node_bin': NODE_BIN,
        })()
        auth = type('obj', (object,), {
            'clash_api': f"http://{os.environ.get('CLASH_EXTERNAL_CONTROLLER', DEFAULT_EXTERNAL_CONTROLLER)}",
        })()

    cfg = _FallbackConfig()


def get_external_controller() -> str:
    configured = os.environ.get("CLASH_EXTERNAL_CONTROLLER", "").strip()
    return configured or "0.0.0.0:9090"


def log(message: str) -> None:
    print(f"[merge] {message}", flush=True)


def read_int_env(var_name: str) -> int | None:
    raw = os.environ.get(var_name, "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        log(f"invalid {var_name}={raw!r}, ignored")
        return None


def env_flag(var_name: str) -> bool:
    value = os.environ.get(var_name, "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def ensure_dirs() -> None:
    cfg.paths.subs_dir.mkdir(parents=True, exist_ok=True)
    cfg.paths.backup_dir.mkdir(parents=True, exist_ok=True)
    cfg.paths.base_dir.mkdir(parents=True, exist_ok=True)


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return copy.deepcopy(default)
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data
    except Exception as exc:
        log(f"failed to load json {path}: {exc}")
        return copy.deepcopy(default)


def save_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


def load_yaml(path: Path, default: Any) -> Any:
    if not path.exists():
        return copy.deepcopy(default)
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
        return data if data is not None else copy.deepcopy(default)
    except Exception as exc:
        log(f"failed to load yaml {path}: {exc}")
        return copy.deepcopy(default)


def save_yaml(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as fh:
        yaml.safe_dump(data, fh, allow_unicode=True, sort_keys=False)


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except Exception as exc:
        log(f"failed to read text {path}: {exc}")
        return ""


def make_backup(src: Path, prefix: str = "config") -> None:
    if not src.exists():
        return
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = cfg.paths.backup_dir / f"{prefix}_{stamp}.yaml"
    shutil.copy2(src, backup)
    log(f"backup created: {backup.name}")


def normalize_proxy_name(name: str, prefix: str = "") -> str:
    base = (name or "node").strip()
    if prefix:
        return f"{prefix}{base}"
    return base


def should_keep_proxy(
    proxy_name: str,
    include_filter: str = "",
    exclude_filter: str = "",
) -> bool:
    if include_filter:
        try:
            if not re.search(include_filter, proxy_name):
                return False
        except re.error:
            # Ignore invalid regex configured by user; keep proxy.
            pass
    if exclude_filter:
        try:
            if re.search(exclude_filter, proxy_name):
                return False
        except re.error:
            pass
    return True


def proxy_fingerprint(proxy: dict[str, Any]) -> str:
    keys = [
        "type",
        "server",
        "port",
        "uuid",
        "password",
        "cipher",
        "network",
        "plugin",
    ]
    return "|".join(str(proxy.get(key, "")) for key in keys)


def unique_items(items: list[str]) -> list[str]:
    seen = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def ensure_unique_proxy_names(proxies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    used: dict[str, int] = {}
    for proxy in proxies:
        name = str(proxy.get("name") or "node").strip()
        if name not in used:
            used[name] = 1
            proxy["name"] = name
            continue
        count = used[name]
        while True:
            candidate = f"{name}_{count}"
            count += 1
            if candidate not in used:
                proxy["name"] = candidate
                used[name] = count
                used[candidate] = 1
                break
    return proxies


def parse_subscription_proxies(text: str) -> list[dict[str, Any]]:
    parsed = yaml.safe_load(text)
    if isinstance(parsed, dict):
        proxies = parsed.get("proxies", [])
        if isinstance(proxies, list):
            return [p for p in proxies if isinstance(p, dict)]
    raise ValueError("subscription payload must be clash yaml with 'proxies' list")


def fetch_subscription(sub: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    name = str(sub.get("name", "sub")).strip()
    url = str(sub.get("url", "")).strip()
    prefix = str(sub.get("prefix", "")).strip()
    include_filter = str(sub.get("include_filter", "")).strip()
    exclude_filter = str(sub.get("exclude_filter", "")).strip()

    if not url:
        raise ValueError(f"subscription '{name}' has empty url")

    response = requests.get(
        url,
        headers={"User-Agent": "clash-manager/1.0"},
        timeout=cfg.runtime.sub_request_timeout,
    )
    response.raise_for_status()

    fetched = parse_subscription_proxies(response.text)
    filtered: list[dict[str, Any]] = []

    for proxy in fetched:
        current = copy.deepcopy(proxy)
        current_name = normalize_proxy_name(str(current.get("name", "node")), prefix)
        if not should_keep_proxy(current_name, include_filter, exclude_filter):
            continue
        current["name"] = current_name
        filtered.append(current)

    return filtered, response.text


def deduplicate_proxies(proxies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_fingerprint = set()
    result: list[dict[str, Any]] = []
    for proxy in proxies:
        fingerprint = proxy_fingerprint(proxy)
        if fingerprint in by_fingerprint:
            continue
        by_fingerprint.add(fingerprint)
        result.append(proxy)
    return ensure_unique_proxy_names(result)


def merge_group_lists(
    groups: list[dict[str, Any]],
    new_groups: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    by_name: dict[str, dict[str, Any]] = {}
    for group in groups:
        if isinstance(group, dict) and group.get("name"):
            by_name[str(group["name"])] = copy.deepcopy(group)
    for group in new_groups:
        if not isinstance(group, dict) or not group.get("name"):
            continue
        key = str(group["name"])
        incoming = copy.deepcopy(group)
        if key not in by_name:
            by_name[key] = incoming
            continue
        existing = by_name[key]
        incoming_proxies = incoming.get("proxies", [])
        existing_proxies = existing.get("proxies", [])
        for item_key, value in incoming.items():
            if item_key == "proxies":
                continue
            existing[item_key] = value
        if isinstance(existing_proxies, list) and isinstance(incoming_proxies, list):
            existing["proxies"] = unique_items(existing_proxies + incoming_proxies)
        by_name[key] = existing
    return list(by_name.values())


def add_proxies_to_group(group: dict[str, Any], proxy_names: list[str]) -> dict[str, Any]:
    cloned = copy.deepcopy(group)
    use_all = bool(cloned.pop("use_all_proxies", False))
    if use_all:
        current = cloned.get("proxies", [])
        if not isinstance(current, list):
            current = []
        cloned["proxies"] = unique_items(current + proxy_names)
    return cloned


def place_rules_before_match(existing: list[str], new_rules: list[str]) -> list[str]:
    existing_clean = [r for r in existing if isinstance(r, str) and r.strip()]
    new_clean = [r for r in new_rules if isinstance(r, str) and r.strip()]

    match_rules = [r for r in existing_clean if r.startswith("MATCH,")]
    non_match_rules = [r for r in existing_clean if not r.startswith("MATCH,")]
    merged = unique_items(new_clean + non_match_rules + match_rules)
    return merged


def deep_merge_config(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(base)
    for key, value in override.items():
        if key == "proxy-groups":
            base_groups = result.get("proxy-groups", [])
            if not isinstance(base_groups, list):
                base_groups = []
            incoming_groups = value if isinstance(value, list) else []
            result["proxy-groups"] = merge_group_lists(base_groups, incoming_groups)
            continue
        if key == "rules":
            base_rules = result.get("rules", [])
            if not isinstance(base_rules, list):
                base_rules = []
            incoming_rules = value if isinstance(value, list) else []
            result["rules"] = place_rules_before_match(base_rules, incoming_rules)
            continue
        if key == "proxies":
            base_proxies = result.get("proxies", [])
            incoming_proxies = value if isinstance(value, list) else []
            if not isinstance(base_proxies, list):
                base_proxies = []
            combined = []
            for item in base_proxies + incoming_proxies:
                if isinstance(item, dict):
                    combined.append(copy.deepcopy(item))
            result["proxies"] = deduplicate_proxies(combined)
            continue

        current = result.get(key)
        if isinstance(current, dict) and isinstance(value, dict):
            result[key] = deep_merge_config(current, value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def build_default_template() -> dict[str, Any]:
    return {
        "mixed-port": 17890,
        "socks-port": 7891,
        "allow-lan": True,
        "bind-address": "*",
        "mode": "rule",
        "log-level": "info",
        "external-controller": "0.0.0.0:9090",
        "secret": "",
        "proxies": [],
        "proxy-groups": [
            {
                "name": "PROXY",
                "type": "select",
                "proxies": ["AUTO", "DIRECT"],
                "use_all_proxies": True,
            },
            {
                "name": "AUTO",
                "type": "url-test",
                "url": "http://www.gstatic.com/generate_204",
                "interval": 300,
                "tolerance": 50,
                "proxies": [],
                "use_all_proxies": True,
            },
        ],
        "rules": ["MATCH,PROXY"],
    }


def apply_subscription_data(config: dict[str, Any], proxies: list[dict[str, Any]]) -> dict[str, Any]:
    output = copy.deepcopy(config)
    output["proxies"] = copy.deepcopy(proxies)

    proxy_names = [str(proxy.get("name", "")) for proxy in proxies if proxy.get("name")]
    groups = output.get("proxy-groups", [])
    if not isinstance(groups, list):
        groups = []

    rendered_groups = []
    for group in groups:
        if not isinstance(group, dict):
            continue
        rendered_groups.append(add_proxies_to_group(group, proxy_names))

    if not rendered_groups:
        rendered_groups = [
            {
                "name": "PROXY",
                "type": "select",
                "proxies": unique_items(["DIRECT"] + proxy_names),
            }
        ]
    output["proxy-groups"] = rendered_groups
    return output


def apply_site_policy(config: dict[str, Any], site_policy: dict[str, Any], proxy_names: list[str]) -> dict[str, Any]:
    output = copy.deepcopy(config)

    incoming_groups = site_policy.get("groups", [])
    rendered_policy_groups = []
    if isinstance(incoming_groups, list):
        for group in incoming_groups:
            if not isinstance(group, dict):
                continue
            rendered_policy_groups.append(add_proxies_to_group(group, proxy_names))

    existing_groups = output.get("proxy-groups", [])
    if not isinstance(existing_groups, list):
        existing_groups = []
    output["proxy-groups"] = merge_group_lists(existing_groups, rendered_policy_groups)

    incoming_rules = site_policy.get("rules", [])
    existing_rules = output.get("rules", [])
    if not isinstance(existing_rules, list):
        existing_rules = []
    if isinstance(incoming_rules, list):
        output["rules"] = place_rules_before_match(existing_rules, incoming_rules)
    return output


def ensure_runtime_values(config: dict[str, Any]) -> dict[str, Any]:
    output = copy.deepcopy(config)
    output["allow-lan"] = True
    output["bind-address"] = "*"
    output["external-controller"] = get_external_controller()

    mixed_port = read_int_env("CLASH_MIXED_PORT")
    if mixed_port is not None:
        output["mixed-port"] = mixed_port

    socks_port = read_int_env("CLASH_SOCKS_PORT")
    if socks_port is not None:
        output["socks-port"] = socks_port

    secret = os.environ.get("CLASH_SECRET")
    if secret:
        output["secret"] = secret
    return output


def list_proxy_names(config: dict[str, Any]) -> list[str]:
    proxies = config.get("proxies", [])
    if not isinstance(proxies, list):
        return []
    names: list[str] = []
    for item in proxies:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        names.append(name)
    return unique_items(names)


def sanitize_proxy_groups(config: dict[str, Any]) -> dict[str, Any]:
    output = copy.deepcopy(config)
    groups = output.get("proxy-groups", [])
    if not isinstance(groups, list):
        return output

    available_proxies = list_proxy_names(output)
    fallback_proxies = unique_items(available_proxies + ["DIRECT"])

    fixed_groups: list[dict[str, Any]] = []
    for group in groups:
        if not isinstance(group, dict):
            continue
        current = copy.deepcopy(group)

        use_items = current.get("use")
        if isinstance(use_items, list):
            cleaned_use = [str(item).strip() for item in use_items if str(item).strip()]
            if cleaned_use:
                current["use"] = unique_items(cleaned_use)
            else:
                current.pop("use", None)

        proxy_items = current.get("proxies")
        if isinstance(proxy_items, list):
            cleaned_proxies = [str(item).strip() for item in proxy_items if str(item).strip()]
            if cleaned_proxies:
                current["proxies"] = unique_items(cleaned_proxies)
            else:
                current.pop("proxies", None)

        # Clash requires proxy groups to define at least one source:
        # non-empty `use` or non-empty `proxies`.
        if not current.get("use") and not current.get("proxies"):
            current["proxies"] = fallback_proxies

        fixed_groups.append(current)

    output["proxy-groups"] = fixed_groups
    return output


def maybe_disable_geoip_rules(config: dict[str, Any]) -> dict[str, Any]:
    if not env_flag("CLASH_DISABLE_GEOIP"):
        return config

    output = copy.deepcopy(config)
    rules = output.get("rules", [])
    if not isinstance(rules, list):
        return output

    filtered_rules: list[Any] = []
    removed = 0
    for rule in rules:
        if isinstance(rule, str) and rule.strip().upper().startswith("GEOIP,"):
            removed += 1
            continue
        filtered_rules.append(rule)

    if removed:
        output["rules"] = filtered_rules
        log(f"CLASH_DISABLE_GEOIP enabled, removed {removed} GEOIP rule(s)")
    return output


def apply_js_override(config: dict[str, Any], script_text: str) -> dict[str, Any]:
    script = (script_text or "").strip()
    if not script:
        return config

    js_runner = r"""
const fs = require("fs");

const payload = JSON.parse(fs.readFileSync(0, "utf8"));
const userScript = String(payload.script || "");
const incoming = payload.config || {};

let output = null;
try {
  const runner = new Function(
    "config",
    userScript +
      "\nif (typeof main !== 'function') { throw new Error('override.js must define: const main = (config) => ...'); }\n" +
      "const result = main(config);\n" +
      "return result === undefined ? config : result;"
  );
  output = runner(incoming);
} catch (err) {
  const msg = err && err.stack ? err.stack : String(err);
  console.error(msg);
  process.exit(2);
}

if (typeof output !== "object" || output === null || Array.isArray(output)) {
  console.error("main(config) must return an object config");
  process.exit(2);
}

process.stdout.write(JSON.stringify(output));
"""

    payload = {"config": config, "script": script}
    try:
        result = subprocess.run(
            [cfg.runtime.node_bin, "-e", js_runner],
            input=json.dumps(payload, ensure_ascii=False),
            capture_output=True,
            text=True,
            timeout=cfg.runtime.js_override_timeout,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(f"node runtime not found: {exc}") from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("override.js execution timeout") from exc

    if result.returncode != 0:
        stderr = result.stderr.strip() or "unknown js execution error"
        raise RuntimeError(stderr)

    stdout = result.stdout.strip()
    if not stdout:
        raise RuntimeError("override.js returned empty output")

    parsed = json.loads(stdout)
    if not isinstance(parsed, dict):
        raise RuntimeError("override.js output must be a json object")
    return parsed


def merge_subscriptions() -> int:
    ensure_dirs()
    subscriptions = load_json(cfg.script_paths.subs_config, {"subscriptions": []}).get("subscriptions", [])
    if not isinstance(subscriptions, list):
        subscriptions = []

    template = load_yaml(cfg.script_paths.template_file, build_default_template())
    override = load_yaml(cfg.script_paths.override_file, {})
    site_policy = load_yaml(cfg.script_paths.site_policy_file, {"groups": [], "rules": []})
    override_script = read_text(cfg.script_paths.override_script_file)

    merged_proxies: list[dict[str, Any]] = []
    enabled_count = 0

    for sub in subscriptions:
        if not isinstance(sub, dict):
            continue
        if not sub.get("enabled", True):
            continue

        name = str(sub.get("name", "sub")).strip() or "sub"
        enabled_count += 1
        try:
            proxies, raw_text = fetch_subscription(sub)
            merged_proxies.extend(proxies)
            save_yaml(cfg.paths.subs_dir / f"{name}.yaml", {"proxies": proxies})
            log(f"{name}: fetched={len(proxies)}")
            # Keep raw response for future debugging if needed.
            if sub.get("save_raw", False):
                (cfg.paths.subs_dir / f"{name}.raw.txt").write_text(raw_text, encoding="utf-8")
        except Exception as exc:
            log(f"{name}: failed -> {exc}")

    deduped = deduplicate_proxies(merged_proxies)
    log(f"enabled_subscriptions={enabled_count}, merged_proxies={len(deduped)}")

    config = apply_subscription_data(template, deduped)
    proxy_names = [str(proxy.get("name", "")) for proxy in deduped if proxy.get("name")]
    config = apply_site_policy(config, site_policy, proxy_names)
    config = deep_merge_config(config, override if isinstance(override, dict) else {})
    if override_script.strip():
        log("applying override.js")
        config = apply_js_override(config, override_script)
    config = ensure_runtime_values(config)
    config = sanitize_proxy_groups(config)
    config = maybe_disable_geoip_rules(config)

    make_backup(cfg.paths.config_file)
    save_yaml(cfg.paths.config_file, config)
    log(f"config written -> {cfg.paths.config_file}")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge Clash subscriptions")
    parser.add_argument("command", nargs="?", default="merge", choices=["merge"])
    args = parser.parse_args()
    if args.command == "merge":
        return merge_subscriptions()
    return 1


if __name__ == "__main__":
    sys.exit(main())
