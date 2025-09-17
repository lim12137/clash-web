import logging
from http import HTTPStatus
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from consts.exceptions import MCPConnectionError
from consts.model import ToolInstanceInfoRequest, ToolInstanceSearchRequest
from services.tool_configuration_service import (
    search_tool_info_impl,
    update_tool_info_impl,
    update_tool_list, list_all_tools,
)
from utils.auth_utils import get_current_user_id

router = APIRouter(prefix="/tool")
logger = logging.getLogger("tool_config_app")


@router.get("/list")
async def list_tools_api(authorization: Optional[str] = Header(None)):
    """
    List all system tools from PG dataset
    """
    try:
        _, tenant_id = get_current_user_id(authorization)
        # now only admin can modify the tool, user_id is not used
        return await list_all_tools(tenant_id=tenant_id)
    except Exception as e:
        logging.error(f"Failed to get tool info, error in: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=f"Failed to get tool info, error in: {str(e)}")


@router.post("/search")
async def search_tool_info_api(request: ToolInstanceSearchRequest, authorization: Optional[str] = Header(None)):
    try:
        _, tenant_id = get_current_user_id(authorization)
        return search_tool_info_impl(request.agent_id, request.tool_id, tenant_id)
    except Exception as e:
        logging.error(f"Failed to search tool, error in: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to search tool info")


@router.post("/update")
async def update_tool_info_api(request: ToolInstanceInfoRequest, authorization: Optional[str] = Header(None)):
    """
    Update an existing tool, create or update tool instance
    """
    try:
        user_id, tenant_id = get_current_user_id(authorization)
        return update_tool_info_impl(request, tenant_id, user_id)
    except Exception as e:
        logging.error(f"Failed to update tool, error in: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=f"Failed to update tool, error in: {str(e)}")


@router.get("/scan_tool")
async def scan_and_update_tool(
    authorization: Optional[str] = Header(None)
):
    """ Used to update the tool list and status """
    try:
        user_id, tenant_id = get_current_user_id(authorization)
        await update_tool_list(tenant_id=tenant_id, user_id=user_id)
        return JSONResponse(
            status_code=HTTPStatus.OK,
            content={"message": "Successfully update tool", "status": "success"}
        )
    except MCPConnectionError as e:
        logger.error(f"MCP connection failed: {e}")
        raise HTTPException(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE, detail="MCP connection failed")
    except Exception as e:
        logger.error(f"Failed to update tool: {e}")
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to update tool")
