from typing import List, Optional

from utils.config_utils import config_manager
from smolagents import ToolCollection
import importlib
import inspect
import logging
from pydantic_core import PydanticUndefined
from consts.model import ToolDetailInformation
from enum import Enum
from dataclasses import dataclass, asdict
from typing import List, Optional
import json


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ToolSourceEnum(Enum):
    LOCAL = "local"
    MCP = "mcp"

@dataclass()
class ToolInfo:
    name: str
    description: str
    params: List
    source: str
    inputs: str
    output_type: str

def scan_tools()->List[ToolInfo]:
    local_tools = get_local_tools()
    mcp_tools = get_mcp_tools()
    return local_tools+mcp_tools

def get_local_tools()->List[ToolInfo]:
    tools_info = []
    tools_classes = get_local_tools_classes()
    for tool_class in tools_classes:
        init_params_list = []
        sig = inspect.signature(tool_class.__init__)
        for param_name, param in sig.parameters.items():
            if param_name == "self" or param.default.exclude:
                continue
            type_trans = {
                "str": "string",
                "int": "integer",
                "float": "float",
                "bool": "boolean",
                "list": "array",
                "List": "array",
                "dict": "object",
                "Dict": "object"
            }
            param_info = {
                "type": "string" if param.annotation == inspect.Parameter.empty else type_trans.get(
                    param.annotation.__name__, param.annotation.__name__),
                "name": param_name,
                "description": param.default.description
            }
            if param.default.default is PydanticUndefined:
                param_info["optional"] = False
            else:
                param_info["default"] = param.default.default
                param_info["optional"] = True

            init_params_list.append(param_info)

        # get tool fixed attributes
        tool_info = ToolInfo(
            name=getattr(tool_class, 'name'),
            description=getattr(tool_class, 'description'),
            params=init_params_list,
            source=ToolSourceEnum.LOCAL.value,
            inputs=json.dumps(getattr(tool_class, 'inputs'), ensure_ascii=False),
            output_type=getattr(tool_class, 'output_type')
        )
        tools_info.append(tool_info)
    return tools_info


def get_local_tools_classes()-> List[type]:
    tools_package = importlib.import_module('nexent.core.tools')
    tools_classes = []
    for name in dir(tools_package):
        obj = getattr(tools_package, name)
        if inspect.isclass(obj):
            tools_classes.append(obj)
    return tools_classes


def get_mcp_tools()->List[ToolInfo]:
    mcp_service = config_manager.get_config("MCP_SERVICE")
    try:
        with ToolCollection.from_mcp({"url": mcp_service}) as tool_collection:
            tools_info = []

            # iterate all MCP tools
            for tool_class in tool_collection.tools:
                tool_info = ToolInfo(
                    name=getattr(tool_class, 'name'),
                    description=getattr(tool_class, 'description'),
                    params=[],
                    source=ToolSourceEnum.MCP.value,
                    inputs=json.dumps(getattr(tool_class, 'inputs'), ensure_ascii=False),
                    output_type=getattr(tool_class, 'output_type')
                )

                tools_info.append(tool_info)
            return tools_info
    except Exception as e:
        logger.error(f"mcp connection error: {str(e)}")
        return []


def get_tool_detail_information(tool_name: str)-> Optional[ToolDetailInformation]:
    detail_information = ToolDetailInformation()

    local_tool_class = get_local_tools_classes()
    for tool_class in local_tool_class:
        if tool_name == tool_class.name:
            detail_information.name = tool_name
            detail_information.description = tool_class.description
            detail_information.inputs = str(tool_class.inputs)
            detail_information.output_type = tool_class.output_type
            return detail_information

    mcp_service = config_manager.get_config("MCP_SERVICE")
    try:
        with ToolCollection.from_mcp({"url": mcp_service}) as tool_collection:
            for tool_class in tool_collection.tools:
                if tool_name == tool_class.name:
                    detail_information.name = tool_name
                    detail_information.description = tool_class.description
                    detail_information.inputs = str(tool_class.inputs)
                    detail_information.output_type = tool_class.output_type
                    return detail_information
    except Exception as e:
        logger.error(f"mcp connection error: {str(e)}")
        return None
