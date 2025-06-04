import logging
import threading
from typing import Dict
from nexent.core.agents.agent_const import AgentRunInfo


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agent run manager")


class AgentRunManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(AgentRunManager, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.agent_runs: Dict[int, AgentRunInfo] = {}  # conversation_id -> agent_run_info
            self._initialized = True

    def register_agent_run(self, conversation_id: int, agent_run_info):
        """注册agent运行实例"""
        with self._lock:
            self.agent_runs[conversation_id] = agent_run_info
            logger.info(f"注册agent运行实例，conversation_id: {conversation_id}")

    def unregister_agent_run(self, conversation_id: int):
        """注销agent运行实例"""
        with self._lock:
            if conversation_id in self.agent_runs:
                del self.agent_runs[conversation_id]
                logger.info(f"注销agent运行实例，conversation_id: {conversation_id}")
            else:
                logger.info(f"未找到conversation_id: {conversation_id}的agent运行实例")

    def get_agent_run_info(self, conversation_id: int):
        """获取agent运行实例"""
        return self.agent_runs.get(conversation_id)

    def stop_agent_run(self, conversation_id: int) -> bool:
        """停止指定conversation_id的agent运行"""
        agent_run_info = self.get_agent_run_info(conversation_id)
        if agent_run_info is not None:
            agent_run_info.stop_event.set()
            logger.info(f"已停止agent运行，conversation_id: {conversation_id}")
            return True
        return False


# 创建单例实例
agent_run_manager = AgentRunManager()