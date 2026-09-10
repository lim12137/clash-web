#!/usr/bin/env python3
"""
Merge multiple Clash subscriptions with online-editable policy files.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import base64
import re
import shutil
import urllib.parse
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


# ---------------------------------------------------------------------------
# Share-link (订阅集合 / .txt) 解码：ss / trojan / vmess / vless / hysteria2 /
# hysteria / snell。目标：只抽取节点信息（proxies），组/规则一律丢弃。
# ---------------------------------------------------------------------------
def _b64decode_pad(s: str) -> bytes:
    s = (s or "").strip()
    s = s.replace("-", "+").replace("_", "/")
    s += "=" * (-len(s) % 4)
    return base64.b64decode(s)


def _split_hostport(s: str) -> tuple[str, int]:
    s = (s or "").strip()
    if ":" in s:
        host, port = s.rsplit(":", 1)
        host = host.strip("[]")  # 兼容 IPv6
        try:
            return host, int(port)
        except ValueError:
            return host, 0
    return s, 0


def decode_share_link(link: str) -> dict[str, Any] | None:
    link = (link or "").strip()
    if not link:
        return None

    # 名称：#fragment
    name = None
    if "#" in link:
        link, frag = link.split("#", 1)
        name = urllib.parse.unquote(frag).strip()

    # 查询参数：?a=b&c=d
    if "?" in link:
        base, query = link.split("?", 1)
    else:
        base, query = link, ""
    params = urllib.parse.parse_qs(query)

    def qp(key: str, default=None):
        v = params.get(key)
        return v[0] if v else default

    if "://" not in base:
        return None
    scheme, rest = base.split("://", 1)
    scheme = scheme.lower()

    # ---- ss:// ----
    if scheme == "ss":
        if "@" in rest:
            userinfo, hostport = rest.rsplit("@", 1)
        else:
            try:
                decoded = _b64decode_pad(rest).decode("utf-8", "ignore")
                userinfo, hostport = decoded.rsplit("@", 1)
            except Exception:
                return None
        if ":" in userinfo:
            method, password = userinfo.split(":", 1)
        else:
            try:
                ud = _b64decode_pad(userinfo).decode("utf-8", "ignore")
                method, password = ud.split(":", 1)
            except Exception:
                return None
        server, port = _split_hostport(hostport)
        proxy: dict[str, Any] = {
            "type": "ss",
            "server": server,
            "port": int(port),
            "cipher": method,
            "password": password,
        }
        if name:
            proxy["name"] = name
        return proxy

    # ---- trojan:// ----
    if scheme == "trojan":
        password, hostport = rest.rsplit("@", 1) if "@" in rest else ("", rest)
        server, port = _split_hostport(hostport)
        proxy = {
            "type": "trojan",
            "server": server,
            "port": int(port),
            "password": urllib.parse.unquote(password),
        }
        sni = qp("sni") or qp("peer")
        if sni:
            proxy["sni"] = sni
        if qp("allowInsecure") == "1" or qp("allow_insecure") == "1":
            proxy["skip-cert-verify"] = True
        net = qp("type") or qp("network")
        if net in ("ws", "grpc", "h2"):
            proxy["network"] = net
            if qp("path"):
                proxy["ws-opts"] = {"path": qp("path")}
            if qp("host"):
                proxy.setdefault("ws-opts", {})["headers"] = {"Host": qp("host")}
        if name:
            proxy["name"] = name
        return proxy

    # ---- vmess:// ----
    if scheme == "vmess":
        try:
            data = json.loads(_b64decode_pad(rest).decode("utf-8", "ignore"))
        except Exception:
            return None
        server = data.get("add")
        port = int(data.get("port", 0) or 0)
        net = data.get("net", "tcp")
        tls = data.get("tls", "")
        proxy = {
            "type": "vmess",
            "server": server,
            "port": port,
            "uuid": data.get("id"),
            "alterId": int(data.get("aid", 0) or 0),
            "cipher": data.get("scy") or "auto",
            "network": net,
        }
        if tls in ("tls", "reality"):
            proxy["tls"] = True
            sni = data.get("sni") or data.get("peer")
            if sni:
                proxy["servername"] = sni
        if net == "ws":
            proxy["ws-opts"] = {
                "path": data.get("path", ""),
                "headers": ({"Host": data.get("host")} if data.get("host") else {}),
            }
        elif net == "grpc":
            proxy["grpc-opts"] = {"grpc-service-name": data.get("path", "")}
        proxy["name"] = name or data.get("ps") or "vmess"
        return proxy

    # ---- vless:// ----
    if scheme == "vless":
        uuid, hostport = rest.rsplit("@", 1) if "@" in rest else (rest, "")
        server, port = _split_hostport(hostport)
        security = qp("security")
        proxy = {
            "type": "vless",
            "server": server,
            "port": int(port),
            "uuid": uuid,
            "network": qp("type", "tcp"),
            "tls": security in ("tls", "reality"),
        }
        if security == "reality":
            proxy["reality-opts"] = {
                "public-key": qp("pbk"),
                "short-id": qp("sid"),
            }
        sni = qp("sni")
        if sni:
            proxy["servername"] = sni
        if qp("fp"):
            proxy["client-fingerprint"] = qp("fp")
        if qp("path"):
            if proxy["network"] == "grpc":
                proxy["grpc-opts"] = {"grpc-service-name": qp("path")}
            else:
                proxy["ws-opts"] = {
                    "path": qp("path"),
                    "headers": ({"Host": qp("host")} if qp("host") else {}),
                }
        if name:
            proxy["name"] = name
        return proxy

    # ---- hysteria2:// / hysteria:// ----
    if scheme in ("hysteria2", "hysteria"):
        auth, hostport = rest.rsplit("@", 1) if "@" in rest else ("", rest)
        server, port = _split_hostport(hostport)
        proxy = {
            "type": scheme,
            "server": server,
            "port": int(port),
        }
        if auth:
            proxy["password"] = urllib.parse.unquote(auth)
        sni = qp("sni")
        if sni:
            proxy["sni"] = sni
        if qp("insecure") == "1" or qp("allowInsecure") == "1":
            proxy["skip-cert-verify"] = True
        obfs = qp("obfs")
        if obfs:
            proxy["obfs"] = obfs
        if qp("obfs-password"):
            proxy["obfs-password"] = qp("obfs-password")
        if name:
            proxy["name"] = name
        return proxy

    # ---- snell:// ----
    if scheme == "snell":
        server, port = _split_hostport(rest.split("?")[0])
        proxy = {
            "type": "snell",
            "server": server,
            "port": int(port),
            "psk": qp("psk", ""),
        }
        if qp("version"):
            proxy["version"] = int(qp("version"))
        if name:
            proxy["name"] = name
        return proxy

    return None


def _looks_like_share_links(text: str) -> bool:
    schemes = ("ss://", "trojan://", "vmess://", "vless://", "hysteria2://", "hysteria://", "snell://")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if any(line.startswith(s) for s in schemes):
            return True
    return False


def _sanitize_proxy_node(node: dict[str, Any]) -> dict[str, Any]:
    """清洗单个节点：兼容 mihomo 字段命名。

    - `fingerprint` → `client-fingerprint`：新版 mihomo 把 `fingerprint` 保留给
      TLS 证书固定（certificate pinning），浏览器指纹必须用 `client-fingerprint`。
      订阅源里常见旧写法 `fingerprint: chrome`，不改会导致整个 provider 解析失败。
    """
    if "fingerprint" in node and "client-fingerprint" not in node:
        node["client-fingerprint"] = node.pop("fingerprint")
    return node


def parse_subscription_proxies(text: str) -> list[dict[str, Any]]:
    """从订阅内容中抽取节点（proxies）。支持三种形态：
    1. 完整 Clash 配置 / 普通订阅：含 `proxies:` 列表（只取节点，丢弃组/规则）
    2. .txt 分享链接：每行一个 ss:// trojan:// vmess:// vless:// hysteria2:// snell://
    3. base64 编码的订阅（解码后递归解析）
    """
    text = (text or "").strip()
    if not text:
        raise ValueError("empty subscription payload")

    # 1) YAML（完整配置或普通订阅）
    try:
        parsed = yaml.safe_load(text)
        if isinstance(parsed, dict):
            proxies = parsed.get("proxies")
            if isinstance(proxies, list):
                return [
                    _sanitize_proxy_node(p)
                    for p in proxies
                    if isinstance(p, dict)
                ]
    except yaml.YAMLError:
        pass

    # 2) .txt 分享链接
    if _looks_like_share_links(text):
        proxies: list[dict[str, Any]] = []
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            node = decode_share_link(line)
            if node:
                proxies.append(node)
        if proxies:
            return [_sanitize_proxy_node(p) for p in proxies]

    # 3) base64 编码订阅（解码后递归）
    stripped = re.sub(r"\s+", "", text)
    if re.fullmatch(r"[A-Za-z0-9+/=]+", stripped) and len(stripped) > 16:
        try:
            decoded = _b64decode_pad(stripped).decode("utf-8", "ignore")
            return parse_subscription_proxies(decoded)
        except Exception:
            pass

    raise ValueError("subscription payload must be clash yaml / share-links / base64 with 'proxies'")



def parse_subscription_userinfo(headers) -> dict[str, Any]:
    """解析订阅服务器的 `subscription-userinfo` 响应头（流量/到期信息）。

    格式：`subscription-userinfo: upload=123; download=456; total=7890; expire=1700000000`
    mihomo 只在 http provider 运行时抓取时解析该头；我们转 inline 后由 Python
    抓取，这里提前解析并保存，供 api_server 在 provider 列表里补全展示。
    """
    raw = ""
    if headers is not None:
        raw = str(headers.get("subscription-userinfo") or headers.get("Subscription-Userinfo") or "")
    raw = (raw or "").strip()
    if not raw:
        return {}
    info: dict[str, Any] = {}
    for part in raw.split(";"):
        part = part.strip()
        if not part or "=" not in part:
            continue
        key, _, value = part.partition("=")
        key_lower = key.strip().lower()
        # 与 mihomo subscriptionInfo 字段名一致（Upload/Download/Total/Expire），
        # 前端 formatSubscriptionInfo 直接读 info.Total 等
        if key_lower not in ("upload", "download", "total", "expire"):
            continue
        try:
            info[key_lower.capitalize()] = int(float(value.strip()))
        except ValueError:
            continue
    return info


def load_subscription_userinfo_cache() -> dict[str, Any]:
    """读取 provider 的 subscription-userinfo 缓存（key=provider 名）。"""
    try:
        path = Path(str(cfg.script_paths.subscription_userinfo_file))
    except Exception:
        path = Path(os.environ.get("SCRIPTS_DIR", "/scripts")) / "subscription_userinfo.json"
    return load_json(path, {})


def save_subscription_userinfo_cache(data: dict[str, Any]) -> None:
    try:
        path = Path(str(cfg.script_paths.subscription_userinfo_file))
    except Exception:
        path = Path(os.environ.get("SCRIPTS_DIR", "/scripts")) / "subscription_userinfo.json"
    try:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        log(f"save subscription-userinfo cache failed -> {exc}")


def fetch_subscription(sub: dict[str, Any]) -> tuple[list[dict[str, Any]], str, dict[str, Any]]:
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

    userinfo = parse_subscription_userinfo(response.headers)
    fetched = parse_subscription_proxies(response.text)
    filtered: list[dict[str, Any]] = []

    for proxy in fetched:
        current = copy.deepcopy(proxy)
        current_name = normalize_proxy_name(str(current.get("name", "node")), prefix)
        if not should_keep_proxy(current_name, include_filter, exclude_filter):
            continue
        current["name"] = current_name
        filtered.append(current)

    return filtered, response.text, userinfo


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


def _http_provider_compatible(text: str) -> bool:
    """判断订阅内容是否 mihomo http provider 能直接解析（保持 http 直连）。

    实测结论（2026-08-09，v1.19.25/v1.19.29 双版本验证）：
    - YAML 完整 Clash 配置（含 proxy-groups/rules）→ mihomo **能**直连解析出节点
      （A/C 源实测 36/37 节点，subscriptionInfo 完整）
    - base64 编码订阅 → 多数能直连（v2ray 订阅格式）
    - 节点含 `fingerprint` 字段 → mihomo 报 TLS pinning 错误，整个 provider 失败
      （list.meta.yml 实测 0 节点）→ 必须转 inline 清洗
    - 明文 .txt 分享链接 → mihomo 解析失败 → 转 inline 由 Python 解码

    兼容（保持 http 直连）：YAML（含完整配置）/ base64 订阅 / 无 fingerprint 节点
    不兼容（转 inline）：节点含 fingerprint / 明文 .txt 分享链接
    """
    text = (text or "").strip()
    if not text:
        return False
    # 明文 .txt 分享链接（含 :// 行，非 YAML 非 base64）
    if _looks_like_share_links(text):
        return False
    # YAML：解析出 proxies 且任一节点含 fingerprint → mihomo TLS pinning 报错 → 转 inline
    try:
        parsed = yaml.safe_load(text)
    except yaml.YAMLError:
        parsed = None
    if isinstance(parsed, dict):
        proxies = parsed.get("proxies")
        if isinstance(proxies, list):
            for p in proxies:
                if isinstance(p, dict) and "fingerprint" in p:
                    return False
            if proxies:
                return True
        return False
    # base64 编码订阅（纯 base64 字符集且较长）→ mihomo v2ray 订阅格式可解析
    compact = re.sub(r"\s+", "", text)
    if re.fullmatch(r"[A-Za-z0-9+/=]+", compact) and len(compact) > 32:
        return True
    return False


def convert_http_providers_to_inline(config: dict[str, Any]) -> dict[str, Any]:
    """合并后：把 override.js 生成的 `type: http` 节点 provider 抓取+解析成
    `type: inline`，从而兼容"完整 Clash 配置"（如 list.meta.yml 含
    proxy-groups/rules）与 `.txt` 分享链接这类 mihomo 运行时解析失败（0 节点）的源。

    设计要点（保证自定义分组不受影响）：
    - 必须在 apply_js_override 之后调用：override.js 负责建 provider + 自定义分组，
      本函数只替换 provider 的"内容来源"，不碰分组。
    - provider 名保持不变（如 Paid_1 / Free_2），所以分组里的 `use:` 引用照常生效。
    - 保留 override.js 写进 provider 的 `override`（如 additional-suffix @PAID/@FREE）
      与 `health-check` 字段，节点命名/测速行为与原 http provider 一致。
    - 抓取或解析失败时不转换，保留原 http provider 让 mihomo 运行时兜底，
      不影响其它正常订阅。
    - 默认策略：标准订阅格式（YAML 仅含 proxies / base64 编码）保持 http 直连，
      由 mihomo 运行时抓取（userinfo 头/节点自动更新天然可用）；
      只有 mihomo http provider 解析不了的形态（完整 Clash 配置含 proxy-groups/rules、
      明文 .txt 分享链接）才转 inline。
    """
    providers = config.get("proxy-providers")
    if not isinstance(providers, dict):
        return config

    userinfo_cache = load_subscription_userinfo_cache()
    changed_userinfo = False

    for pname, pdict in list(providers.items()):
        if not isinstance(pdict, dict):
            continue
        if pdict.get("type") != "http":
            continue
        if "behavior" in pdict:  # rule-provider（geo 规则集），跳过
            continue
        url = str(pdict.get("url", "")).strip()
        if not url:
            continue

        try:
            proxies, raw_text, userinfo = fetch_subscription({"name": pname, "url": url})
        except Exception as exc:
            log(f"provider[{pname}]: fetch/parse failed -> {exc}; 保留 http 让 mihomo 运行时解析")
            continue
        if not proxies:
            log(f"provider[{pname}]: 0 nodes; 保留 http 让 mihomo 运行时解析")
            continue

        # 标准订阅格式 → 保持 http 直连（mihomo 运行时抓取，userinfo/节点自动更新）。
        # 清理历史 inline 缓存，避免误展示过期信息。
        if _http_provider_compatible(raw_text):
            log(f"provider[{pname}]: 标准订阅格式，保持 http 直连")
            if pname in userinfo_cache:
                del userinfo_cache[pname]
                changed_userinfo = True
            continue

        # 注意：mihomo 的 inline provider 用 `payload` 字段承载节点（不是 `proxies`），
        # 用错字段会导致 provider 解析失败（"file doesn't have any proxy"）。
        new_provider: dict[str, Any] = {"type": "inline", "payload": proxies}
        if "health-check" in pdict:
            new_provider["health-check"] = pdict["health-check"]
        if "override" in pdict:
            new_provider["override"] = pdict["override"]
        providers[pname] = new_provider
        log(f"provider[{pname}]: http->inline, {len(proxies)} nodes")

        # 转 inline 后 mihomo 不再抓取该 URL，subscription-userinfo 头（流量/到期）
        # 由 Python 抓取时解析缓存，供 api_server 展示。
        if userinfo:
            userinfo_cache[pname] = userinfo
            changed_userinfo = True
        elif pname in userinfo_cache:
            del userinfo_cache[pname]
            changed_userinfo = True

    if changed_userinfo:
        save_subscription_userinfo_cache(userinfo_cache)

    return config


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
            encoding="utf-8",
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
            proxies, raw_text, _ = fetch_subscription(sub)
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
    # override.js 已建好 proxy-providers(http) + 自定义分组；这里把 http provider
    # 抓取解析成 inline，兼容完整配置/.txt（provider 名不变，分组 use: 照常生效）
    config = convert_http_providers_to_inline(config)
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
