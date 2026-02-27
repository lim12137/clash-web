"""
Unified configuration management for nexent project.

Centralizes all environment variables and paths with validation.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal


def _parse_bool(env_var: str, default: bool = False) -> bool:
    """Parse boolean environment variable."""
    value = os.environ.get(env_var, "").strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_int(env_var: str, default: int, min_val: int | None = None) -> int:
    """Parse integer environment variable with optional minimum value."""
    try:
        value = int(os.environ.get(env_var, str(default)))
        if min_val is not None and value < min_val:
            return default
        return value
    except ValueError:
        return default


def _parse_float(env_var: str, default: float, min_val: float | None = None) -> float:
    """Parse float environment variable with optional minimum value."""
    try:
        value = float(os.environ.get(env_var, str(default)))
        if min_val is not None and value < min_val:
            return default
        return value
    except ValueError:
        return default


def _parse_str_set(env_var: str, default: str, separator: str = ",") -> set[str]:
    """Parse comma-separated string into set."""
    raw = os.environ.get(env_var, default)
    return {item.strip() for item in raw.split(separator) if item.strip()}


@dataclass(frozen=True)
class PathConfig:
    """All path configurations."""

    base_dir: Path = field(default_factory=lambda: Path(os.environ.get("MIHOMO_DIR", "/root/.config/mihomo")))
    scripts_dir: Path = field(default_factory=lambda: Path(os.environ.get("SCRIPTS_DIR", "/scripts")))
    web_dir: Path = field(init=False)
    mihomo_core_dir: Path = field(default_factory=lambda: Path(os.environ.get("MIHOMO_CORE_DIR", "/opt/mihomo-core")))

    project_dir: Path = field(init=False)
    subs_dir: Path = field(init=False)
    backup_dir: Path = field(init=False)

    def __post_init__(self):
        """Derive dependent paths."""
        project_dir = self.scripts_dir.parent
        object.__setattr__(self, "project_dir", project_dir)
        object.__setattr__(self, "web_dir", Path(os.environ.get("WEB_DIR", str(project_dir / "web"))))
        object.__setattr__(self, "subs_dir", self.base_dir / "subs")
        object.__setattr__(self, "backup_dir", self.base_dir / "backups")

    @property
    def config_file(self) -> Path:
        return self.base_dir / "config.yaml"

    @property
    def mihomo_bin(self) -> Path:
        return Path(os.environ.get("MIHOMO_BIN", str(self.mihomo_core_dir / "mihomo")))

    @property
    def mihomo_prev_bin(self) -> Path:
        return Path(os.environ.get("MIHOMO_PREV_BIN", str(self.mihomo_core_dir / "mihomo.prev")))


@dataclass(frozen=True)
class ScriptPaths:
    """Paths to script files in scripts_dir."""

    subs_config: Path
    override_file: Path
    override_script_file: Path
    template_file: Path
    site_policy_file: Path
    subscription_sets_file: Path
    schedule_file: Path
    schedule_history_file: Path
    provider_recovery_file: Path
    merge_script_file: Path
    proxy_records_file: Path
    kernel_update_log_file: Path

    @staticmethod
    def from_scripts_dir(scripts_dir: Path) -> "ScriptPaths":
        """Create ScriptPaths from scripts directory."""
        return ScriptPaths(
            subs_config=scripts_dir / "subscriptions.json",
            override_file=scripts_dir / "override.yaml",
            override_script_file=scripts_dir / "override.js",
            template_file=scripts_dir / "template.yaml",
            site_policy_file=scripts_dir / "site_policy.yaml",
            subscription_sets_file=scripts_dir / "subscription_sets.json",
            schedule_file=scripts_dir / "schedule.json",
            schedule_history_file=scripts_dir / "schedule_history.json",
            provider_recovery_file=scripts_dir / "provider_recovery_state.json",
            merge_script_file=scripts_dir / "merge.py",
            proxy_records_file=scripts_dir / "proxy_records.json",
            kernel_update_log_file=scripts_dir / "kernel_update_history.jsonl",
        )


@dataclass(frozen=True)
class AuthConfig:
    """Authentication and security configuration."""

    clash_secret: str = field(default_factory=lambda: os.environ.get("CLASH_SECRET", ""))
    admin_token: str = field(default_factory=lambda: os.environ.get("ADMIN_TOKEN", ""))
    clash_api: str = field(default_factory=lambda: os.environ.get("CLASH_API", "http://127.0.0.1:9090"))

    @property
    def has_admin_token(self) -> bool:
        """Check if admin token is set (non-empty)."""
        return bool(self.admin_token.strip())

    @property
    def has_clash_secret(self) -> bool:
        """Check if clash secret is set (non-empty)."""
        return bool(self.clash_secret.strip())


@dataclass(frozen=True)
class KernelUpdateConfig:
    """Kernel update configuration."""

    api_url: str = field(default_factory=lambda: os.environ.get("CORE_UPDATE_API", "https://api.github.com").rstrip("/"))
    default_repo: str = field(
        default_factory=lambda: str(os.environ.get("CORE_UPDATE_REPO", "MetaCubeX/mihomo")).strip()
        or "MetaCubeX/mihomo"
    )
    allowed_repos: set[str] = field(init=False)
    require_checksum: bool = field(default_factory=lambda: _parse_bool("CORE_UPDATE_REQUIRE_CHECKSUM", True))
    download_timeout: int = field(default_factory=lambda: _parse_int("CORE_UPDATE_DOWNLOAD_TIMEOUT", 180, min_val=20))
    restart_delay: float = field(default_factory=lambda: _parse_float("CORE_UPDATE_RESTART_DELAY", 1.5, min_val=0.5))
    github_token: str = field(default_factory=lambda: os.environ.get("GITHUB_TOKEN", ""))

    def __post_init__(self):
        """Initialize allowed repos with default included."""
        raw_repos = os.environ.get("CORE_UPDATE_ALLOWED_REPOS", self.default_repo)
        repos = _parse_str_set("CORE_UPDATE_ALLOWED_REPOS", self.default_repo)
        if self.default_repo not in repos:
            repos.add(self.default_repo)
        object.__setattr__(self, "allowed_repos", repos)


@dataclass(frozen=True)
class ProviderConfig:
    """Provider auto-refresh configuration."""

    max_per_day: int = field(default_factory=lambda: _parse_int("PROVIDER_AUTO_REFRESH_MAX_PER_DAY", 3, min_val=1))
    check_interval: int = field(default_factory=lambda: _parse_int("PROVIDER_RECOVERY_CHECK_INTERVAL", 60, min_val=10))
    zero_alive_minutes: int = field(default_factory=lambda: _parse_int("PROVIDER_ZERO_ALIVE_MINUTES", 30, min_val=1))
    enabled: bool = field(default_factory=lambda: _parse_bool("PROVIDER_AUTO_REFRESH_ENABLED", True))


@dataclass(frozen=True)
class ConnectionRecordConfig:
    """Connection recording configuration."""

    enabled: bool = field(default_factory=lambda: _parse_bool("CONNECTION_RECORD_ENABLED", True))
    interval: int = field(default_factory=lambda: _parse_int("CONNECTION_RECORD_INTERVAL", 6, min_val=3))
    max_records: int = field(default_factory=lambda: _parse_int("MAX_PROXY_RECORDS", 1000, min_val=100))


@dataclass(frozen=True)
class RuntimeConfig:
    """Runtime execution configuration."""

    python_bin: str = field(default_factory=lambda: os.environ.get("PYTHON_BIN", "/usr/bin/python3"))
    node_bin: str = field(default_factory=lambda: os.environ.get("NODE_BIN", "node"))
    js_validate_timeout: int = field(default_factory=lambda: _parse_int("JS_VALIDATE_TIMEOUT", 10))
    js_override_timeout: int = field(default_factory=lambda: _parse_int("JS_OVERRIDE_TIMEOUT", 20))
    sub_request_timeout: int = field(default_factory=lambda: _parse_int("SUB_REQUEST_TIMEOUT", 20))
    clash_reload_path: str = field(default_factory=lambda: os.environ.get("CLASH_RELOAD_PATH", "").strip())


@dataclass(frozen=True)
class ServerConfig:
    """API server configuration."""

    host: str = field(default_factory=lambda: os.environ.get("API_HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: _parse_int("API_PORT", 19092))
    public_host: str = field(default_factory=lambda: os.environ.get("PUBLIC_HOST", "").strip())
    web_port: int | None = field(default=None)
    mixed_port: int | None = field(default=None)
    socks_port: int | None = field(default=None)
    controller_port: int | None = field(default=None)


@dataclass(frozen=True)
class Constants:
    """Application constants."""

    max_schedule_history: int = 200
    system_proxy_names: frozenset[str] = field(default_factory=lambda: frozenset({
        "DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE"
    }))
    safe_name_pattern: re.Pattern = field(default_factory=lambda: re.compile(r"^[A-Za-z0-9._-]{1,64}$"))
    safe_repo_pattern: re.Pattern = field(default_factory=lambda: re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$"))
    auto_set_block_start: str = "// === AUTO-SUB-SETS:START ==="
    auto_set_block_end: str = "// === AUTO-SUB-SETS:END ==="


@dataclass(frozen=True)
class Config:
    """Root configuration container."""

    paths: PathConfig = field(default_factory=PathConfig)
    script_paths: ScriptPaths = field(init=False)
    auth: AuthConfig = field(default_factory=AuthConfig)
    kernel_update: KernelUpdateConfig = field(default_factory=KernelUpdateConfig)
    provider: ProviderConfig = field(default_factory=ProviderConfig)
    connection_record: ConnectionRecordConfig = field(default_factory=ConnectionRecordConfig)
    runtime: RuntimeConfig = field(default_factory=RuntimeConfig)
    server: ServerConfig = field(default_factory=ServerConfig)
    constants: Constants = field(default_factory=Constants)

    def __post_init__(self):
        """Derive script paths from scripts_dir."""
        object.__setattr__(
            self,
            "script_paths",
            ScriptPaths.from_scripts_dir(self.paths.scripts_dir),
        )

    def validate_security(self) -> list[str]:
        """Validate security-critical settings. Returns list of warnings."""
        warnings = []

        if not self.auth.has_admin_token:
            warnings.append("ADMIN_TOKEN is not set - write operations will not require authentication")

        if not self.auth.has_clash_secret:
            warnings.append("CLASH_SECRET is not set - Clash API communication may fail")

        if len(self.kernel_update.allowed_repos) > 1:
            warnings.append(f"Multiple repos allowed for kernel updates: {self.kernel_update.allowed_repos}")

        return warnings


# Global configuration singleton
_config: Config | None = None


def get_config() -> Config:
    """Get global configuration singleton."""
    global _config
    if _config is None:
        _config = Config()
    return _config


def reload_config() -> Config:
    """Force reload configuration (useful for testing)."""
    global _config
    _config = Config()
    return _config
