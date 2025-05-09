from fastapi import HTTPException, APIRouter, Header
from services.tool_configuration_service import scan_tools
import logging

router = APIRouter(prefix="/tool")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@router.get("/tool_list")
async def get_tool_list():
    """
    get local and mcp service tools list
    """
    tools_list = scan_tools()
    # TODO 访问PG库更新tool默认参数
    return tools_list
