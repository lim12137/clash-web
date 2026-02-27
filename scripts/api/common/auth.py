from __future__ import annotations

from functools import wraps
from typing import Callable, TypeVar

from flask import request

from .responses import json_error

_ADMIN_TOKEN = ""
Fn = TypeVar("Fn", bound=Callable)


def configure_write_auth(admin_token: str) -> None:
    global _ADMIN_TOKEN
    _ADMIN_TOKEN = str(admin_token or "").strip()


def require_write_auth(fn: Fn) -> Fn:
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not _ADMIN_TOKEN:
            return fn(*args, **kwargs)
        header_value = request.headers.get("Authorization", "")
        direct_token = request.headers.get("X-Admin-Token", "")
        token = ""
        if header_value.lower().startswith("bearer "):
            token = header_value[7:].strip()
        if not token:
            token = direct_token.strip()
        if token != _ADMIN_TOKEN:
            return json_error("Unauthorized", 401)
        return fn(*args, **kwargs)

    return wrapper  # type: ignore[return-value]

