from utils.config_utils import config_manager
from smolagents import ToolCollection
from fastapi import HTTPException
import importlib
import inspect


def get_local_tools():
    tools_info = []

    # get all tools in tools package
    tools_package = importlib.import_module('nexent.core.tools')
    tools_classes = []
    for name in dir(tools_package):
        obj = getattr(tools_package, name)
        if inspect.isclass(obj):
            tools_classes.append(obj)

    # iterate all tools classes
    for tool_class in tools_classes:
        # get init params info
        init_params = {}
        sig = inspect.signature(tool_class.__init__)
        for param_name, param in sig.parameters.items():
            if param_name in ['self', 'observer']:
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
                "optional": param.default != inspect.Parameter.empty
            }
            if param.default != inspect.Parameter.empty:
                param_info["default"] = param.default
            init_params[param_name] = param_info

        # get tool fixed attributes
        tool_info = {
            "description": getattr(tool_class, 'description'),
            "inputs": getattr(tool_class, 'inputs'),
            "name": getattr(tool_class, 'name'),
            "output_type": getattr(tool_class, 'output_type'),
            "init_params": init_params
        }

        tools_info.append(tool_info)
    return tools_info


def get_mcp_tools():
    mcp_service = config_manager.get_config("MCP_SERVICE")
    try:
        with ToolCollection.from_mcp({"url": mcp_service}) as tool_collection:
            tools_info = []

            # iterate all MCP tools
            for tool_class in tool_collection.tools:
                tool_info = {
                    "description": getattr(tool_class, 'description'),
                    "inputs": getattr(tool_class, 'inputs'),
                    "name": getattr(tool_class, 'name'),
                    "output_type": getattr(tool_class, 'output_type'),
                    "init_params": {},
                }

                tools_info.append(tool_info)
            return tools_info
    except Exception as e:
        print(f"mcp connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"MCP server not connected: {str(e)}")