import sys
import types
from typing import Any

import pytest
from unittest.mock import AsyncMock, MagicMock


# -----------------------------
# Stub external modules before import
# -----------------------------

# consts.model stubs used by northbound_service
consts_mod = types.ModuleType("consts")
consts_mod.__path__ = []  # Mark as namespace package so that submodule imports work
consts_model_mod = types.ModuleType("consts.model")
consts_exceptions_mod = types.ModuleType("consts.exceptions")


# Define the custom exception classes expected by northbound_service
class LimitExceededError(Exception):
    """Raised when the rate limit or similar guard is violated."""


class UnauthorizedError(Exception):
    """Raised when authentication or authorization fails."""


class SignatureValidationError(Exception):
    """Raised when request signature header is missing or invalid."""


# Attach them to the stub module so that `from consts.exceptions import ...` works
consts_exceptions_mod.LimitExceededError = LimitExceededError
consts_exceptions_mod.UnauthorizedError = UnauthorizedError
consts_exceptions_mod.SignatureValidationError = SignatureValidationError


class AgentRequest:
    def __init__(self, conversation_id: int, agent_id: int, query: str, history: Any, minio_files=None, is_debug: bool = False):
        self.conversation_id = conversation_id
        self.agent_id = agent_id
        self.query = query
        self.history = history
        self.minio_files = minio_files
        self.is_debug = is_debug


consts_model_mod.AgentRequest = AgentRequest
sys.modules['consts'] = consts_mod
# Register stubs
sys.modules['consts.model'] = consts_model_mod
sys.modules['consts.exceptions'] = consts_exceptions_mod

# database.* stubs
database_mod = types.ModuleType('database')
conversation_db_mod = types.ModuleType('database.conversation_db')
partner_db_mod = types.ModuleType('database.partner_db')


def _default_get_conversation_messages(_: int):
    return []


conversation_db_mod.get_conversation_messages = MagicMock(side_effect=_default_get_conversation_messages)
partner_db_mod.add_mapping_id = MagicMock()
partner_db_mod.get_external_id_by_internal = MagicMock(return_value="ext-1")
partner_db_mod.get_internal_id_by_external = MagicMock(return_value=1)
sys.modules['database'] = database_mod
sys.modules['database.conversation_db'] = conversation_db_mod
sys.modules['database.partner_db'] = partner_db_mod

# services.* stubs
services_mod = types.ModuleType('services')
conv_mgmt_mod = types.ModuleType('services.conversation_management_service')
agent_service_mod = types.ModuleType('services.agent_service')

conv_mgmt_mod.get_conversation_list_service = MagicMock(return_value=[{"conversation_id": 1}])
conv_mgmt_mod.create_new_conversation = MagicMock(return_value={"conversation_id": 2})
conv_mgmt_mod.update_conversation_title = MagicMock()

agent_service_mod.run_agent_stream = AsyncMock()
agent_service_mod.stop_agent_tasks = MagicMock(return_value={"message": "success"})
agent_service_mod.list_all_agent_info_impl = AsyncMock(return_value=[{"agent_id": 1, "name": "A"}])
agent_service_mod.get_agent_id_by_name = AsyncMock(return_value=99)

sys.modules['services'] = services_mod
sys.modules['services.conversation_management_service'] = conv_mgmt_mod
sys.modules['services.agent_service'] = agent_service_mod


# -----------------------------
# Import module under test
# -----------------------------
from backend.services import northbound_service as ns


