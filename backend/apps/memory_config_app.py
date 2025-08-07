import logging
import asyncio
from typing import Optional, Any, List, Dict

from fastapi import APIRouter, Header, Body, Path, Query
from fastapi.responses import JSONResponse
from urllib.parse import urlparse

from consts import const as _c
from consts.model import MemoryAgentShareMode
from utils.config_utils import get_model_name_from_config, tenant_config_manager
from utils.auth_utils import get_current_user_id
from consts.const import (
    MEMORY_SWITCH_KEY,
    MEMORY_AGENT_SHARE_KEY,
)
from services.memory_config_service import (
    set_memory_switch,
    set_agent_share,
    add_disabled_agent_id,
    remove_disabled_agent_id,
    add_disabled_useragent_id,
    remove_disabled_useragent_id,
    get_user_configs,
)

from nexent.memory.memory_service import (
    add_memory as svc_add_memory,
    search_memory as svc_search_memory,
    list_memory as svc_list_memory,
    delete_memory as svc_delete_memory,
    clear_memory as svc_clear_memory,
)

logger = logging.getLogger("memory_config_app")
logger.setLevel(logging.DEBUG)
router = APIRouter(prefix="/memory")

# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------

def _success(message: str = "success", content: Optional[Any] = None):
    return JSONResponse(status_code=200, content={"message": message, "status": "success", "content": content})


def _error(message: str = "error"):
    return JSONResponse(status_code=400, content={"message": message, "status": "error"})

# ---------------------------------------------------------------------------
# Helper function
# ---------------------------------------------------------------------------

def build_memory_config(tenant_id: str) -> Dict[str, Any]:
    """Return a fully-validated configuration dictionary for *mem0* ``Memory``.
    """
    # 1. Resolve tenant-specific model configuration
    llm_raw = tenant_config_manager.get_model_config("LLM_ID", tenant_id=tenant_id)
    embed_raw = tenant_config_manager.get_model_config("EMBEDDING_ID", tenant_id=tenant_id)

    if not (llm_raw and llm_raw.get("model_name")):
        raise ValueError("Missing LLM configuration for tenant")
    if not (embed_raw and embed_raw.get("max_tokens")):
        raise ValueError("Missing embedding-model configuration for tenant")

    # 2. Resolve Elasticsearch connection details
    if not _c.ES_HOST:
        raise ValueError("ES_HOST is not configured")
    parsed = urlparse(_c.ES_HOST)
    if not (parsed.scheme and parsed.hostname and parsed.port):
        raise ValueError("ES_HOST must include scheme, host and port, e.g. http://host:9200")
    es_host = f"{parsed.scheme}://{parsed.hostname}"
    es_port = parsed.port

    # 3. Assemble final configuration
    memory_config: Dict[str, Any] = {
        "llm": {
            "provider": "openai",
            "config": {
                "model": get_model_name_from_config(llm_raw),
                "openai_base_url": llm_raw["base_url"],
                "api_key": llm_raw["api_key"],
            },
        },
        "embedder": {
            "provider": "openai",
            "config": {
                "model": get_model_name_from_config(embed_raw),
                "openai_base_url": embed_raw["base_url"],
                "embedding_dims": embed_raw["max_tokens"],
                "api_key": embed_raw["api_key"],
            },
        },
        "vector_store": {
            "provider": "elasticsearch",
            "config": {
                "collection_name": "mem0",
                "host": es_host,
                "port": es_port,
                "embedding_model_dims": embed_raw["max_tokens"],
                "verify_certs": False,
                "api_key": _c.ES_API_KEY,
                "user": _c.ES_USERNAME,
                "password": _c.ES_PASSWORD,
            },
        },
        "telemetry": {"enabled": False},
    }
    return memory_config

# ---------------------------------------------------------------------------
# Configuration Endpoints
# ---------------------------------------------------------------------------

@router.get("/config/load")
def load_configs(authorization: Optional[str] = Header(None)):
    """Load all memory-related configuration for current user."""
    try:
        user_id, _ = get_current_user_id(authorization)
        configs = get_user_configs(user_id)
        return _success(content=configs)
    except Exception as e:
        logger.error("load_configs failed: %s", e)
        return _error("Failed to load configuration")


@router.post("/config/set")
def set_single_config(
    key: str = Body(..., embed=True, description="Configuration key"),
    value: Any = Body(..., embed=True, description="Configuration value"),
    authorization: Optional[str] = Header(None),
):
    """Unified endpoint to set single-value configuration items."""
    user_id, _ = get_current_user_id(authorization)
    if user_id == _c.DEFAULT_USER_ID:
        return _error("Unauthorized or invalid token")
    ok: bool = False

    if key == MEMORY_SWITCH_KEY:
        enabled = bool(value) if isinstance(value, bool) else str(value).lower() in {"true", "1", "y", "yes", "on"}
        ok = set_memory_switch(user_id, enabled)
    elif key == MEMORY_AGENT_SHARE_KEY:
        try:
            mode = MemoryAgentShareMode(str(value))
        except ValueError:
            return _error("Invalid value for MEMORY_AGENT_SHARE (expected always/ask/never)")
        ok = set_agent_share(user_id, mode)
    else:
        return _error("Unsupported configuration key")

    return _success() if ok else _error("Failed to update configuration")

