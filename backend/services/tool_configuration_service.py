from utils.config_utils import config_manager
from smolagents import ToolCollection
from fastapi import HTTPException
import importlib
import inspect
import logging
from pydantic_core import PydanticUndefined


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def scan_tools():
    local_tools = get_local_tools()
    mcp_tools = get_mcp_tools()
    return {"local_tools": local_tools, "mcp_tools": mcp_tools}

def get_local_tools():
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
        tool_info = {
            "name": getattr(tool_class, 'name'),
            "description": getattr(tool_class, 'description'),
            "init_params": init_params_list
        }
        tools_info.append(tool_info)
    return tools_info


def get_local_tools_classes():
    tools_package = importlib.import_module('nexent.core.tools')
    tools_classes = []
    for name in dir(tools_package):
        obj = getattr(tools_package, name)
        if inspect.isclass(obj):
            tools_classes.append(obj)
    return tools_classes


def get_mcp_tools():
    mcp_service = config_manager.get_config("MCP_SERVICE")
    try:
        with ToolCollection.from_mcp({"url": mcp_service}) as tool_collection:
            tools_info = []

            # iterate all MCP tools
            for tool_class in tool_collection.tools:
                tool_info = {
                    "name": getattr(tool_class, 'name'),
                    "description": getattr(tool_class, 'description'),
                    "init_params": {},
                }

                tools_info.append(tool_info)
            return tools_info
    except Exception as e:
        logger.error(f"mcp connection error: {str(e)}")
        return []
    

if __name__ == "__main__":
    # print(get_local_tools())
    print(get_mcp_tools())

