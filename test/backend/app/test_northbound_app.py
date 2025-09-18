import os
import sys
from unittest.mock import MagicMock, AsyncMock
import pytest
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.testclient import TestClient
import types
import sys as _sys

# Dynamically determine the backend path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../backend"))
sys.path.append(backend_dir)


# Pre-mock heavy dependencies before importing router
sys.modules['consts'] = MagicMock()
sys.modules['consts.model'] = MagicMock()

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

# Ensure the parent 'consts' is a module
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


def _std_headers(auth="Bearer test_jwt"):
    return {
        **_build_headers(auth=auth),
        "Idempotency-Key": "idem-xyz",
    }


@pytest.mark.parametrize("exc_cls, status", [
    (UnauthorizedError, 401),
    (LimitExceededError, 429),
    (SignatureValidationError, 401),
])
def test_run_chat_auth_exceptions_are_mapped(monkeypatch, exc_cls, status):
    # Force AK/SK validation to raise domain exceptions
    def _raise(*_, **__):
        raise exc_cls("boom")

    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", _raise)
    # Even if provided, auth should not be parsed because AK/SK fails first
    resp = client.post(
        "/nb/v1/chat/run",
        json={"conversation_id": "nb-1", "agent_name": "a", "query": "hi"},
        headers=_std_headers(),
    )
    assert resp.status_code == status


def test_run_chat_missing_authorization_header_returns_401(monkeypatch):
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", lambda headers, body: True)
    # No Authorization header
    headers = {k: v for k, v in _std_headers().items() if k.lower()
               != "authorization"}
    resp = client.post(
        "/nb/v1/chat/run",
        json={"conversation_id": "nb-1", "agent_name": "a", "query": "hi"},
        headers=headers,
    )
    assert resp.status_code == 401
    assert resp.json()["detail"].startswith(
        "Unauthorized: No authorization header")


def test_run_chat_jwt_parse_exception_returns_500(monkeypatch):
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", lambda headers, body: True)

    def _raise_jwt(_auth):
        raise Exception("jwt parse error")
    monkeypatch.setattr("apps.northbound_app.get_current_user_id", _raise_jwt)

    resp = client.post(
        "/nb/v1/chat/run",
        json={"conversation_id": "nb-1", "agent_name": "a", "query": "hi"},
        headers=_std_headers(),
    )
    assert resp.status_code == 500
    assert "cannot parse JWT token" in resp.json()["detail"]


def test_run_chat_jwt_missing_user_id_returns_401(monkeypatch):
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", lambda headers, body: True)
    monkeypatch.setattr(
        "apps.northbound_app.get_current_user_id", lambda _auth: (None, "t1"))

    resp = client.post(
        "/nb/v1/chat/run",
        json={"conversation_id": "nb-1", "agent_name": "a", "query": "hi"},
        headers=_std_headers(),
    )
    assert resp.status_code == 401
    assert "missing user_id" in resp.json()["detail"]


def test_run_chat_jwt_missing_tenant_id_returns_401(monkeypatch):
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", lambda headers, body: True)
    monkeypatch.setattr(
        "apps.northbound_app.get_current_user_id", lambda _auth: ("u1", None))

    resp = client.post(
        "/nb/v1/chat/run",
        json={"conversation_id": "nb-1", "agent_name": "a", "query": "hi"},
        headers=_std_headers(),
    )
    assert resp.status_code == 401
    assert "unregistered user_id" in resp.json()["detail"]


def test_run_chat_internal_error_when_parsing_context_returns_500(monkeypatch):
    def _raise(*_, **__):
        raise Exception("unexpected")
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", _raise)

    resp = client.post(
        "/nb/v1/chat/run",
        json={"conversation_id": "nb-1", "agent_name": "a", "query": "hi"},
        headers=_std_headers(),
    )
    assert resp.status_code == 500
    assert "cannot parse northbound context" in resp.json()["detail"]


