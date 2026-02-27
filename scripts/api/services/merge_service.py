from __future__ import annotations

import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Callable


class MergeService:
    def __init__(
        self,
        *,
        python_bin: str,
        merge_script_file: Path,
        schedule_file: Path,
        schedule_history_file: Path,
        max_schedule_history: int,
        load_json: Callable[[Path, object], object],
        save_json: Callable[[Path, object], None],
        emit_log: Callable[..., None],
        reload_clash: Callable[[], bool],
        merge_lock,
        schedule_lock,
        history_lock,
    ) -> None:
        self.python_bin = python_bin
        self.merge_script_file = merge_script_file
        self.schedule_file = schedule_file
        self.schedule_history_file = schedule_history_file
        self.max_schedule_history = max_schedule_history
        self.load_json = load_json
        self.save_json = save_json
        self.emit_log = emit_log
        self.reload_clash = reload_clash
        self.merge_lock = merge_lock
        self.schedule_lock = schedule_lock
        self.history_lock = history_lock

    def default_schedule(self) -> dict:
        return {
            "enabled": False,
            "interval_minutes": 60,
            "next_run": None,
            "last_run": None,
            "last_status": "",
        }

    def sanitize_schedule(self, data: dict) -> dict:
        payload = self.default_schedule()
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

    def load_schedule(self) -> dict:
        raw = self.load_json(self.schedule_file, self.default_schedule())
        if not isinstance(raw, dict):
            raw = {}
        return self.sanitize_schedule(raw)

    def save_schedule(self, data: dict) -> dict:
        payload = self.sanitize_schedule(data)
        self.save_json(self.schedule_file, payload)
        return payload

    def default_schedule_history(self) -> dict:
        return {"items": []}

    def sanitize_schedule_history_items(self, items) -> list[dict]:
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

        if len(rows) > self.max_schedule_history:
            rows = rows[-self.max_schedule_history :]
        return rows

    def load_schedule_history(self) -> list[dict]:
        raw = self.load_json(self.schedule_history_file, self.default_schedule_history())
        if not isinstance(raw, dict):
            raw = {}
        return self.sanitize_schedule_history_items(raw.get("items", []))

    def save_schedule_history(self, items: list[dict]) -> None:
        payload = {"items": self.sanitize_schedule_history_items(items)}
        self.save_json(self.schedule_history_file, payload)

    def now_iso(self) -> str:
        return datetime.now().replace(microsecond=0).isoformat()

    def add_minutes_iso(self, minutes: int) -> str:
        next_dt = datetime.now().timestamp() + minutes * 60
        return datetime.fromtimestamp(next_dt).replace(microsecond=0).isoformat()

    def append_schedule_history(
        self,
        *,
        trigger: str,
        do_reload: bool,
        status: str,
        message: str,
        started_at: str | None = None,
        ended_at: str | None = None,
    ) -> None:
        entry = {
            "started_at": started_at or self.now_iso(),
            "ended_at": ended_at or self.now_iso(),
            "trigger": trigger,
            "action": "merge_and_reload" if do_reload else "merge",
            "status": status,
            "message": message,
        }
        with self.history_lock:
            items = self.load_schedule_history()
            items.append(entry)
            self.save_schedule_history(items)

    def run_merge_job(self, *, do_reload: bool, trigger: str) -> tuple[bool, str]:
        self.emit_log(f"{trigger}: merge started")
        try:
            process = subprocess.run(
                [self.python_bin, str(self.merge_script_file), "merge"],
                capture_output=True,
                text=True,
                timeout=240,
            )
        except subprocess.TimeoutExpired:
            self.emit_log(f"{trigger}: merge timeout", "ERROR")
            return False, "merge timeout"
        except Exception as exc:
            self.emit_log(f"{trigger}: merge error {exc}", "ERROR")
            return False, f"merge error: {exc}"

        stdout = (process.stdout or "").strip()
        stderr = (process.stderr or "").strip()
        if stdout:
            for line in stdout.splitlines():
                self.emit_log(line)
        if stderr:
            for line in stderr.splitlines():
                self.emit_log(line, "WARN")

        if process.returncode != 0:
            self.emit_log(f"{trigger}: merge failed, rc={process.returncode}", "ERROR")
            return False, f"merge failed rc={process.returncode}"

        if do_reload:
            ok = self.reload_clash()
            if ok:
                self.emit_log(f"{trigger}: reload done", "SUCCESS")
                return True, "merge and reload success"
            self.emit_log(f"{trigger}: reload failed", "ERROR")
            return False, "merge success but reload failed"

        self.emit_log(f"{trigger}: merge done", "SUCCESS")
        return True, "merge success"

    def start_merge_job(self, *, do_reload: bool, trigger: str) -> bool:
        if not self.merge_lock.acquire(blocking=False):
            return False

        def runner() -> None:
            started_at = self.now_iso()
            success = False
            message = "unknown"
            try:
                success, message = self.run_merge_job(do_reload=do_reload, trigger=trigger)
            finally:
                ended_at = self.now_iso()
                self.append_schedule_history(
                    trigger=trigger,
                    do_reload=do_reload,
                    status="success" if success else "failed",
                    message=message,
                    started_at=started_at,
                    ended_at=ended_at,
                )
                if trigger == "scheduler":
                    with self.schedule_lock:
                        schedule = self.load_schedule()
                        schedule["last_run"] = ended_at
                        schedule["last_status"] = "success" if success else "failed"
                        self.save_schedule(schedule)
                self.merge_lock.release()

        threading.Thread(target=runner, daemon=True).start()
        return True

    def scheduler_loop(self) -> None:
        while True:
            time.sleep(5)
            with self.schedule_lock:
                schedule = self.load_schedule()

            if not schedule.get("enabled", False):
                continue

            next_run = str(schedule.get("next_run") or "").strip()
            if not next_run:
                schedule["next_run"] = self.add_minutes_iso(schedule["interval_minutes"])
                with self.schedule_lock:
                    self.save_schedule(schedule)
                continue

            try:
                next_dt = datetime.fromisoformat(next_run)
            except Exception:
                schedule["next_run"] = self.add_minutes_iso(schedule["interval_minutes"])
                with self.schedule_lock:
                    self.save_schedule(schedule)
                continue

            if datetime.now() < next_dt:
                continue

            started_at = self.now_iso()
            started = self.start_merge_job(do_reload=True, trigger="scheduler")
            schedule["last_run"] = started_at
            schedule["last_status"] = "started" if started else "skipped_busy"
            schedule["next_run"] = self.add_minutes_iso(schedule["interval_minutes"])
            with self.schedule_lock:
                self.save_schedule(schedule)

            if started:
                self.emit_log("scheduler: merge+reload launched")
            else:
                self.append_schedule_history(
                    trigger="scheduler",
                    do_reload=True,
                    status="skipped_busy",
                    message="skip because previous merge task is running",
                    started_at=started_at,
                    ended_at=started_at,
                )
                self.emit_log("scheduler: skipped, merge busy", "WARN")
