import os
import sys
from unittest.mock import MagicMock, AsyncMock
import pytest
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.testclient import TestClient


# Dynamically determine the backend path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../backend"))
sys.path.append(backend_dir)


# Pre-mock heavy dependencies before importing router
sys.modules['consts'] = MagicMock()
sys.modules['consts.model'] = MagicMock()
# Provide stub for consts.exceptions with expected exception classes
# so that imports in application code succeed during tests.
# We intentionally use real classes (not MagicMock) so that isinstance checks work if present.

import types

consts_exceptions_mod = types.ModuleType("consts.exceptions")


class LimitExceededError(Exception):
    pass


class UnauthorizedError(Exception):
    pass


class SignatureValidationError(Exception):
    pass


consts_exceptions_mod.LimitExceededError = LimitExceededError
consts_exceptions_mod.UnauthorizedError = UnauthorizedError
consts_exceptions_mod.SignatureValidationError = SignatureValidationError

# Ensure the parent 'consts' is a module (could be MagicMock) and register submodule.
import sys as _sys
if 'consts' not in _sys.modules or not isinstance(_sys.modules['consts'], types.ModuleType):
    consts_root = types.ModuleType("consts")
    consts_root.__path__ = []
    _sys.modules['consts'] = consts_root
else:
    consts_root = _sys.modules['consts']

consts_root.exceptions = consts_exceptions_mod
_sys.modules['consts.exceptions'] = consts_exceptions_mod
sys.modules['services'] = MagicMock()
sys.modules['services.northbound_service'] = MagicMock()
sys.modules['utils'] = MagicMock()
sys.modules['utils.auth_utils'] = MagicMock()

# Import router after setting mocks
from apps.northbound_app import router


app = FastAPI()
app.include_router(router)
client = TestClient(app)


def _build_headers(auth="Bearer test_jwt", request_id="req-123", aksk=True):
    headers = {
        "Authorization": auth,
        "X-Request-Id": request_id,
    }
    if aksk:
        headers.update({
            "X-Access-Key": "ak",
            "X-Timestamp": "1710000000",
            "X-Signature": "sig",
        })
    return headers


@pytest.mark.asyncio
async def test_health_check():
    resp = client.get("/nb/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "northbound-api"


def test_run_chat_calls_service(monkeypatch):
    monkeypatch.setattr("apps.northbound_app.validate_aksk_authentication", lambda headers, body: True)
    monkeypatch.setattr("apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))
    async def _gen():
        yield b"data: hello\n\n"
    start_mock = AsyncMock(return_value=StreamingResponse(_gen(), media_type="text/event-stream"))
    monkeypatch.setattr("apps.northbound_app.start_streaming_chat", start_mock)

    payload = {"conversation_id": "nb-1", "agent_name": "agent-a", "query": "hi"}
    headers = {**_build_headers(), "Idempotency-Key": "idem-1"}
    resp = client.post("/nb/v1/chat/run", json=payload, headers=headers)

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]
    # Validate call into service
    assert start_mock.await_count == 1
    args, kwargs = start_mock.call_args
    assert kwargs["external_conversation_id"] == "nb-1"
    assert kwargs["agent_name"] == "agent-a"
    assert kwargs["query"] == "hi"
    assert kwargs["idempotency_key"] == "idem-1"


def test_stop_chat_calls_service(monkeypatch):
    monkeypatch.setattr("apps.northbound_app.validate_aksk_authentication", lambda headers, body=None: True)
    monkeypatch.setattr("apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))
    stop_mock = AsyncMock(return_value={"message": "success"})
    monkeypatch.setattr("apps.northbound_app.stop_chat", stop_mock)

    resp = client.get("/nb/v1/chat/stop/nb-2", headers=_build_headers())
    assert resp.status_code == 200
    assert stop_mock.await_count == 1


def test_get_history_calls_service(monkeypatch):
    monkeypatch.setattr("apps.northbound_app.validate_aksk_authentication", lambda headers, body=None: True)
    monkeypatch.setattr("apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))
    hist_mock = AsyncMock(return_value={"message": "success"})
    monkeypatch.setattr("apps.northbound_app.get_conversation_history", hist_mock)

    resp = client.get("/nb/v1/conversations/nb-3", headers=_build_headers())
    assert resp.status_code == 200
    assert hist_mock.await_count == 1


def test_list_agents_calls_service(monkeypatch):
    monkeypatch.setattr("apps.northbound_app.validate_aksk_authentication", lambda headers, body=None: True)
    monkeypatch.setattr("apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))
    agents_mock = AsyncMock(return_value={"message": "success", "data": []})
    monkeypatch.setattr("apps.northbound_app.get_agent_info_list", agents_mock)

    resp = client.get("/nb/v1/agents", headers=_build_headers())
    assert resp.status_code == 200
    assert agents_mock.await_count == 1


def test_list_conversations_calls_service(monkeypatch):
    monkeypatch.setattr("apps.northbound_app.validate_aksk_authentication", lambda headers, body=None: True)
    monkeypatch.setattr("apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))
    list_mock = AsyncMock(return_value={"message": "success", "data": []})
    monkeypatch.setattr("apps.northbound_app.list_conversations", list_mock)

    resp = client.get("/nb/v1/conversations", headers=_build_headers())
    assert resp.status_code == 200
    assert list_mock.await_count == 1


def test_update_title_sets_headers(monkeypatch):
    monkeypatch.setattr("apps.northbound_app.validate_aksk_authentication", lambda headers, body=None: True)
    monkeypatch.setattr("apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))
    # Ensure NorthboundContext yields plain string fields (avoid MagicMock in headers)
    class _NCtx:
        def __init__(self, request_id: str, tenant_id: str, user_id: str, authorization: str):
            self.request_id = request_id
            self.tenant_id = tenant_id
            self.user_id = user_id
            self.authorization = authorization
    monkeypatch.setattr("apps.northbound_app.NorthboundContext", _NCtx)
    update_mock = AsyncMock(return_value={"message": "success", "data": "nb-4", "idempotency_key": "ide-xyz"})
    monkeypatch.setattr("apps.northbound_app.update_conversation_title", update_mock)

    headers = {**_build_headers(request_id="req-999"), "Idempotency-Key": "ide-xyz"}
    resp = client.put("/nb/v1/conversations/nb-4/title", params={"title": "New Title"}, headers=headers)
    assert resp.status_code == 200
    # Router wraps JSONResponse and should echo idempotency and request id
    assert resp.headers.get("Idempotency-Key") == "ide-xyz"
    assert resp.headers.get("X-Request-Id") == "req-999"
    assert update_mock.await_count == 1

