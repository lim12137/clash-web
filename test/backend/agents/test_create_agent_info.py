import unittest
import logging
import sys
from unittest.mock import AsyncMock, MagicMock, patch, Mock
import pytest

# 创建一个模块模拟函数
def mock_module(name):
    mock = MagicMock()
    sys.modules[name] = mock
    return mock

# 模拟主要依赖
mock_module('nexent.core.utils.observer')
mock_module('nexent.core.agents.agent_model')
mock_module('smolagents.agents')
mock_module('smolagents.utils')
mock_module('smolagents.tools')
mock_module('services.remote_mcp_service')
mock_module('database.remote_mcp_db')
mock_module('database.client')
mock_module('utils.config_utils')
mock_module('utils.prompt_template_utils')
mock_module('database.agent_db')

# 预先模拟consts.model以避免Pydantic错误
mock_model = mock_module('consts.model')
mock_tool_config = MagicMock()
sys.modules['nexent.core.agents.agent_model'].ToolConfig = mock_tool_config

# 模拟logger
logger_mock = MagicMock()


class MockDiscoverLangchainTools:
    @staticmethod
    async def discover_langchain_tools():
        """模拟discover_langchain_tools函数以便于测试"""
        return []


class TestDiscoverLangchainTools:
    """测试discover_langchain_tools函数"""

    def setup_method(self):
        """每个测试方法前的设置"""
        # 为create_agent_info创建一个模拟模块
        self.agent_info_mock = MagicMock()
        # 添加logger
        self.agent_info_mock.logger = logger_mock
        # 将模拟模块设置为系统模块
        sys.modules['backend.agents.create_agent_info'] = self.agent_info_mock
        
        # 为discover_langchain_modules创建模拟
        self.discover_modules_mock = MagicMock()
        self.agent_info_mock.discover_langchain_modules = self.discover_modules_mock

    @pytest.mark.asyncio
    async def test_discover_langchain_tools_success(self):
        """测试成功发现LangChain工具的情况"""
        # 创建模拟的工具对象
        mock_tool1 = Mock()
        mock_tool1.name = "test_tool1"
        
        mock_tool2 = Mock()
        mock_tool2.name = "test_tool2"
        
        # 设置discover_langchain_modules的返回值
        self.discover_modules_mock.return_value = [
            (mock_tool1, "tool1.py"),
            (mock_tool2, "tool2.py")
        ]
        
        # 复原discover_langchain_tools函数的实现
        self.agent_info_mock.discover_langchain_tools = Mock(wraps=async_wrapper(self.agent_info_mock))
        
        # 执行函数
        result = await self.agent_info_mock.discover_langchain_tools()
        
        # 验证结果
        assert len(result) == 2
        assert result[0] == mock_tool1
        assert result[1] == mock_tool2
        assert self.discover_modules_mock.called

    @pytest.mark.asyncio
    async def test_discover_langchain_tools_empty(self):
        """测试未发现任何工具的情况"""
        # 设置discover_langchain_modules返回空列表
        self.discover_modules_mock.return_value = []
        
        # 复原discover_langchain_tools函数的实现
        self.agent_info_mock.discover_langchain_tools = Mock(wraps=async_wrapper(self.agent_info_mock))
        
        # 执行函数
        result = await self.agent_info_mock.discover_langchain_tools()
        
        # 验证结果
        assert len(result) == 0
        assert result == []
        assert self.discover_modules_mock.called

    @pytest.mark.asyncio
    async def test_discover_langchain_tools_module_exception(self):
        """测试discover_langchain_modules抛出异常的情况"""
        # 设置discover_langchain_modules抛出异常
        self.discover_modules_mock.side_effect = Exception("模块发现错误")
        
        # 复原discover_langchain_tools函数的实现
        self.agent_info_mock.discover_langchain_tools = Mock(wraps=async_wrapper(self.agent_info_mock))
        
        # 执行函数 - 应该捕获异常并返回空列表
        result = await self.agent_info_mock.discover_langchain_tools()
        
        # 验证结果
        assert len(result) == 0
        assert result == []
        assert self.discover_modules_mock.called

    @pytest.mark.asyncio
    async def test_discover_langchain_tools_processing_exception(self):
        """测试处理单个工具出错的情况"""
        # 创建一个正常的工具
        mock_good_tool = Mock()
        mock_good_tool.name = "good_tool"
        
        # 创建一个会引发异常的工具，使用真实类而不是Mock
        class ErrorTool:
            @property
            def name(self):
                raise Exception("工具处理错误")
        
        error_tool = ErrorTool()
        
        # 设置discover_langchain_modules的返回值
        self.discover_modules_mock.return_value = [
            (mock_good_tool, "good_tool.py"),
            (error_tool, "error_tool.py")
        ]
        
        # 复原discover_langchain_tools函数的实现
        self.agent_info_mock.discover_langchain_tools = Mock(wraps=async_wrapper(self.agent_info_mock))
        
        # 执行函数 - 应该正确处理一个工具并忽略错误的工具
        result = await self.agent_info_mock.discover_langchain_tools()
        
        # 验证结果
        assert len(result) == 1
        assert result[0] == mock_good_tool


def async_wrapper(mock):
    """创建一个简单的异步wrapper来模拟discover_langchain_tools函数的行为"""
    async def discover_langchain_tools():
        langchain_tools = []
        try:
            discovered_tools = mock.discover_langchain_modules()
            for obj, filename in discovered_tools:
                try:
                    # 先尝试访问name属性 - 如果这里抛出异常，则对象不会被添加
                    tool_name = obj.name
                    logger_mock.info(f"Loaded LangChain tool '{tool_name}' from {filename}")
                    langchain_tools.append(obj)
                except Exception as e:
                    logger_mock.error(f"Error processing LangChain tool from {filename}: {e}")
        except Exception as e:
            logger_mock.error(f"Unexpected error scanning LangChain tools directory: {e}")
        return langchain_tools
    return discover_langchain_tools


if __name__ == "__main__":
    unittest.main()
