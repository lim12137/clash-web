from __future__ import annotations

import gzip
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import tempfile
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Callable
from urllib.parse import quote

import requests


class KernelService:
    def __init__(
        self,
        *,
        base_dir: Path,
        config_file: Path,
        scripts_dir: Path,
        mihomo_core_dir: Path,
        mihomo_bin: Path,
        mihomo_prev_bin: Path,
        core_update_api: str,
        default_core_repo: str,
        core_update_allowed_repos: set[str],
        core_update_require_checksum: bool,
        core_update_download_timeout: int,
        core_update_restart_delay: float,
        kernel_update_log_file: Path,
        emit_log: Callable[..., None],
        kernel_update_lock,
        restart_lock: threading.Lock,
    ) -> None:
        self.base_dir = base_dir
        self.config_file = config_file
        self.scripts_dir = scripts_dir
        self.mihomo_core_dir = mihomo_core_dir
        self.mihomo_bin = mihomo_bin
        self.mihomo_prev_bin = mihomo_prev_bin
        self.core_update_api = core_update_api
        self.default_core_repo = default_core_repo
        self.core_update_allowed_repos = set(core_update_allowed_repos)
        self.core_update_require_checksum = bool(core_update_require_checksum)
        self.core_update_download_timeout = int(core_update_download_timeout)
        self.core_update_restart_delay = float(core_update_restart_delay)
        self.kernel_update_log_file = kernel_update_log_file
        self.emit_log = emit_log
        self.kernel_update_lock = kernel_update_lock
        self.restart_lock = restart_lock
        self.restart_pending = False
        self.safe_repo_re = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")

    def normalize_core_repo(self, value: str) -> str:
        repo = str(value or "").strip()
        if repo.startswith("https://github.com/"):
            repo = repo.split("https://github.com/", 1)[1]
        repo = repo.strip().strip("/")
        if not repo:
            repo = self.default_core_repo
        if not self.safe_repo_re.fullmatch(repo):
            raise ValueError("repo must look like owner/name")
        return repo

    def ensure_core_repo_allowed(self, repo: str) -> None:
        if repo not in self.core_update_allowed_repos:
            allowed = ", ".join(sorted(self.core_update_allowed_repos))
            raise ValueError(f"repo not allowed, allowed={allowed}")

    def detect_core_arch(self) -> str:
        machine = ""
        try:
            machine = str(os.uname().machine).strip().lower()
        except Exception:
            machine = str(os.environ.get("TARGETARCH", "")).strip().lower()

        if machine in {"x86_64", "amd64"}:
            return "amd64"
        if machine in {"aarch64", "arm64"}:
            return "arm64"
        if machine in {"armv7l", "armv7"}:
            return "armv7"
        raise RuntimeError(f"unsupported linux arch: {machine or 'unknown'}")

    def github_headers(self) -> dict:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "clash-web-kernel-updater",
        }
        token = str(os.environ.get("GITHUB_TOKEN", "")).strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def github_get_json(self, url: str, timeout: int = 20) -> dict:
        try:
            resp = requests.get(url, headers=self.github_headers(), timeout=timeout)
        except Exception as exc:
            raise RuntimeError(f"github request failed: {exc}") from exc
        if resp.status_code != 200:
            raise RuntimeError(f"github api error: {resp.status_code}")
        try:
            payload = resp.json()
        except Exception as exc:
            raise RuntimeError(f"github response is not json: {exc}") from exc
        if not isinstance(payload, dict):
            raise RuntimeError("github response is not object")
        return payload

    def fetch_core_release(self, repo: str, tag: str | None = None) -> dict:
        if tag:
            target = quote(tag.strip())
            url = f"{self.core_update_api}/repos/{repo}/releases/tags/{target}"
        else:
            url = f"{self.core_update_api}/repos/{repo}/releases/latest"
        return self.github_get_json(url=url, timeout=20)

    def select_core_release_asset(self, release_payload: dict, arch: str) -> dict:
        assets = release_payload.get("assets", [])
        if not isinstance(assets, list):
            assets = []

        arch_prefix = f"mihomo-linux-{arch}".lower()
        candidates: list[tuple[int, str, dict]] = []
        for item in assets:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name", "")).strip()
            url = str(item.get("browser_download_url", "")).strip()
            if not name or not url:
                continue
            lowered = name.lower()
            if not lowered.endswith(".gz"):
                continue
            if not lowered.startswith(arch_prefix):
                continue
            if "sha256" in lowered or "checksum" in lowered:
                continue

            score = 0
            if "-compatible-" in lowered:
                score += 100
            if "alpha" in lowered or "beta" in lowered or "rc" in lowered:
                score -= 30
            score -= len(name)
            candidates.append((score, name, item))

        if not candidates:
            raise RuntimeError(f"no linux core asset found for arch={arch}")

        candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return candidates[0][2]

    def parse_sha256_from_checksum_text(self, content: str, target_name: str) -> str:
        target = str(target_name or "").strip()
        target_lower = target.lower()
        for raw_line in str(content or "").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            hash_match = re.search(r"\b([A-Fa-f0-9]{64})\b", line)
            if not hash_match:
                continue
            digest = hash_match.group(1).lower()
            lowered = line.lower()
            if target_lower and target_lower in lowered:
                return digest
            legacy = re.match(
                rf"^sha256\s*\(\s*{re.escape(target)}\s*\)\s*=\s*([A-Fa-f0-9]{{64}})$",
                line,
                re.IGNORECASE,
            )
            if legacy:
                return legacy.group(1).lower()
        return ""

    def extract_expected_sha256(
        self,
        release_payload: dict,
        asset_payload: dict,
    ) -> tuple[str, str]:
        digest_text = str(asset_payload.get("digest", "")).strip()
        if digest_text.lower().startswith("sha256:"):
            digest_value = digest_text.split(":", 1)[1].strip().lower()
            if re.fullmatch(r"[a-f0-9]{64}", digest_value):
                return digest_value, "asset.digest"

        asset_name = str(asset_payload.get("name", "")).strip()
        assets = release_payload.get("assets", [])
        if not isinstance(assets, list):
            assets = []

        checksum_candidates: list[dict] = []
        for item in assets:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name", "")).strip().lower()
            if not name:
                continue
            if any(token in name for token in ("sha256", "checksum", "checksums")):
                checksum_candidates.append(item)

        for item in checksum_candidates:
            url = str(item.get("browser_download_url", "")).strip()
            if not url:
                continue
            try:
                with requests.get(url, headers=self.github_headers(), timeout=20) as resp:
                    if resp.status_code != 200:
                        continue
                    expected = self.parse_sha256_from_checksum_text(resp.text, asset_name)
                    if expected:
                        return expected, str(item.get("name", "checksum-file"))
            except Exception:
                continue

        return "", ""

    def download_file_sha256(self, url: str, output_path: Path) -> tuple[str, int]:
        hasher = hashlib.sha256()
        total = 0
        try:
            response = requests.get(
                url,
                stream=True,
                headers=self.github_headers(),
                timeout=(10, self.core_update_download_timeout),
            )
        except Exception as exc:
            raise RuntimeError(f"download failed: {exc}") from exc

        with response:
            if response.status_code != 200:
                raise RuntimeError(f"download failed with status {response.status_code}")

            output_path.parent.mkdir(parents=True, exist_ok=True)
            with output_path.open("wb") as fh:
                for chunk in response.iter_content(chunk_size=1024 * 256):
                    if not chunk:
                        continue
                    fh.write(chunk)
                    hasher.update(chunk)
                    total += len(chunk)

        if total <= 0:
            raise RuntimeError("downloaded file is empty")
        return hasher.hexdigest().lower(), total

    def decompress_gzip_file(self, input_path: Path, output_path: Path) -> int:
        with gzip.open(input_path, "rb") as src, output_path.open("wb") as dst:
            shutil.copyfileobj(src, dst)
        size = output_path.stat().st_size if output_path.exists() else 0
        if size <= 0:
            raise RuntimeError("decompressed core is empty")
        os.chmod(output_path, 0o755)
        return size

    def run_cmd(self, args: list[str], timeout: int = 20) -> tuple[int, str, str]:
        try:
            result = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            return -1, "", f"timeout ({timeout}s)"
        except Exception as exc:
            return -1, "", str(exc)
        return result.returncode, (result.stdout or "").strip(), (result.stderr or "").strip()

    def read_core_version(self, bin_path: Path) -> str:
        if not bin_path.exists():
            return ""
        rc, stdout, stderr = self.run_cmd([str(bin_path), "-v"], timeout=8)
        if rc != 0:
            return ""
        text = stdout or stderr
        if not text:
            return ""
        first = text.splitlines()[0].strip()
        return first

    def verify_core_binary(self, bin_path: Path) -> tuple[bool, str]:
        if not bin_path.exists():
            return False, "core binary not found"
        if not os.access(bin_path, os.X_OK):
            try:
                os.chmod(bin_path, 0o755)
            except Exception:
                pass

        rc, stdout, stderr = self.run_cmd([str(bin_path), "-v"], timeout=10)
        if rc != 0:
            msg = stderr or stdout or "unknown error"
            return False, f"core -v failed: {msg}"

        if self.config_file.exists():
            rc, stdout, stderr = self.run_cmd(
                [str(bin_path), "-t", "-d", str(self.base_dir), "-f", str(self.config_file)],
                timeout=45,
            )
            if rc != 0:
                msg = stderr or stdout or "unknown error"
                return False, f"core -t failed: {msg}"

        return True, ""

    def append_kernel_update_history(self, payload: dict) -> None:
        row = {
            "time": datetime.now().replace(microsecond=0).isoformat(),
            **(payload if isinstance(payload, dict) else {}),
        }
        try:
            self.kernel_update_log_file.parent.mkdir(parents=True, exist_ok=True)
            with self.kernel_update_log_file.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
        except Exception as exc:
            self.emit_log(f"kernel update history write failed: {exc}", "WARN")

    def read_kernel_update_history(self, limit: int = 50) -> list[dict]:
        if limit <= 0:
            return []
        if not self.kernel_update_log_file.exists():
            return []
        try:
            lines = self.kernel_update_log_file.read_text(encoding="utf-8").splitlines()
        except Exception:
            return []
        rows: list[dict] = []
        for line in lines[-limit:]:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except Exception:
                continue
            if isinstance(item, dict):
                rows.append(item)
        return rows

    def schedule_self_restart(self, reason: str) -> bool:
        with self.restart_lock:
            if self.restart_pending:
                return False
            self.restart_pending = True

        def runner() -> None:
            self.emit_log(f"process restart scheduled: {reason}", "WARN")
            time.sleep(self.core_update_restart_delay)
            if os.name == "posix":
                pid_text = str(os.environ.get("CONTAINER_INIT_PID", "1")).strip()
                try:
                    pid = int(pid_text)
                except ValueError:
                    pid = 1
                try:
                    os.kill(pid, signal.SIGTERM)
                    return
                except Exception as exc:
                    self.emit_log(f"failed to signal pid {pid}: {exc}", "WARN")
            os._exit(0)

        threading.Thread(target=runner, daemon=True).start()
        return True

    def collect_kernel_status(self) -> dict:
        with self.restart_lock:
            pending_restart = self.restart_pending
        return {
            "core_dir": str(self.mihomo_core_dir),
            "core_bin": str(self.mihomo_bin),
            "core_prev_bin": str(self.mihomo_prev_bin),
            "core_exists": self.mihomo_bin.exists(),
            "core_prev_exists": self.mihomo_prev_bin.exists(),
            "core_version": self.read_core_version(self.mihomo_bin),
            "allowed_repos": sorted(self.core_update_allowed_repos),
            "default_repo": self.default_core_repo,
            "require_checksum": self.core_update_require_checksum,
            "updating": self.kernel_update_lock.locked(),
            "restart_pending": pending_restart,
        }

    def perform_kernel_update(self, repo: str, tag: str | None = None) -> dict:
        if os.name != "posix":
            raise RuntimeError("kernel update is only supported on Linux container runtime")
        core_repo = self.normalize_core_repo(repo)
        self.ensure_core_repo_allowed(core_repo)
        arch = self.detect_core_arch()

        release = self.fetch_core_release(core_repo, tag=tag)
        release_tag = str(release.get("tag_name", "")).strip()
        if not release_tag:
            raise RuntimeError("release tag not found")

        asset = self.select_core_release_asset(release_payload=release, arch=arch)
        asset_name = str(asset.get("name", "")).strip()
        asset_url = str(asset.get("browser_download_url", "")).strip()
        if not asset_name or not asset_url:
            raise RuntimeError("release asset is invalid")

        expected_sha256, checksum_source = self.extract_expected_sha256(release, asset)
        if not expected_sha256 and self.core_update_require_checksum:
            raise RuntimeError("checksum not found in release assets")

        old_version = self.read_core_version(self.mihomo_bin)
        self.mihomo_core_dir.mkdir(parents=True, exist_ok=True)

        self.emit_log(f"kernel update: repo={core_repo} tag={release_tag} arch={arch}")
        self.emit_log(f"kernel update: selected asset={asset_name}")
        if expected_sha256:
            self.emit_log(f"kernel update: checksum source={checksum_source}")

        with tempfile.TemporaryDirectory(
            dir=str(self.mihomo_core_dir),
            prefix="kernel-update-",
        ) as tmp_dir_raw:
            tmp_dir = Path(tmp_dir_raw)
            download_path = tmp_dir / asset_name
            candidate_path = tmp_dir / "mihomo.candidate"

            downloaded_sha256, download_size = self.download_file_sha256(asset_url, download_path)
            self.emit_log(f"kernel update: downloaded {asset_name} ({download_size} bytes)")

            if expected_sha256:
                if downloaded_sha256 != expected_sha256:
                    raise RuntimeError(
                        (
                            "checksum mismatch: "
                            f"expected={expected_sha256}, actual={downloaded_sha256}"
                        )
                    )
                self.emit_log("kernel update: checksum verified", "SUCCESS")
            else:
                self.emit_log("kernel update: checksum skipped by config", "WARN")

            decompressed_size = self.decompress_gzip_file(download_path, candidate_path)
            self.emit_log(f"kernel update: decompressed core size={decompressed_size} bytes")

            ok, msg = self.verify_core_binary(candidate_path)
            if not ok:
                raise RuntimeError(f"candidate check failed: {msg}")
            self.emit_log("kernel update: candidate self-check passed", "SUCCESS")

            replaced = False
            if self.mihomo_bin.exists():
                os.replace(self.mihomo_bin, self.mihomo_prev_bin)
                replaced = True

            try:
                os.replace(candidate_path, self.mihomo_bin)
                os.chmod(self.mihomo_bin, 0o755)
            except Exception:
                if replaced and self.mihomo_prev_bin.exists():
                    try:
                        os.replace(self.mihomo_prev_bin, self.mihomo_bin)
                    except Exception:
                        pass
                raise

        ok, msg = self.verify_core_binary(self.mihomo_bin)
        if not ok:
            if self.mihomo_prev_bin.exists():
                try:
                    os.replace(self.mihomo_prev_bin, self.mihomo_bin)
                except Exception:
                    pass
            raise RuntimeError(f"installed core check failed: {msg}")

        new_version = self.read_core_version(self.mihomo_bin)
        return {
            "repo": core_repo,
            "release_tag": release_tag,
            "asset_name": asset_name,
            "arch": arch,
            "old_version": old_version,
            "new_version": new_version,
            "downloaded_sha256": downloaded_sha256,
            "checksum": expected_sha256,
            "checksum_source": checksum_source,
        }
