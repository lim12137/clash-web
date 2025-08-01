import unittest
import logging
import sys
import os
from unittest.mock import MagicMock, patch, Mock, call
import pytest

# 创建一个模块模拟函数
def mock_module(name):
    mock = MagicMock()
    sys.modules[name] = mock
    return mock

# 模拟主要依赖
mock_module('langchain_core.tools')

# 模拟logger
logger_mock = MagicMock()


class TestLangchainUtils:
    """测试langchain_utils模块的函数"""

    def setup_method(self):
        """每个测试方法前的设置"""
        # 为langchain_utils创建一个模拟模块
        self.langchain_utils_mock = MagicMock()
        # 添加logger
        self.langchain_utils_mock.logger = logger_mock
        
        # 复制原始函数到模拟对象
        from backend.utils.langchain_utils import discover_langchain_modules, _is_langchain_tool
        self.langchain_utils_mock.discover_langchain_modules = discover_langchain_modules
        self.langchain_utils_mock._is_langchain_tool = _is_langchain_tool
        
        # 将模拟模块设置为系统模块
        sys.modules['backend.utils.langchain_utils'] = self.langchain_utils_mock
        
        # 模拟BaseTool类
        self.mock_base_tool = MagicMock()
        sys.modules['langchain_core.tools'].BaseTool = self.mock_base_tool

    def test_is_langchain_tool(self):
        """测试_is_langchain_tool函数"""
        # 创建一个BaseTool实例的模拟
        mock_tool = MagicMock(spec=self.mock_base_tool)
        
        # 模拟isinstance返回值
        with patch('backend.utils.langchain_utils.isinstance', return_value=True):
            result = self.langchain_utils_mock._is_langchain_tool(mock_tool)
            assert result is True
        
        # 测试非BaseTool对象
        with patch('backend.utils.langchain_utils.isinstance', return_value=False):
            result = self.langchain_utils_mock._is_langchain_tool("not a tool")
            assert result is False

    def test_discover_langchain_modules_success(self):
        """测试成功发现LangChain工具的情况"""
        # 创建一个临时目录结构
        with patch('os.path.isdir', return_value=True), \
             patch('os.listdir', return_value=['tool1.py', 'tool2.py', '__init__.py', 'not_a_py_file.txt']), \
             patch('importlib.util.spec_from_file_location') as mock_spec, \
             patch('importlib.util.module_from_spec') as mock_module_from_spec:
            
            # 创建模拟工具对象
            mock_tool1 = MagicMock(name="tool1")
            mock_tool2 = MagicMock(name="tool2")
            
            # 设置模拟module
            mock_module_obj1 = MagicMock()
            mock_module_obj1.tool_obj1 = mock_tool1  # 添加属性供 discover_langchain_modules 捕获

            mock_module_obj2 = MagicMock()
            mock_module_obj2.tool_obj2 = mock_tool2
            
            mock_module_from_spec.side_effect = [mock_module_obj1, mock_module_obj2]
            
            # 设置模拟spec和loader
            mock_spec_obj1 = MagicMock()
            mock_spec_obj2 = MagicMock()
            mock_spec.side_effect = [mock_spec_obj1, mock_spec_obj2]
            
            mock_loader1 = MagicMock()
            mock_loader2 = MagicMock()
            mock_spec_obj1.loader = mock_loader1
            mock_spec_obj2.loader = mock_loader2
            
            # 设置过滤函数始终返回True
            def mock_filter(obj):
                return obj is mock_tool1 or obj is mock_tool2
                
            # 执行函数
            result = self.langchain_utils_mock.discover_langchain_modules(
                filter_func=mock_filter
            )
            
            # 验证loader.exec_module被调用
            mock_loader1.exec_module.assert_called_once_with(mock_module_obj1)
            mock_loader2.exec_module.assert_called_once_with(mock_module_obj2)
            
            # 验证结果
            assert len(result) == 2
            # 验证返回的对象是否是我们期望的对象
            discovered_objs = [obj for (obj, _) in result]
            assert mock_tool1 in discovered_objs
            assert mock_tool2 in discovered_objs

    def test_discover_langchain_modules_directory_not_found(self):
        """测试目录不存在的情况"""
        with patch('os.path.isdir', return_value=False):
            result = self.langchain_utils_mock.discover_langchain_modules(directory="non_existent_dir")
            
            # 验证结果为空列表
            assert result == []

    def test_discover_langchain_modules_module_exception(self):
        """测试处理模块异常的情况"""
        with patch('os.path.isdir', return_value=True), \
             patch('os.listdir', return_value=['error_module.py']), \
             patch('importlib.util.spec_from_file_location') as mock_spec, \
             patch('backend.utils.langchain_utils.logger', logger_mock):
            
            # 设置spec_from_file_location抛出异常
            mock_spec.side_effect = Exception("Module error")
            
            # 执行函数 - 应该捕获异常并继续
            result = self.langchain_utils_mock.discover_langchain_modules()
            
            # 验证结果为空列表
            assert result == []
            # 验证错误被记录
            assert logger_mock.error.called
            # 验证错误消息包含预期内容
            logger_mock.error.assert_called_with("Error processing module error_module.py: Module error")

    def test_discover_langchain_modules_spec_loader_none(self):
        """测试spec或loader为None的情况"""
        with patch('os.path.isdir', return_value=True), \
             patch('os.listdir', return_value=['invalid_module.py']), \
             patch('importlib.util.spec_from_file_location', return_value=None), \
             patch('backend.utils.langchain_utils.logger', logger_mock):
            
            # 执行函数
            result = self.langchain_utils_mock.discover_langchain_modules()
            
            # 验证结果为空列表
            assert result == []
            # 验证警告被记录
            assert logger_mock.warning.called
            # 验证警告消息
            logger_mock.warning.assert_called_once()

    def test_discover_langchain_modules_custom_filter(self):
        """测试使用自定义过滤函数的情况"""
        with patch('os.path.isdir', return_value=True), \
             patch('os.listdir', return_value=['tool.py']), \
             patch('importlib.util.spec_from_file_location') as mock_spec, \
             patch('importlib.util.module_from_spec') as mock_module_from_spec:
            
            # 创建两个对象，一个通过过滤，一个不通过
            obj_pass = MagicMock(name="pass_object")
            obj_fail = MagicMock(name="fail_object")
            
            # 设置模拟module，使其包含我们的两个测试对象
            mock_module_obj = MagicMock()
            mock_module_obj.obj_pass = obj_pass
            mock_module_obj.obj_fail = obj_fail
            mock_module_from_spec.return_value = mock_module_obj
            
            # 设置模拟spec和loader
            mock_spec_obj = MagicMock()
            mock_spec.return_value = mock_spec_obj
            mock_loader = MagicMock()
            mock_spec_obj.loader = mock_loader
            
            # 自定义过滤函数，只接受obj_pass
            def custom_filter(obj):
                return obj is obj_pass
            
            # 执行函数
            result = self.langchain_utils_mock.discover_langchain_modules(
                filter_func=custom_filter
            )
            
            # 验证loader.exec_module被调用
            mock_loader.exec_module.assert_called_once_with(mock_module_obj)
            
            # 验证结果 - 应该只有一个对象通过过滤
            assert len(result) == 1
            assert result[0][0] is obj_pass


if __name__ == "__main__":
    unittest.main()
