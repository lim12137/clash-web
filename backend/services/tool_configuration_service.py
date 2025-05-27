import logging
from typing import List

from database.agent_db import query_tools_by_ids, query_tool_instances_by_id, create_or_update_tool_by_tool_info
from consts.model import ToolDetailInformation, ToolInstanceInfoRequest
from utils.user_utils import get_user_info

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_tool_detail_information(tool_id_list: List) -> List[ToolDetailInformation]:
    tool_info_list = []
    tool_raw_info_list = query_tools_by_ids(tool_id_list)
    for tool_raw_info in tool_raw_info_list:
        tool_detail_information = ToolDetailInformation()
        tool_detail_information.name = tool_raw_info.get("name")
        tool_detail_information.description = tool_raw_info.get("description")
        tool_detail_information.inputs = tool_raw_info.get("inputs")
        tool_detail_information.output_type = tool_raw_info.get("output_type")
        tool_info_list.append(tool_detail_information)

    return tool_info_list

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