@router.post("/config/disable_agent")
def add_disable_agent(
    agent_id: str = Body(..., embed=True),
    authorization: Optional[str] = Header(None),
):
    user_id, _ = get_current_user_id(authorization)
    if user_id == _c.DEFAULT_USER_ID:
        return _error("Unauthorized or invalid token")
    ok = add_disabled_agent_id(user_id, agent_id)
    return _success() if ok else _error("Failed to add disable agent id")


@router.delete("/config/disable_agent/{agent_id}")
def remove_disable_agent(
    agent_id: str = Path(...),
    authorization: Optional[str] = Header(None),
):
    user_id, _ = get_current_user_id(authorization)
    if user_id == _c.DEFAULT_USER_ID:
        return _error("Unauthorized or invalid token")
    ok = remove_disabled_agent_id(user_id, agent_id)
    return _success() if ok else _error("Failed to remove disable agent id")


@router.post("/config/disable_useragent")
def add_disable_useragent(
    agent_id: str = Body(..., embed=True),
    authorization: Optional[str] = Header(None),
):
    user_id, _ = get_current_user_id(authorization)
    if user_id == _c.DEFAULT_USER_ID:
        return _error("Unauthorized or invalid token")
    ok = add_disabled_useragent_id(user_id, agent_id)
    return _success() if ok else _error("Failed to add disable user-agent id")


@router.delete("/config/disable_useragent/{agent_id}")
def remove_disable_useragent(
    agent_id: str = Path(...),
    authorization: Optional[str] = Header(None),
):
    user_id, _ = get_current_user_id(authorization)
    if user_id == _c.DEFAULT_USER_ID:
        return _error("Unauthorized or invalid token")
    ok = remove_disabled_useragent_id(user_id, agent_id)
    return _success() if ok else _error("Failed to remove disable user-agent id")


# ---------------------------------------------------------------------------
# Memory CRUD Endpoints
# ---------------------------------------------------------------------------

@router.post("/add")
def add_memory(
    messages: List[Dict[str, Any]] = Body(..., description="Chat messages list"),
    memory_level: str = Body(..., embed=True, description="Memory level: tenant/agent/user/user_agent"),
    agent_id: Optional[str] = Body(None, embed=True),
    infer: bool = Body(True, embed=True, description="Whether to run LLM inference during add"),
    authorization: Optional[str] = Header(None),
):
    user_id, tenant_id = get_current_user_id(authorization)
    try:
        result = asyncio.run(svc_add_memory(
            messages=messages,
            memory_level=memory_level,
            memory_config=build_memory_config(tenant_id),
            tenant_id=tenant_id,
            user_id=user_id,
            agent_id=agent_id,
            infer=infer,
        ))
        return _success(content=result)
    except Exception as e:
        logger.error("add_memory error: %s", e, exc_info=True)
        return _error(str(e))


@router.post("/search")
def search_memory(
    query_text: str = Body(..., embed=True, description="Query text"),
    memory_level: str = Body(..., embed=True),
    top_k: int = Body(5, embed=True),
    agent_id: Optional[str] = Body(None, embed=True),
    authorization: Optional[str] = Header(None),
):
    user_id, tenant_id = get_current_user_id(authorization)
    try:
        results = asyncio.run(svc_search_memory(
            query_text=query_text,
            memory_level=memory_level,
            memory_config=build_memory_config(tenant_id),
            tenant_id=tenant_id,
            user_id=user_id,
            top_k=top_k,
            agent_id=agent_id,
        ))
        return _success(content=results)
    except Exception as e:
        logger.error("search_memory error: %s", e, exc_info=True)
        return _error(str(e))


@router.get("/list")
def list_memory(
    memory_level: str = Query(..., description="Memory level: tenant/agent/user/user_agent"),
    agent_id: Optional[str] = Query(None, description="Filter by agent id if applicable"),
    authorization: Optional[str] = Header(None),
):
    user_id, tenant_id = get_current_user_id(authorization)
    try:
        payload = asyncio.run(svc_list_memory(
            memory_level=memory_level,
            memory_config=build_memory_config(tenant_id),
            tenant_id=tenant_id,
            user_id=user_id,
            agent_id=agent_id,
        ))
        return _success(content=payload)
    except Exception as e:
        logger.error("list_memory error: %s", e, exc_info=True)
        return _error(str(e))


@router.delete("/delete/{memory_id}")
def delete_memory(
    memory_id: str = Path(..., description="ID of memory to delete"),
    authorization: Optional[str] = Header(None),
):
    _user_id, tenant_id = get_current_user_id(authorization)
    try:
        result = asyncio.run(svc_delete_memory(memory_id=memory_id, memory_config=build_memory_config(tenant_id)))
        return _success(content=result)
    except Exception as e:
        logger.error("delete_memory error: %s", e, exc_info=True)
        return _error(str(e))


@router.delete("/clear")
def clear_memory(
    memory_level: str = Query(..., description="Memory level: tenant/agent/user/user_agent"),
    agent_id: Optional[str] = Query(None, description="Filter by agent id if applicable"),
    authorization: Optional[str] = Header(None),
):
    user_id, tenant_id = get_current_user_id(authorization)
    try:
        result = asyncio.run(svc_clear_memory(
            memory_level=memory_level,
            memory_config=build_memory_config(tenant_id),
            tenant_id=tenant_id,
            user_id=user_id,
            agent_id=agent_id,
        ))
        return _success(content=result)
    except Exception as e:
        logger.error("clear_memory error: %s", e, exc_info=True)
        return _error(str(e))
