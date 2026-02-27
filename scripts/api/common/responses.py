from __future__ import annotations

from flask import jsonify


def json_error(message: str, status: int = 400):
    return jsonify({"success": False, "error": message}), status

