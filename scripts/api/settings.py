"""
DEPRECATED: This module is kept for backward compatibility only.

New code should use `api.common.config.get_config()` directly.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ApiSettings:
    """API settings - backward compatibility wrapper."""
    base_dir: Path
    scripts_dir: Path
    project_dir: Path
    web_dir: Path


def load_settings() -> ApiSettings:
    """Load API settings from unified config."""
    from api.common.config import get_config
    cfg = get_config()
    return ApiSettings(
        base_dir=cfg.paths.base_dir,
        scripts_dir=cfg.paths.scripts_dir,
        project_dir=cfg.paths.project_dir,
        web_dir=cfg.paths.web_dir,
    )