# -----------------------------
# Fixtures
# -----------------------------
@pytest.fixture(autouse=True)
def reset_state():
    ns._IDEMPOTENCY_RUNNING.clear()
    ns._RATE_STATE.clear()
    # reset partner and conversation mocks between tests
    partner_db_mod.add_mapping_id.reset_mock()
    partner_db_mod.get_external_id_by_internal.reset_mock(return_value=True)
    partner_db_mod.get_external_id_by_internal.return_value = "ext-1"
    partner_db_mod.get_internal_id_by_external.reset_mock(return_value=True)
    partner_db_mod.get_internal_id_by_external.return_value = 1
    conversation_db_mod.get_conversation_messages.reset_mock(side_effect=True)
    conversation_db_mod.get_conversation_messages.side_effect = _default_get_conversation_messages
    conv_mgmt_mod.get_conversation_list_service.reset_mock(return_value=True)
    conv_mgmt_mod.get_conversation_list_service.return_value = [{"conversation_id": 1}]
    conv_mgmt_mod.create_new_conversation.reset_mock(return_value=True)
    conv_mgmt_mod.create_new_conversation.return_value = {"conversation_id": 2}
    conv_mgmt_mod.update_conversation_title.reset_mock()
    agent_service_mod.run_agent_stream.reset_mock()
    agent_service_mod.run_agent_stream.return_value = None
    agent_service_mod.stop_agent_tasks.reset_mock(return_value=True)
    agent_service_mod.stop_agent_tasks.return_value = {"message": "success"}
    agent_service_mod.list_all_agent_info_impl.reset_mock(return_value=True)
    agent_service_mod.list_all_agent_info_impl.return_value = [{"agent_id": 1, "name": "A"}]
    agent_service_mod.get_agent_id_by_name.reset_mock(return_value=True)
    agent_service_mod.get_agent_id_by_name.return_value = 99


@pytest.fixture
def ctx() -> ns.NorthboundContext:
    return ns.NorthboundContext(
        request_id="req-1",
        tenant_id="tenant-1",
        user_id="user-1",
        authorization="Bearer t"
    )


# -----------------------------
# Unit tests
# -----------------------------
def test_build_idempotency_key_hashing():
    long = "x" * 100
    key = ns._build_idempotency_key("a", long, "b")
    parts = key.split(":")
    assert parts[0] == "a"
    assert len(parts[1]) == 64  # sha256 hex
    assert parts[2] == "b"


@pytest.mark.asyncio
async def test_to_external_and_internal_conversation_id_success():
    ext = await ns.to_external_conversation_id(123)
    assert ext == "ext-1"
    internal = await ns.to_internal_conversation_id("ext-123")
    assert internal == 1


@pytest.mark.asyncio
async def test_to_external_conversation_id_not_found():
    partner_db_mod.get_external_id_by_internal.return_value = None
    with pytest.raises(Exception):
        await ns.to_external_conversation_id(123)


@pytest.mark.asyncio
async def test_get_agent_info_by_name_success():
    agent_id = await ns.get_agent_info_by_name("helper", "tenant-1")
    assert agent_id == 99


@pytest.mark.asyncio
async def test_get_agent_info_by_name_failure(monkeypatch):
    async def raise_err(*_args, **_kwargs):
        raise Exception("boom")

    monkeypatch.setattr(ns, "get_agent_id_by_name", raise_err)
    with pytest.raises(Exception) as ei:
        await ns.get_agent_info_by_name("helper", "tenant-1")
    assert "Failed to get agent id" in str(ei.value)


@pytest.mark.asyncio
async def test_start_streaming_chat_existing_conversation(ctx, monkeypatch):
    # Arrange existing conversation
    partner_db_mod.get_internal_id_by_external.return_value = 123

    async def _agen():
        yield b"data: chunk1\n\n"
    from fastapi.responses import StreamingResponse
    resp_stream = StreamingResponse(_agen(), media_type="text/event-stream")
    monkeypatch.setattr(ns, "run_agent_stream", AsyncMock(return_value=resp_stream))
    conversation_db_mod.get_conversation_messages.side_effect = lambda _cid: [
        {"message_role": "user", "message_content": "hi"}
    ]

    # Act
    resp = await ns.start_streaming_chat(
        ctx=ctx,
        external_conversation_id="ext-123",
        agent_name="helper",
        query="hello",
        idempotency_key="k1",
    )

    # Assert
    assert resp is not None
    assert resp.headers["X-Request-Id"] == "req-1"
    assert resp.headers["conversation_id"] == "ext-123"
    partner_db_mod.add_mapping_id.assert_not_called()


