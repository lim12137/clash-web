import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from http import HTTPStatus

from consts.exceptions import MCPConnectionError, MCPNameIllegal
from services.remote_mcp_service import (
    add_remote_mcp_server_list,
    delete_remote_mcp_server_list,
    get_remote_mcp_server_list,
    check_mcp_health_and_update_db,
)
from services.tool_configuration_service import get_tool_from_remote_mcp_server
from utils.auth_utils import get_current_user_id

router = APIRouter(prefix="/mcp")
logger = logging.getLogger("remote_mcp_app")


@router.post("/tools")
async def get_tools_from_remote_mcp(
    service_name: str,
    mcp_url: str,
    authorization: Optional[str] = Header(None)
):
    """ Used to list tool information from the remote MCP server """
    try:
        tools_info = await get_tool_from_remote_mcp_server(mcp_server_name=service_name, remote_mcp_server=mcp_url)
        return JSONResponse(
            status_code=HTTPStatus.OK,
            content={
                "tools": [tool.__dict__ for tool in tools_info], "status": "success"}
        )
    except MCPConnectionError as e:
        logger.error(f"Failed to get tools from remote MCP server: {e}")
        raise HTTPException(status_code=HTTPStatus.SERVICE_UNAVAILABLE,
                            detail="MCP connection failed")
    except Exception as e:
        logger.error(f"get tools from remote MCP server failed, error: {e}")
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                            detail="Failed to get tools from remote MCP server.")


@router.post("/add")
async def add_remote_proxies(
    mcp_url: str,
    service_name: str,
    authorization: Optional[str] = Header(None)
):
    """ Used to add a remote MCP server """
    try:
        user_id, tenant_id = get_current_user_id(authorization)
        await add_remote_mcp_server_list(tenant_id=tenant_id,
                                         user_id=user_id,
                                         remote_mcp_server=mcp_url,
                                         remote_mcp_server_name=service_name)
        return JSONResponse(
            status_code=HTTPStatus.OK,
            content={"message": "Successfully added remote MCP proxy",
                     "status": "success"}
        )

    except MCPNameIllegal as e:
        logger.error(f"Failed to add remote MCP proxy: {e}")
        raise HTTPException(status_code=HTTPStatus.CONFLICT,
                            detail="MCP name already exists")
    except MCPConnectionError as e:
        logger.error(f"Failed to add remote MCP proxy: {e}")
        raise HTTPException(status_code=HTTPStatus.SERVICE_UNAVAILABLE,
                            detail="MCP connection failed")
    except Exception as e:
        logger.error(f"Failed to add remote MCP proxy: {e}")
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                            detail="Failed to add remote MCP proxy")


@router.delete("")
async def delete_remote_proxies(
    service_name: str,
    mcp_url: str,
    authorization: Optional[str] = Header(None)
):
    """ Used to delete a remote MCP server """
    try:
        user_id, tenant_id = get_current_user_id(authorization)
        await delete_remote_mcp_server_list(tenant_id=tenant_id,
                                            user_id=user_id,
                                            remote_mcp_server=mcp_url,
                                            remote_mcp_server_name=service_name)
        return JSONResponse(
            status_code=HTTPStatus.OK,
            content={"message": "Successfully deleted remote MCP proxy",
                     "status": "success"}
        )
    except Exception as e:
        logger.error(f"Failed to delete remote MCP proxy: {e}")
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                            detail="Failed to delete remote MCP proxy")


@router.get("/list")
async def get_remote_proxies(
    authorization: Optional[str] = Header(None)
):
    """ Used to get the list of remote MCP servers """
    try:
        _, tenant_id = get_current_user_id(authorization)
        remote_mcp_server_list = await get_remote_mcp_server_list(tenant_id=tenant_id)
        return JSONResponse(
            status_code=HTTPStatus.OK,
            content={"remote_mcp_server_list": remote_mcp_server_list,
                     "status": "success"}
        )
    except Exception as e:
        logger.error(f"Failed to get remote MCP proxy: {e}")
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                            detail="Failed to get remote MCP proxy")


@router.get("/healthcheck")
async def check_mcp_health(mcp_url: str, service_name: str, authorization: Optional[str] = Header(None)):
    """ Used to check the health of the MCP server, the front end can call it,
    and automatically update the database status """
    try:
        user_id, tenant_id = get_current_user_id(authorization)
        await check_mcp_health_and_update_db(mcp_url, service_name, tenant_id, user_id)
        return JSONResponse(
            status_code=HTTPStatus.OK,
            content={"status": "success"}
        )
    except MCPConnectionError as e:
        logger.error(f"MCP connection failed: {e}")
        raise HTTPException(status_code=HTTPStatus.SERVICE_UNAVAILABLE,
                            detail="MCP connection failed")
    except Exception as e:
        logger.error(f"Failed to check the health of the MCP server: {e}")
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                            detail="Failed to check the health of the MCP server")
