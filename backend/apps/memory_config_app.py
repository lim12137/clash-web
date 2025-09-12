"""Memory configuration and CRUD API endpoints for the app layer.

This module exposes HTTP endpoints under the `/memory` prefix. It follows the
app-layer responsibilities:
- Parse and validate HTTP inputs
- Delegate business logic to the service layer
- Convert unexpected exceptions to error JSON responses

Routes:
- GET `/memory/config/load`: Load memory-related configuration for current user
- POST `/memory/config/set`: Set a single configuration entry
- POST `/memory/config/disable_agent`: Add a disabled agent id
- DELETE `/memory/config/disable_agent/{agent_id}`: Remove a disabled agent id
- POST `/memory/config/disable_useragent`: Add a disabled user-agent id
- DELETE `/memory/config/disable_useragent/{agent_id}`: Remove a disabled user-agent id
- POST `/memory/add`: Add memory items (optionally with LLM inference)
- POST `/memory/search`: Semantic search memory items
- GET `/memory/list`: List memory items
- DELETE `/memory/delete/{memory_id}`: Delete a single memory item
- DELETE `/memory/clear`: Clear memory items by scope
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional

from http import HTTPStatus
from fastapi import APIRouter, Body, Header, Path, Query, HTTPException
from fastapi.responses import JSONResponse

from nexent.memory.memory_service import (
    add_memory as svc_add_memory,
    clear_memory as svc_clear_memory,
    delete_memory as svc_delete_memory,
    list_memory as svc_list_memory,
    search_memory as svc_search_memory,
)
from consts.const import (
    MEMORY_AGENT_SHARE_KEY,
    MEMORY_SWITCH_KEY,
    BOOLEAN_TRUE_VALUES,
)
from consts.model import MemoryAgentShareMode
from consts.exceptions import UnauthorizedError
from services.memory_config_service import (
    add_disabled_agent_id,
    add_disabled_useragent_id,
    get_user_configs,
    remove_disabled_agent_id,
    remove_disabled_useragent_id,
    set_agent_share,
    set_memory_switch,
)
from utils.auth_utils import get_current_user_id
from utils.memory_utils import build_memory_config

logger = logging.getLogger("memory_config_app")
logger.setLevel(logging.DEBUG)
router = APIRouter(prefix="/memory")


# ---------------------------------------------------------------------------
# Configuration Endpoints
# ---------------------------------------------------------------------------
@router.get("/config/load")
def load_configs(authorization: Optional[str] = Header(None)):
    """Load all memory-related configuration for the current user.

    Args:
        authorization: Optional authorization header used to identify the user.
    """
    try:
        user_id, _ = get_current_user_id(authorization)
        configs = get_user_configs(user_id)
        return JSONResponse(status_code=HTTPStatus.OK, content=configs)
    except UnauthorizedError as e:
        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail=str(e))
    except Exception as e:
        logger.error("load_configs failed: %s", e)
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST,
                            detail="Failed to load configuration")


@router.post("/config/set")
def set_single_config(
    key: str = Body(..., embed=True, description="Configuration key"),
    value: Any = Body(..., embed=True, description="Configuration value"),
    authorization: Optional[str] = Header(None),
):
    """Set a single-value configuration item for the current user.

    Supported keys:
    - `MEMORY_SWITCH_KEY`: Toggle memory system on/off (boolean-like values accepted)
    - `MEMORY_AGENT_SHARE_KEY`: Set agent share mode (`always`/`ask`/`never`)

    Args:
        key: Configuration key to update.
        value: New value for the configuration key.
        authorization: Optional authorization header used to identify the user.
    """
    user_id, _ = get_current_user_id(authorization)

    if key == MEMORY_SWITCH_KEY:
        enabled = bool(value) if isinstance(value, bool) else str(
            value).lower() in BOOLEAN_TRUE_VALUES
        ok = set_memory_switch(user_id, enabled)
    elif key == MEMORY_AGENT_SHARE_KEY:
        try:
            mode = MemoryAgentShareMode(str(value))
        except ValueError:
            raise HTTPException(status_code=HTTPStatus.NOT_ACCEPTABLE,
                                detail="Invalid value for MEMORY_AGENT_SHARE (expected always/ask/never)")
        ok = set_agent_share(user_id, mode)
    else:
        raise HTTPException(status_code=HTTPStatus.NOT_ACCEPTABLE,
                            detail="Unsupported configuration key")

    if ok:
        return JSONResponse(status_code=HTTPStatus.OK, content={"success": True})
    raise HTTPException(status_code=HTTPStatus.BAD_REQUEST,
                        detail="Failed to update configuration")


@router.post("/config/disable_agent")
def add_disable_agent(
    agent_id: str = Body(..., embed=True),
    authorization: Optional[str] = Header(None),
):
    """Add an agent id to the user's disabled agent list.

    Args:
        agent_id: Identifier of the agent to disable.
        authorization: Optional authorization header used to identify the user.
    """
    user_id, _ = get_current_user_id(authorization)
    ok = add_disabled_agent_id(user_id, agent_id)
    if ok:
        return JSONResponse(status_code=HTTPStatus.OK, content={"success": True})
    raise HTTPException(status_code=HTTPStatus.BAD_REQUEST,
                        detail="Failed to add disable agent id")


@router.delete("/config/disable_agent/{agent_id}")
def remove_disable_agent(
    agent_id: str = Path(...),
    authorization: Optional[str] = Header(None),
):
    """Remove an agent id from the user's disabled agent list.

    Args:
        agent_id: Identifier of the agent to remove from the disabled list.
        authorization: Optional authorization header used to identify the user.
    """
    user_id, _ = get_current_user_id(authorization)
    ok = remove_disabled_agent_id(user_id, agent_id)
    if ok:
        return JSONResponse(status_code=HTTPStatus.OK, content={"success": True})
    raise HTTPException(status_code=HTTPStatus.BAD_REQUEST,
                        detail="Failed to remove disable agent id")


@router.post("/config/disable_useragent")
def add_disable_useragent(
    agent_id: str = Body(..., embed=True),
    authorization: Optional[str] = Header(None),
):
    """Add a user-agent id to the user's disabled user-agent list.

    Args:
        agent_id: Identifier of the user-agent to disable.
        authorization: Optional authorization header used to identify the user.
    """
    user_id, _ = get_current_user_id(authorization)
    ok = add_disabled_useragent_id(user_id, agent_id)
    if ok:
        return JSONResponse(status_code=HTTPStatus.OK, content={"success": True})
    raise HTTPException(status_code=HTTPStatus.BAD_REQUEST,
                        detail="Failed to add disable user-agent id")


@router.delete("/config/disable_useragent/{agent_id}")
def remove_disable_useragent(
    agent_id: str = Path(...),
    authorization: Optional[str] = Header(None),
):
    """Remove a user-agent id from the user's disabled user-agent list.

    Args:
        agent_id: Identifier of the user-agent to remove from the disabled list.
        authorization: Optional authorization header used to identify the user.
    """
    user_id, _ = get_current_user_id(authorization)
    ok = remove_disabled_useragent_id(user_id, agent_id)
    if ok:
        return JSONResponse(status_code=HTTPStatus.OK, content={"success": True})
    raise HTTPException(status_code=HTTPStatus.BAD_REQUEST,
                        detail="Failed to remove disable user-agent id")


# ---------------------------------------------------------------------------
# Memory CRUD Endpoints
# ---------------------------------------------------------------------------
@router.post("/add")
def add_memory(
    messages: List[Dict[str, Any]
                   ] = Body(..., description="Chat messages list"),
    memory_level: str = Body(..., embed=True,
                             description="Memory level: tenant/agent/user/user_agent"),
    agent_id: Optional[str] = Body(None, embed=True),
    infer: bool = Body(
        True, embed=True, description="Whether to run LLM inference during add"),
    authorization: Optional[str] = Header(None),
):
    """Add memory records for the given scope.

    Args:
        messages: List of chat messages as dictionaries.
        memory_level: Scope for the memory record (tenant/agent/user/user_agent).
        agent_id: Optional agent identifier when scope is agent-related.
        infer: Whether to run LLM inference during add.
        authorization: Optional authorization header used to identify the user.
    """
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
        return JSONResponse(status_code=HTTPStatus.OK, content=result)
    except Exception as e:
        logger.error("add_memory error: %s", e, exc_info=True)
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=str(e))


@router.post("/search")
def search_memory(
    query_text: str = Body(..., embed=True, description="Query text"),
    memory_level: str = Body(..., embed=True),
    top_k: int = Body(5, embed=True),
    agent_id: Optional[str] = Body(None, embed=True),
    authorization: Optional[str] = Header(None),
):
    """Search memory semantically for the given scope.

    Args:
        query_text: Natural language query to search memory.
        memory_level: Scope for search (tenant/agent/user/user_agent).
        top_k: Maximum number of results to return.
        agent_id: Optional agent identifier when scope is agent-related.
        authorization: Optional authorization header used to identify the user.
    """
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
        return JSONResponse(status_code=HTTPStatus.OK, content=results)
    except Exception as e:
        logger.error("search_memory error: %s", e, exc_info=True)
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=str(e))


@router.get("/list")
def list_memory(
    memory_level: str = Query(...,
                              description="Memory level: tenant/agent/user/user_agent"),
    agent_id: Optional[str] = Query(
        None, description="Filter by agent id if applicable"),
    authorization: Optional[str] = Header(None),
):
    """List memory for the given scope.

    Args:
        memory_level: Scope for listing (tenant/agent/user/user_agent).
        agent_id: Optional agent filter when scope is agent-related.
        authorization: Optional authorization header used to identify the user.
    """
    user_id, tenant_id = get_current_user_id(authorization)
    try:
        payload = asyncio.run(svc_list_memory(
            memory_level=memory_level,
            memory_config=build_memory_config(tenant_id),
            tenant_id=tenant_id,
            user_id=user_id,
            agent_id=agent_id,
        ))
        return JSONResponse(status_code=HTTPStatus.OK, content=payload)
    except Exception as e:
        logger.error("list_memory error: %s", e, exc_info=True)
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=str(e))


@router.delete("/delete/{memory_id}")
def delete_memory(
    memory_id: str = Path(..., description="ID of memory to delete"),
    authorization: Optional[str] = Header(None),
):
    """Delete a specific memory record by id.

    Args:
        memory_id: Identifier of the memory record to delete.
        authorization: Optional authorization header used to identify the user.
    """
    _user_id, tenant_id = get_current_user_id(authorization)
    try:
        result = asyncio.run(svc_delete_memory(
            memory_id=memory_id, memory_config=build_memory_config(tenant_id)))
        return JSONResponse(status_code=HTTPStatus.OK, content=result)
    except Exception as e:
        logger.error("delete_memory error: %s", e, exc_info=True)
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=str(e))


@router.delete("/clear")
def clear_memory(
    memory_level: str = Query(...,
                              description="Memory level: tenant/agent/user/user_agent"),
    agent_id: Optional[str] = Query(
        None, description="Filter by agent id if applicable"),
    authorization: Optional[str] = Header(None),
):
    """Clear memory records for the given scope.

    Args:
        memory_level: Scope for clearing (tenant/agent/user/user_agent).
        agent_id: Optional agent filter when scope is agent-related.
        authorization: Optional authorization header used to identify the user.
    """
    user_id, tenant_id = get_current_user_id(authorization)
    try:
        result = asyncio.run(svc_clear_memory(
            memory_level=memory_level,
            memory_config=build_memory_config(tenant_id),
            tenant_id=tenant_id,
            user_id=user_id,
            agent_id=agent_id,
        ))
        return JSONResponse(status_code=HTTPStatus.OK, content=result)
    except Exception as e:
        logger.error("clear_memory error: %s", e, exc_info=True)
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=str(e))
