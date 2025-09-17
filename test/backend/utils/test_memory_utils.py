import unittest
import logging
import sys
import os
from unittest.mock import MagicMock, patch, Mock, call
import pytest

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

# 模拟主要依赖
sys.modules['consts'] = MagicMock()
sys.modules['consts.const'] = MagicMock()
sys.modules['utils.config_utils'] = MagicMock()

# 模拟logger
logger_mock = MagicMock()


class TestMemoryUtils(unittest.TestCase):
    """测试memory_utils模块的函数"""

    def setUp(self):
        """每个测试方法前的设置"""
        # 导入原始函数
        from backend.utils.memory_utils import build_memory_config
        self.build_memory_config = build_memory_config

    def test_build_memory_config_success(self):
        """测试成功构建内存配置的情况"""
        # 模拟tenant_config_manager
        mock_tenant_config_manager = MagicMock()
        
        # 模拟LLM配置
        mock_llm_config = {
            "model_name": "gpt-4",
            "model_repo": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "test-llm-key"
        }
        
        # 模拟embedding配置
        mock_embed_config = {
            "model_name": "text-embedding-ada-002",
            "model_repo": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "test-embed-key",
            "max_tokens": 1536
        }
        
        # 模拟get_model_config返回值
        mock_tenant_config_manager.get_model_config.side_effect = [
            mock_llm_config,  # LLM配置
            mock_embed_config  # embedding配置
        ]
        
        # 模拟常量
        mock_const = MagicMock()
        mock_const.ES_HOST = "http://localhost:9200"
        mock_const.ES_API_KEY = "test-es-key"
        mock_const.ES_USERNAME = "elastic"
        mock_const.ES_PASSWORD = "test-password"
        
        # 模拟get_model_name_from_config
        mock_get_model_name = MagicMock()
        mock_get_model_name.side_effect = ["openai/gpt-4", "openai/text-embedding-ada-002"]
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager), \
             patch('backend.utils.memory_utils._c', mock_const), \
             patch('backend.utils.memory_utils.get_model_name_from_config', mock_get_model_name):
            
            # 执行函数
            result = self.build_memory_config("test-tenant-id")
            
            # 验证结果结构
            self.assertIsInstance(result, dict)
            self.assertIn("llm", result)
            self.assertIn("embedder", result)
            self.assertIn("vector_store", result)
            self.assertIn("telemetry", result)
            
            # 验证LLM配置
            self.assertEqual(result["llm"]["provider"], "openai")
            self.assertEqual(result["llm"]["config"]["model"], "openai/gpt-4")
            self.assertEqual(result["llm"]["config"]["openai_base_url"], "https://api.openai.com/v1")
            self.assertEqual(result["llm"]["config"]["api_key"], "test-llm-key")
            
            # 验证embedder配置
            self.assertEqual(result["embedder"]["provider"], "openai")
            self.assertEqual(result["embedder"]["config"]["model"], "openai/text-embedding-ada-002")
            self.assertEqual(result["embedder"]["config"]["openai_base_url"], "https://api.openai.com/v1")
            self.assertEqual(result["embedder"]["config"]["embedding_dims"], 1536)
            self.assertEqual(result["embedder"]["config"]["api_key"], "test-embed-key")
            
            # 验证vector_store配置
            self.assertEqual(result["vector_store"]["provider"], "elasticsearch")
            self.assertEqual(result["vector_store"]["config"]["collection_name"], "mem0")
            self.assertEqual(result["vector_store"]["config"]["host"], "http://localhost")
            self.assertEqual(result["vector_store"]["config"]["port"], 9200)
            self.assertEqual(result["vector_store"]["config"]["embedding_model_dims"], 1536)
            self.assertEqual(result["vector_store"]["config"]["verify_certs"], False)
            self.assertEqual(result["vector_store"]["config"]["api_key"], "test-es-key")
            self.assertEqual(result["vector_store"]["config"]["user"], "elastic")
            self.assertEqual(result["vector_store"]["config"]["password"], "test-password")
            
            # 验证telemetry配置
            self.assertEqual(result["telemetry"]["enabled"], False)
            
            # 验证get_model_name_from_config被正确调用
            self.assertEqual(mock_get_model_name.call_count, 2)
            mock_get_model_name.assert_any_call(mock_llm_config)
            mock_get_model_name.assert_any_call(mock_embed_config)

    def test_build_memory_config_missing_llm_config(self):
        """测试缺少LLM配置的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            None,  # LLM配置为None
            {"model_name": "test-embed", "max_tokens": 1536}  # embedding配置正常
        ]
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager):
            # 执行函数应该抛出异常
            with self.assertRaises(ValueError) as context:
                self.build_memory_config("test-tenant-id")
            
            self.assertIn("Missing LLM configuration for tenant", str(context.exception))

    def test_build_memory_config_llm_config_missing_model_name(self):
        """测试LLM配置缺少model_name的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            {"api_key": "test-key"},  # LLM配置缺少model_name
            {"model_name": "test-embed", "max_tokens": 1536}  # embedding配置正常
        ]
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager):
            # 执行函数应该抛出异常
            with self.assertRaises(ValueError) as context:
                self.build_memory_config("test-tenant-id")
            
            self.assertIn("Missing LLM configuration for tenant", str(context.exception))

    def test_build_memory_config_missing_embedding_config(self):
        """测试缺少embedding配置的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            {"model_name": "test-llm"},  # LLM配置正常
            None  # embedding配置为None
        ]
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager):
            # 执行函数应该抛出异常
            with self.assertRaises(ValueError) as context:
                self.build_memory_config("test-tenant-id")
            
            self.assertIn("Missing embedding-model configuration for tenant", str(context.exception))

    def test_build_memory_config_embedding_config_missing_max_tokens(self):
        """测试embedding配置缺少max_tokens的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            {"model_name": "test-llm"},  # LLM配置正常
            {"model_name": "test-embed"}  # embedding配置缺少max_tokens
        ]
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager):
            # 执行函数应该抛出异常
            with self.assertRaises(ValueError) as context:
                self.build_memory_config("test-tenant-id")
            
            self.assertIn("Missing embedding-model configuration for tenant", str(context.exception))

    def test_build_memory_config_missing_es_host(self):
        """测试缺少ES_HOST配置的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            {"model_name": "test-llm"},
            {"model_name": "test-embed", "max_tokens": 1536}
        ]
        
        mock_const = MagicMock()
        mock_const.ES_HOST = None  # ES_HOST为None
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager), \
             patch('backend.utils.memory_utils._c', mock_const):
            
            # 执行函数应该抛出异常
            with self.assertRaises(ValueError) as context:
                self.build_memory_config("test-tenant-id")
            
            self.assertIn("ES_HOST is not configured", str(context.exception))

    def test_build_memory_config_invalid_es_host_format(self):
        """测试ES_HOST格式无效的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            {"model_name": "test-llm"},
            {"model_name": "test-embed", "max_tokens": 1536}
        ]
        
        mock_const = MagicMock()
        mock_const.ES_HOST = "invalid-host"  # 无效的ES_HOST格式
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager), \
             patch('backend.utils.memory_utils._c', mock_const):
            
            # 执行函数应该抛出异常
            with self.assertRaises(ValueError) as context:
                self.build_memory_config("test-tenant-id")
            
            self.assertIn("ES_HOST must include scheme, host and port", str(context.exception))

    def test_build_memory_config_es_host_missing_scheme(self):
        """测试ES_HOST缺少scheme的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            {"model_name": "test-llm"},
            {"model_name": "test-embed", "max_tokens": 1536}
        ]
        
        mock_const = MagicMock()
        mock_const.ES_HOST = "localhost:9200"  # 缺少scheme
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager), \
             patch('backend.utils.memory_utils._c', mock_const):
            
            # 执行函数应该抛出异常
            with self.assertRaises(ValueError) as context:
                self.build_memory_config("test-tenant-id")
            
            self.assertIn("ES_HOST must include scheme, host and port", str(context.exception))

    def test_build_memory_config_es_host_missing_port(self):
        """测试ES_HOST缺少port的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            {"model_name": "test-llm"},
            {"model_name": "test-embed", "max_tokens": 1536}
        ]
        
        mock_const = MagicMock()
        mock_const.ES_HOST = "http://localhost"  # 缺少port
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager), \
             patch('backend.utils.memory_utils._c', mock_const):
            
            # 执行函数应该抛出异常
            with self.assertRaises(ValueError) as context:
                self.build_memory_config("test-tenant-id")
            
            self.assertIn("ES_HOST must include scheme, host and port", str(context.exception))

    def test_build_memory_config_with_https_es_host(self):
        """测试使用HTTPS的ES_HOST的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            {"model_name": "test-llm", "model_repo": "openai", "base_url": "https://api.openai.com/v1", "api_key": "test-llm-key"},
            {"model_name": "test-embed", "model_repo": "openai", "base_url": "https://api.openai.com/v1", "api_key": "test-embed-key", "max_tokens": 1536}
        ]
        
        mock_const = MagicMock()
        mock_const.ES_HOST = "https://elastic.example.com:9200"
        mock_const.ES_API_KEY = "test-es-key"
        mock_const.ES_USERNAME = "elastic"
        mock_const.ES_PASSWORD = "test-password"
        
        mock_get_model_name = MagicMock()
        mock_get_model_name.side_effect = ["openai/test-llm", "openai/test-embed"]
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager), \
             patch('backend.utils.memory_utils._c', mock_const), \
             patch('backend.utils.memory_utils.get_model_name_from_config', mock_get_model_name):
            
            # 执行函数
            result = self.build_memory_config("test-tenant-id")
            
            # 验证ES配置
            self.assertEqual(result["vector_store"]["config"]["host"], "https://elastic.example.com")
            self.assertEqual(result["vector_store"]["config"]["port"], 9200)

    def test_build_memory_config_with_custom_port(self):
        """测试使用自定义端口的ES_HOST的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            {"model_name": "test-llm", "model_repo": "openai", "base_url": "https://api.openai.com/v1", "api_key": "test-llm-key"},
            {"model_name": "test-embed", "model_repo": "openai", "base_url": "https://api.openai.com/v1", "api_key": "test-embed-key", "max_tokens": 1536}
        ]
        
        mock_const = MagicMock()
        mock_const.ES_HOST = "http://localhost:9300"  # 自定义端口
        mock_const.ES_API_KEY = "test-es-key"
        mock_const.ES_USERNAME = "elastic"
        mock_const.ES_PASSWORD = "test-password"
        
        mock_get_model_name = MagicMock()
        mock_get_model_name.side_effect = ["openai/test-llm", "openai/test-embed"]
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager), \
             patch('backend.utils.memory_utils._c', mock_const), \
             patch('backend.utils.memory_utils.get_model_name_from_config', mock_get_model_name):
            
            # 执行函数
            result = self.build_memory_config("test-tenant-id")
            
            # 验证ES配置
            self.assertEqual(result["vector_store"]["config"]["host"], "http://localhost")
            self.assertEqual(result["vector_store"]["config"]["port"], 9300)

    def test_build_memory_config_with_empty_model_repo(self):
        """测试模型配置中model_repo为空的情况"""
        mock_tenant_config_manager = MagicMock()
        mock_tenant_config_manager.get_model_config.side_effect = [
            {"model_name": "gpt-4", "model_repo": "", "base_url": "https://api.openai.com/v1", "api_key": "test-llm-key"},
            {"model_name": "text-embedding-ada-002", "model_repo": "", "base_url": "https://api.openai.com/v1", "api_key": "test-embed-key", "max_tokens": 1536}
        ]
        
        mock_const = MagicMock()
        mock_const.ES_HOST = "http://localhost:9200"
        mock_const.ES_API_KEY = "test-es-key"
        mock_const.ES_USERNAME = "elastic"
        mock_const.ES_PASSWORD = "test-password"
        
        mock_get_model_name = MagicMock()
        mock_get_model_name.side_effect = ["gpt-4", "text-embedding-ada-002"]  # 没有repo前缀
        
        with patch('backend.utils.memory_utils.tenant_config_manager', mock_tenant_config_manager), \
             patch('backend.utils.memory_utils._c', mock_const), \
             patch('backend.utils.memory_utils.get_model_name_from_config', mock_get_model_name):
            
            # 执行函数
            result = self.build_memory_config("test-tenant-id")
            
            # 验证模型名称
            self.assertEqual(result["llm"]["config"]["model"], "gpt-4")
            self.assertEqual(result["embedder"]["config"]["model"], "text-embedding-ada-002")


if __name__ == "__main__":
    unittest.main()