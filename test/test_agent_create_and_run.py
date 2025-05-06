import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from dotenv import load_dotenv
from smolagents import ToolCollection
from nexent.core.utils.observer import MessageObserver

# 添加backend目录到路径，以便导入ConfigManager
sys.path.append(os.path.abspath("backend"))
from backend.utils.config_utils import config_manager
from backend.utils.agent_create_factory import AgentCreateFactory


class TestAgentCreate:
    """测试Agent创建与运行"""
    agent_json = "backend/consts/agents/manager_agent_demo.json"
    
    @pytest.fixture
    def setup_observer(self):
        """初始化MessageObserver"""
        return MessageObserver()
    
    @pytest.mark.integration
    def test_create_and_run_agent(self, setup_observer):
        """测试从配置创建并运行agent"""
        observer = setup_observer
        query = "你好"
        
        try:
            with ToolCollection.from_mcp({"url": config_manager.get_config("MCP_SERVICE")}) as tool_collection:
                factory = AgentCreateFactory(observer=observer,
                                            mcp_tool_collection=tool_collection)
                agent = factory.create_from_json(self.agent_json)
                agent.run(query)
                
                messages = observer.get_cached_message()
                print(f"测试结果: 获取到 {len(messages)} 条消息")
                assert len(messages) > 0
        except Exception as e:
            pytest.fail(f"mcp连接出错: {str(e)}")
    
    @pytest.mark.unit
    def test_create_agent_with_mock(self, setup_observer):
        """使用Mock测试Agent创建"""
        observer = setup_observer
        
        # 创建ToolCollection的模拟对象
        mock_tool_collection = MagicMock()
        
        # 创建factory和agent
        with patch('backend.utils.agent_create_factory.AgentCreateFactory.create_from_json') as mock_create:
            # 配置mock返回值
            mock_agent = MagicMock()
            mock_create.return_value = mock_agent
            
            factory = AgentCreateFactory(observer=observer,
                                        mcp_tool_collection=mock_tool_collection)
            
            # 调用方法
            factory.create_from_json(self.agent_json)
            
            # 验证调用
            mock_create.assert_called_once_with(self.agent_json)

if __name__ == "__main__":
    pytest.main(["-xvs", "test_agent_create.py"])