@pytest.mark.asyncio
async def test_start_streaming_chat_creates_new_conversation(ctx, monkeypatch):
    # Arrange missing conversation triggers creation
    partner_db_mod.get_internal_id_by_external.return_value = None

    async def _agen():
        yield b"data: c\n\n"
    from fastapi.responses import StreamingResponse
    resp_stream = StreamingResponse(_agen(), media_type="text/event-stream")
    monkeypatch.setattr(ns, "run_agent_stream", AsyncMock(return_value=resp_stream))

    # Act
    resp = await ns.start_streaming_chat(
        ctx=ctx,
        external_conversation_id="ext-new",
        agent_name="helper",
        query="hello",
        idempotency_key="k2",
    )

    # Assert
    assert resp is not None
    partner_db_mod.add_mapping_id.assert_called_once()
    args, kwargs = partner_db_mod.add_mapping_id.call_args
    assert kwargs["internal_id"] == 2  # internal id from create_new_conversation
    assert kwargs["external_id"] == "ext-new"
    assert kwargs["tenant_id"] == ctx.tenant_id
    assert kwargs["user_id"] == ctx.user_id


@pytest.mark.asyncio
async def test_rate_limit_exceeded(monkeypatch):
    monkeypatch.setattr(ns, "_RATE_LIMIT_PER_MINUTE", 1)
    await ns.check_and_consume_rate_limit("tenant-x")
    with pytest.raises(consts_exceptions_mod.LimitExceededError):
        await ns.check_and_consume_rate_limit("tenant-x")


@pytest.mark.asyncio
async def test_idempotency_prevents_duplicates():
    await ns.idempotency_start("dup-key")
    with pytest.raises(consts_exceptions_mod.LimitExceededError):
        await ns.idempotency_start("dup-key")
    await ns.idempotency_end("dup-key")


@pytest.mark.asyncio
async def test_stop_chat_success(ctx):
    partner_db_mod.get_internal_id_by_external.return_value = 777
    result = await ns.stop_chat(ctx, "ext-777")
    assert result["message"] == "success"
    assert result["data"] == "ext-777"
    assert result["requestId"] == "req-1"

    agent_service_mod.stop_agent_tasks.assert_called_once_with(777, "user-1")


@pytest.mark.asyncio
async def test_list_conversations_maps_ids(ctx):
    # map 1->E1, 2->E2
    conv_mgmt_mod.get_conversation_list_service.return_value = [
        {"conversation_id": 1},
        {"conversation_id": 2},
    ]
    partner_db_mod.get_external_id_by_internal.side_effect = ["E1", "E2"]
    data = await ns.list_conversations(ctx)
    assert data["message"] == "success"
    ids = [c["conversation_id"] for c in data["data"]]
    assert ids == ["E1", "E2"]


@pytest.mark.asyncio
async def test_get_conversation_history_trims_fields(ctx):
    conversation_db_mod.get_conversation_messages.side_effect = lambda _cid: [
        {"message_role": "user", "message_content": "u1", "extra": 1},
        {"message_role": "assistant", "message_content": "a1", "extra": 2},
    ]
    out = await ns.get_conversation_history(ctx, "ext-1")
    assert out["message"] == "success"
    hist = out["data"]["history"]
    assert hist == [
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a1"},
    ]


@pytest.mark.asyncio
async def test_get_agent_info_list_strips_internal(ctx, monkeypatch):
    async def fake_list(tenant_id: str):
        return [{"agent_id": 5, "name": "N"}]

    monkeypatch.setattr(ns, "list_all_agent_info_impl", AsyncMock(side_effect=fake_list))
    out = await ns.get_agent_info_list(ctx)
    assert out["message"] == "success"
    assert "agent_id" not in out["data"][0]


@pytest.mark.asyncio
async def test_update_conversation_title_success_and_idempotency(ctx):
    # success call
    res = await ns.update_conversation_title(ctx, "ext-10", "Title", idempotency_key="title-key")
    assert res["message"] == "success"
    assert res["data"] == "ext-10"
    # duplicate should raise until released
    with pytest.raises(consts_exceptions_mod.LimitExceededError):
        await ns.update_conversation_title(ctx, "ext-10", "Title", idempotency_key="title-key")
    # cleanup manually to avoid bleed between tests
    await ns.idempotency_end("title-key")

