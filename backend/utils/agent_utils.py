import time
import importlib
import inspect
import logging
import json

from pydantic_core import PydanticUndefined

from threading import Lock, Thread
from typing import List, Dict, Any

from nexent.core.agents import CoreAgent
from smolagents import TaskStep, ActionStep, ToolCollection

from utils.config_utils import config_manager
from consts.model import ToolSourceEnum, ToolInfo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agent_util")


def python_type_to_json_schema(annotation: Any) -> str:
    """
    Convert Python type annotations to JSON Schema types
    
    Args:
        annotation: Python type annotation
        
    Returns:
        Corresponding JSON Schema type string
    """
    # Handle case with no type annotation
    if annotation == inspect.Parameter.empty:
        return "string"
        
    # Get type name
    type_name = getattr(annotation, "__name__", str(annotation))
    
    # Type mapping dictionary
    type_mapping = {
        "str": "string",
        "int": "integer",
        "float": "float",
        "bool": "boolean",
        "list": "array",
        "List": "array",
        "tuple": "array",
        "Tuple": "array",
        "dict": "object",
        "Dict": "object",
        "Any": "any"
    }
    
    # Return mapped type, or original type name if no mapping exists
    return type_mapping.get(type_name, type_name)


class ThreadManager:
    """Thread manager for tracking and managing all active threads"""

    def __init__(self):
        self.active_threads = {}
        self.lock = Lock()

    def add_thread(self, thread_id: str, thread: Thread):
        """Add a new thread to the manager with its ID and start time"""
        with self.lock:
            self.active_threads[thread_id] = {'thread': thread, 'start_time': time.time()}

    def remove_thread(self, thread_id: str):
        """Remove a thread from the manager by its ID"""
        with self.lock:
            if thread_id in self.active_threads:
                del self.active_threads[thread_id]

    def stop_thread(self, thread_id: str):
        """Stop a running thread by its ID and remove it from the manager"""
        with self.lock:
            if thread_id in self.active_threads:
                thread_data = self.active_threads[thread_id]
                thread_data['thread'].join(timeout=5)
                del self.active_threads[thread_id]


# Create global thread manager instance
thread_manager = ThreadManager()


def add_history_to_agent(agent: CoreAgent, history: List[Dict]):
    """
    Add conversation history to agent's memory
    
    Args:
        agent: The CoreAgent instance to update
        history: List of conversation messages with role and content
    """
    if not history:
        return

    agent.memory.reset()
    # Add conversation history to memory sequentially
    for msg in history:
        if msg['role'] == 'user':
            # Create task step for user message
            agent.memory.steps.append(TaskStep(task=msg['content']))
        elif msg['role'] == 'assistant':
            agent.memory.steps.append(ActionStep(action_output=msg['content'], model_output=msg['content']))


def scan_tools() -> List[ToolInfo]:
    """
    Scan and gather all available tools from both local and MCP sources
    
    Returns:
        List of ToolInfo objects containing tool metadata
    """
    local_tools = get_local_tools()
    mcp_tools = get_mcp_tools()
    return local_tools + mcp_tools


def get_local_tools() -> List[ToolInfo]:
    """
    Get metadata for all locally available tools
    
    Returns:
        List of ToolInfo objects for local tools
    """
    tools_info = []
    tools_classes = get_local_tools_classes()
    for tool_class in tools_classes:
        init_params_list = []
        sig = inspect.signature(tool_class.__init__)
        for param_name, param in sig.parameters.items():
            if param_name == "self" or param.default.exclude:
                continue
            
            param_info = {
                "type": python_type_to_json_schema(param.annotation),
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
            output_type=getattr(tool_class, 'output_type'),
            class_name=tool_class.__name__
        )
        tools_info.append(tool_info)
    return tools_info


def get_local_tools_classes() -> List[type]:
    """
    Get all tool classes from the nexent.core.tools package
    
    Returns:
        List of tool class objects
    """
    tools_package = importlib.import_module('nexent.core.tools')
    tools_classes = []
    for name in dir(tools_package):
        obj = getattr(tools_package, name)
        if inspect.isclass(obj):
            tools_classes.append(obj)
    return tools_classes


def get_mcp_tools() -> List[ToolInfo]:
    """
    Get metadata for all tools available from the MCP service
    
    Returns:
        List of ToolInfo objects for MCP tools, or empty list if connection fails
    """
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
                    output_type=getattr(tool_class, 'output_type'),
                    class_name=getattr(tool_class, 'name')
                )

                tools_info.append(tool_info)
            return tools_info
    except Exception as e:
        logger.error(f"mcp connection error: {str(e)}")
        return []
