from fastapi import HTTPException, APIRouter
import logging
from database.agent_db import create_or_update_tool, query_tools, query_tool_instances_by_id
from consts.model import ToolInstanceInfoRequest, ToolInstanceSearchRequest
from utils.user_utils import get_user_info

router = APIRouter(prefix="/tool")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@router.get("/list")
async def list_tools():
    """
    List all system tools from PG dataset
    """
    try:
        return query_tools()
    except Exception as e:
        logging.error(f"Failed to get tool info, error in: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get tool info, error in: {str(e)}")

@router.post("/search")
async def update_tool_info(request: ToolInstanceSearchRequest):
    try:
        user_id, tenant_id = get_user_info()
        tool_instance = query_tool_instances_by_id(request.agent_id, request.tool_id, tenant_id, user_id)
        if tool_instance:
            return {
                "params": tool_instance["params"],
                "enabled": tool_instance["enabled"]
            }
        else:
            return {
                "params": None,
                "enabled": False
            }
    except Exception as e: 
        logging.error(f"Failed to update tool, error in: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update tool, error in: {str(e)}")


@router.post("/update")
async def update_tool_info(request: ToolInstanceInfoRequest):
    """
    Update an existing tool, create or update tool instance
    """
    try:
        user_id, tenant_id = get_user_info()
        tool_instance = create_or_update_tool(request, tenant_id, user_id)
        return {
            "tool_instance": tool_instance
        }
    except Exception as e:
        logging.error(f"Failed to update tool, error in: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update tool, error in: {str(e)}")
