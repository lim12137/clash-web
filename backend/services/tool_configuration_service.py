import logging

from database.agent_db import query_tool_instances_by_id, create_or_update_tool_by_tool_info
from consts.model import ToolInstanceInfoRequest
from utils.user_utils import get_user_info

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tool config")

def search_tool_info_impl(agent_id: int, tool_id: int):
    user_id, tenant_id = get_user_info()
    try:
        tool_instance = query_tool_instances_by_id(agent_id, tool_id, tenant_id, user_id)
    except Exception as e:
        logger.error(f"search_tool_info_impl error in query_tool_instances_by_id, detail: {e}")
        raise ValueError(f"search_tool_info_impl error in query_tool_instances_by_id, detail: {e}")

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

def update_tool_info_impl(request: ToolInstanceInfoRequest):
    user_id, tenant_id = get_user_info()
    try:
        tool_instance = create_or_update_tool_by_tool_info(request, tenant_id, user_id)
    except Exception as e:
        logger.error(f"update_tool_info_impl error in create_or_update_tool, detail: {e}")
        raise ValueError(f"update_tool_info_impl error in create_or_update_tool, detail: {e}")
    
    return {
        "tool_instance": tool_instance
    }