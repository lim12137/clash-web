from fastapi import HTTPException, APIRouter
import logging
from database.agent_db import create_or_update_tool, query_tools
from consts.model import AgentToolInfoRequest
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


@router.post("/update")
async def update_tool_info(request: AgentToolInfoRequest):
    """
    Update an existing tool, create or update tool instance
    """
    try:
        user_id, tenant_id = get_user_info()
        return create_or_update_tool(request, tenant_id, request.agent_id, user_id)
    except Exception as e:
        logging.error(f"Failed to update tool, error in: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update tool, error in: {str(e)}")