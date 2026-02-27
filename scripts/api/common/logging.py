from __future__ import annotations

import queue
import threading
from datetime import datetime

log_lock = threading.Lock()
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


def get_recent_logs(limit: int = 200) -> list[dict]:
    with log_lock:
        return list(log_history[-limit:])


def subscribe_log_queue(maxsize: int = 128, history_limit: int = 30) -> tuple[queue.Queue, list[dict]]:
    q: queue.Queue = queue.Queue(maxsize=maxsize)
    with log_lock:
        log_queues.append(q)
        history = list(log_history[-history_limit:])
    return q, history


def unsubscribe_log_queue(item: queue.Queue) -> None:
    with log_lock:
        try:
            log_queues.remove(item)
        except ValueError:
            pass

