from fastapi import HTTPException, APIRouter, Header
from services.tool_configuration_service import get_local_tools, get_mcp_tools


router = APIRouter(prefix="/tool")


@router.get("/tool_list")
async def get_tool_list():
    """
    get local and mcp service tools list
    """
    local_tools = []
    mcp_tools = []
    try:
        local_tools = get_local_tools()
    except Exception as e:
        print(e)
    try:
        mcp_tools = get_mcp_tools()
    except Exception as e:
        print(e)
    return {"local_tools": local_tools, "mcp_tools": mcp_tools}