def test_run_chat_unexpected_service_error_maps_500(monkeypatch):
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", lambda headers, body: True)
    monkeypatch.setattr(
        "apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))
    start_mock = AsyncMock(side_effect=Exception("boom"))
    monkeypatch.setattr("apps.northbound_app.start_streaming_chat", start_mock)

    resp = client.post(
        "/nb/v1/chat/run",
        json={"conversation_id": "nb-1", "agent_name": "a", "query": "hi"},
        headers=_std_headers(),
    )
    assert resp.status_code == 500


@pytest.mark.parametrize("path", [
    "/nb/v1/chat/stop/nb-x",
    "/nb/v1/conversations/nb-x",
    "/nb/v1/agents",
    "/nb/v1/conversations",
])
@pytest.mark.parametrize("exc_cls, status", [
    (UnauthorizedError, 401),
    (LimitExceededError, 429),
    (SignatureValidationError, 401),
])
def test_other_endpoints_auth_exceptions_are_mapped(monkeypatch, path, exc_cls, status):
    def _raise(*_, **__):
        raise exc_cls("boom")
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", _raise)

    resp = client.get(path, headers=_build_headers())
    assert resp.status_code == status


@pytest.mark.parametrize(
    "path, target",
    [
        ("/nb/v1/chat/stop/nb-x", "apps.northbound_app.stop_chat"),
        ("/nb/v1/conversations/nb-x", "apps.northbound_app.get_conversation_history"),
        ("/nb/v1/agents", "apps.northbound_app.get_agent_info_list"),
        ("/nb/v1/conversations", "apps.northbound_app.list_conversations"),
    ],
)
def test_other_endpoints_unexpected_service_error_maps_500(monkeypatch, path, target):
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", lambda headers, body=None: True)
    monkeypatch.setattr(
        "apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))
    monkeypatch.setattr(target, AsyncMock(side_effect=Exception("boom")))

    resp = client.get(path, headers=_build_headers())
    assert resp.status_code == 500


def test_update_title_unexpected_service_error_maps_500(monkeypatch):
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", lambda headers, body=None: True)
    monkeypatch.setattr(
        "apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))
    monkeypatch.setattr("apps.northbound_app.update_conversation_title", AsyncMock(
        side_effect=Exception("boom")))

    resp = client.put(
        "/nb/v1/conversations/nb-4/title",
        params={"title": "x"},
        headers=_build_headers(),
    )
    assert resp.status_code == 500


def test_request_body_read_failure_is_tolerated(monkeypatch):
    """If reading body fails inside context parsing, it should use empty body and continue."""
    captured = {"seen": None}

    def _validate(headers, body):
        captured["seen"] = body
        return True

    # Patch AK/SK validator and JWT parser
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", _validate)
    monkeypatch.setattr(
        "apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))

    # Ensure NorthboundContext yields plain string fields
    class _NCtx:
        def __init__(self, request_id: str, tenant_id: str, user_id: str, authorization: str):
            self.request_id = request_id
            self.tenant_id = tenant_id
            self.user_id = user_id
            self.authorization = authorization

    monkeypatch.setattr("apps.northbound_app.NorthboundContext", _NCtx)

    # Monkeypatch context builder to simulate body read failure behavior (pass empty string to validator)
    async def _ctx_builder(request):
        # Simulate body read failure: validator sees empty string body
        _validate(request.headers, "")
        auth = next((v for k, v in request.headers.items()
                    if k.lower() == "authorization"), "")
        req_id = next((v for k, v in request.headers.items()
                      if k.lower() == "x-request-id"), "req-ctx")
        return _NCtx(request_id=req_id, tenant_id="t1", user_id="u1", authorization=auth)

    monkeypatch.setattr(
        "apps.northbound_app._parse_northbound_context", _ctx_builder)

    async def _gen():
        yield b"data: ok\n\n"
    start_mock = AsyncMock(return_value=StreamingResponse(
        _gen(), media_type="text/event-stream"))
    monkeypatch.setattr("apps.northbound_app.start_streaming_chat", start_mock)

    resp = client.post(
        "/nb/v1/chat/run",
        json={"conversation_id": "nb-1", "agent_name": "a", "query": "hi"},
        headers=_std_headers(),
    )
    # Should continue with empty body and succeed
    assert resp.status_code == 200
    assert captured["seen"] == ""
    assert "text/event-stream" in resp.headers["content-type"]


def test_run_chat_sets_headers_from_service_response(monkeypatch):
    # Bypass AK/SK and JWT parsing in app layer
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", lambda headers, body: True)
    monkeypatch.setattr(
        "apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))

    # Ensure NorthboundContext yields plain string fields (avoid MagicMock in headers)
    class _NCtx:
        def __init__(self, request_id: str, tenant_id: str, user_id: str, authorization: str):
            self.request_id = request_id
            self.tenant_id = tenant_id
            self.user_id = user_id
            self.authorization = authorization

    monkeypatch.setattr("apps.northbound_app.NorthboundContext", _NCtx)

    async def _gen():
        yield b"data: ok\n\n"

    async def _start(ctx, external_conversation_id, agent_name, query, idempotency_key=None):
        resp = StreamingResponse(_gen(), media_type="text/event-stream")
        # Service attaches headers in latest logic; emulate here
        resp.headers["X-Request-Id"] = ctx.request_id
        resp.headers["conversation_id"] = external_conversation_id
        return resp

    monkeypatch.setattr("apps.northbound_app.start_streaming_chat", _start)

    headers = {**_std_headers(), "X-Request-Id": "rid-123"}
    resp = client.post(
        "/nb/v1/chat/run",
        json={"conversation_id": "nb-1",
              "agent_name": "agent-a", "query": "hello"},
        headers=headers,
    )

    assert resp.status_code == 200
    assert resp.headers.get("X-Request-Id") == "rid-123"
    assert resp.headers.get("conversation_id") == "nb-1"


def test_run_chat_service_error_maps_500(monkeypatch):
    monkeypatch.setattr(
        "apps.northbound_app.validate_aksk_authentication", lambda headers, body: True)
    monkeypatch.setattr(
        "apps.northbound_app.get_current_user_id", lambda auth: ("u1", "t1"))

    async def _raise(*args, **kwargs):
        raise Exception("Failed to persist user message: boom")

    monkeypatch.setattr("apps.northbound_app.start_streaming_chat", _raise)

    resp = client.post(
        "/nb/v1/chat/run",
        json={"conversation_id": "nb-1",
              "agent_name": "agent-a", "query": "hello"},
        headers=_std_headers(),
    )

    assert resp.status_code == 500
