import logging
from typing import List

from database.agent_db import query_tools_by_ids
from consts.model import ToolDetailInformation

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
