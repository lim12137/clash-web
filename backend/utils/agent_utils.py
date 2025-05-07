import time

from threading import Lock, Thread
from typing import List, Dict

from nexent.core.agents import CoreAgent
from nexent.core.utils.agent_utils import agent_run_with_observer
from smolagents import TaskStep, ActionStep

from utils.config_utils import config_manager

from smolagents import ToolCollection
from fastapi import HTTPException

from utils.agent_create_factory import AgentCreateFactory


class ThreadManager:
    """Thread manager for tracking and managing all active threads"""

    def __init__(self):
        self.active_threads = {}
        self.lock = Lock()

    def add_thread(self, thread_id: str, thread: Thread):
        """Add a new thread"""
        with self.lock:
            self.active_threads[thread_id] = {'thread': thread, 'start_time': time.time()}

    def remove_thread(self, thread_id: str):
        """Remove a thread"""
        with self.lock:
            if thread_id in self.active_threads:
                del self.active_threads[thread_id]

    def stop_thread(self, thread_id: str):
        """Stop a thread"""
        with self.lock:
            if thread_id in self.active_threads:
                thread_data = self.active_threads[thread_id]
                thread_data['thread'].join(timeout=5)
                del self.active_threads[thread_id]


# Create global thread manager instance
thread_manager = ThreadManager()

def add_history_to_agent(agent: CoreAgent, history: List[Dict]):
    """Add conversation history to agent's memory"""
    if not history:
        return

    # Add conversation history to memory sequentially
    for msg in history:
        if msg['role'] == 'user':
            # Create task step for user message
            agent.memory.steps.append(TaskStep(task=msg['content']))
        elif msg['role'] == 'assistant':
            agent.memory.steps.append(ActionStep(action_output=msg['content'], model_output=msg['content']))


def agent_run_thread(observer, query, history=None):
    try:
        mcp_host = config_manager.get_config("MCP_SERVICE")
        agent_create_json = config_manager.get_config("AGENT_CREATE_FILE")

        with ToolCollection.from_mcp({"url": mcp_host}) as tool_collection:
            factory = AgentCreateFactory(observer=observer,
                                         mcp_tool_collection=tool_collection)
            agent = factory.create_from_json(agent_create_json)
            add_history_to_agent(agent, history)

            agent_run_with_observer(agent=agent, query=query, reset=False)

    except Exception as e:
        print(f"mcp connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"MCP server not connected: {str(e)}")

def get_local_tools():
    import importlib
    import inspect
    
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
                "type": "string" if param.annotation == inspect.Parameter.empty else type_trans.get(param.annotation.__name__, param.annotation.__name__),
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
    import inspect
    
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


if __name__ == "__main__":
    print(get_local_tools())
    print(get_mcp_tools())

