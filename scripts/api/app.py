from __future__ import annotations

from flask import Flask

from api_server import app as legacy_app


def create_app() -> Flask:
    return legacy_app


app = create_app()

