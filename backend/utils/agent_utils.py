import time
import logging
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
        logging.info(f"mcp_host: {mcp_host}")

        with ToolCollection.from_mcp({"url": mcp_host}) as tool_collection:
            factory = AgentCreateFactory(observer=observer,
                                         mcp_tool_collection=tool_collection)
            agent = factory.create_from_json(agent_create_json)
            add_history_to_agent(agent, history)
            # print(agent.write_memory_to_messages())

            agent_run_with_observer(agent=agent, query=query, reset=False)

    except Exception as e:
        print(f"mcp connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"MCP server not connected: {str(e)}")
