from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ApiSettings:
    base_dir: Path
    scripts_dir: Path
    project_dir: Path
    web_dir: Path


def load_settings() -> ApiSettings:
    base_dir = Path(os.environ.get("MIHOMO_DIR", "/root/.config/mihomo"))
    scripts_dir = Path(os.environ.get("SCRIPTS_DIR", "/scripts"))
    project_dir = scripts_dir.parent
    web_dir = Path(os.environ.get("WEB_DIR", str(project_dir / "web")))
    return ApiSettings(
        base_dir=base_dir,
        scripts_dir=scripts_dir,
        project_dir=project_dir,
        web_dir=web_dir,
    )

