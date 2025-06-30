import unittest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from starlette.requests import Request
from starlette.responses import JSONResponse
import sys
import json

# Mock external dependencies before importing the module
boto3_mock = MagicMock()
fastmcp_mock = MagicMock()
sys.modules['boto3'] = boto3_mock
sys.modules['fastmcp'] = fastmcp_mock

# Mock MinioClient and other dependencies
minio_client_mock = MagicMock()

with patch('backend.database.client.MinioClient', return_value=minio_client_mock):
    # Mock the FastMCP and Client classes
    with patch('backend.nexent_mcp_service.FastMCP') as mock_fastmcp, \
         patch('backend.nexent_mcp_service.Client') as mock_client, \
         patch('backend.nexent_mcp_service.local_mcp_service') as mock_local_service, \
         patch('backend.nexent_mcp_service.RemoteProxyManager') as mock_proxy_manager:
        
        # Import after mocking
        from backend.nexent_mcp_service import (
            healthcheck,
            list_remote_proxies,
            add_remote_proxy,
            remove_remote_proxy
        )


class TestHealthcheck(unittest.TestCase):
    """测试 healthcheck 端点"""

    async def test_healthcheck_success(self):
        """测试健康检查成功"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        mock_request.query_params = {"mcp_url": "http://test-server.com"}
        
        # 创建模拟的 Client
        mock_client_instance = AsyncMock()
        mock_client_instance.is_connected.return_value = True
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate, \
             patch('backend.nexent_mcp_service.Client') as mock_client_class:
            
            # 设置 mock
            mock_validate.return_value = (True, {"mcp_url": "http://test-server.com"})
            mock_client_class.return_value = mock_client_instance
            
            # 执行测试
            result = await healthcheck(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            # 检查返回的 JSON 内容
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "success")
            self.assertEqual(response_data["url"], "http://test-server.com")
            self.assertTrue(response_data["connected"])

    async def test_healthcheck_invalid_params(self):
        """测试健康检查参数无效"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        mock_request.query_params = {}
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate:
            # 设置 mock 返回无效参数
            mock_error_response = JSONResponse(
                {"status": "error", "message": "Missing required parameter: mcp_url"},
                status_code=400
            )
            mock_validate.return_value = (False, mock_error_response)
            
            # 执行测试
            result = await healthcheck(mock_request)
            
            # 断言
            self.assertEqual(result, mock_error_response)

    async def test_healthcheck_connection_error(self):
        """测试健康检查连接错误"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        mock_request.query_params = {"mcp_url": "http://unreachable-server.com"}
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate, \
             patch('backend.nexent_mcp_service.Client') as mock_client_class:
            
            # 设置 mock
            mock_validate.return_value = (True, {"mcp_url": "http://unreachable-server.com"})
            mock_client_class.side_effect = Exception("Connection failed")
            
            # 执行测试
            result = await healthcheck(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 500)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")


class TestListRemoteProxies(unittest.TestCase):
    """测试 list_remote_proxies 端点"""

    async def test_list_remote_proxies_success(self):
        """测试成功列出远程代理"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        
        # 模拟代理管理器
        mock_proxies = {
            "server1": MagicMock(mcp_url="http://server1.com", transport="sse"),
            "server2": MagicMock(mcp_url="http://server2.com", transport="sse")
        }
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager:
            mock_manager.list_remote_proxies.return_value = mock_proxies
            
            # 执行测试
            result = await list_remote_proxies(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "success")
            self.assertIn("proxies", response_data)
            self.assertEqual(len(response_data["proxies"]), 2)
            self.assertEqual(response_data["proxies"]["server1"]["mcp_url"], "http://server1.com")

    async def test_list_remote_proxies_empty(self):
        """测试列出空的远程代理列表"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager:
            mock_manager.list_remote_proxies.return_value = {}
            
            # 执行测试
            result = await list_remote_proxies(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "success")
            self.assertEqual(len(response_data["proxies"]), 0)


class TestAddRemoteProxy(unittest.TestCase):
    """测试 add_remote_proxy 端点"""

    async def test_add_remote_proxy_success(self):
        """测试成功添加远程代理"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        mock_request.json = AsyncMock(return_value={
            "mcp_url": "http://test-server.com",
            "service_name": "test_server",
            "transport": "sse"
        })
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager, \
             patch('backend.nexent_mcp_service.RemoteMCPConfig') as mock_config:
            
            # 设置 mock
            mock_config_instance = MagicMock()
            mock_config_instance.mcp_url = "http://test-server.com"
            mock_config_instance.service_name = "test_server"
            mock_config_instance.transport = "sse"
            mock_config.return_value = mock_config_instance
            mock_manager.add_remote_proxy.return_value = True
            
            # 执行测试
            result = await add_remote_proxy(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "success")
            mock_manager.add_remote_proxy.assert_called_once()

    async def test_add_remote_proxy_service_exists(self):
        """测试添加已存在的服务名"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        mock_request.json = AsyncMock(return_value={
            "mcp_url": "http://test-server.com",
            "service_name": "existing_server",
            "transport": "sse"
        })
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager, \
             patch('backend.nexent_mcp_service.RemoteMCPConfig') as mock_config:
            
            # 设置 mock 抛出 ValueError（服务名已存在）
            mock_config_instance = MagicMock()
            mock_config.return_value = mock_config_instance
            mock_manager.add_remote_proxy.side_effect = ValueError("Service name already exists")
            
            # 执行测试
            result = await add_remote_proxy(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 409)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")

    async def test_add_remote_proxy_connection_error(self):
        """测试添加代理时连接错误"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        mock_request.json = AsyncMock(return_value={
            "mcp_url": "http://unreachable-server.com",
            "service_name": "unreachable_server",
            "transport": "sse"
        })
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager, \
             patch('backend.nexent_mcp_service.RemoteMCPConfig') as mock_config:
            
            # 设置 mock 抛出 ConnectionError
            mock_config_instance = MagicMock()
            mock_config.return_value = mock_config_instance
            mock_manager.add_remote_proxy.side_effect = ConnectionError("Cannot connect to remote MCP server")
            
            # 执行测试
            result = await add_remote_proxy(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 503)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")

    async def test_add_remote_proxy_invalid_request(self):
        """测试无效请求"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        mock_request.json = AsyncMock(return_value={
            "mcp_url": "invalid-url",
            "service_name": "",
            "transport": "invalid"
        })
        
        with patch('backend.nexent_mcp_service.RemoteMCPConfig') as mock_config:
            # 设置 mock 抛出异常（无效请求）
            mock_config.side_effect = Exception("Invalid request data")
            
            # 执行测试
            result = await add_remote_proxy(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 400)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")

    async def test_add_remote_proxy_failed(self):
        """测试添加代理失败"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        mock_request.json = AsyncMock(return_value={
            "mcp_url": "http://test-server.com",
            "service_name": "test_server",
            "transport": "sse"
        })
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager, \
             patch('backend.nexent_mcp_service.RemoteMCPConfig') as mock_config:
            
            # 设置 mock
            mock_config_instance = MagicMock()
            mock_config.return_value = mock_config_instance
            mock_manager.add_remote_proxy.return_value = False
            
            # 执行测试
            result = await add_remote_proxy(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 500)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")


class TestRemoveRemoteProxy(unittest.TestCase):
    """测试 remove_remote_proxy 端点"""

    async def test_remove_remote_proxy_success(self):
        """测试成功删除远程代理"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate, \
             patch('backend.nexent_mcp_service.proxy_manager') as mock_manager:
            
            # 设置 mock
            mock_validate.return_value = (True, {"service_name": "test_server"})
            mock_manager.remove_remote_proxy.return_value = True
            
            # 执行测试
            result = await remove_remote_proxy(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "success")
            mock_manager.remove_remote_proxy.assert_called_once_with("test_server")

    async def test_remove_remote_proxy_invalid_params(self):
        """测试删除代理时参数无效"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate:
            # 设置 mock 返回无效参数
            mock_error_response = JSONResponse(
                {"status": "error", "message": "Missing required parameter: service_name"},
                status_code=400
            )
            mock_validate.return_value = (False, mock_error_response)
            
            # 执行测试
            result = await remove_remote_proxy(mock_request)
            
            # 断言
            self.assertEqual(result, mock_error_response)

    async def test_remove_remote_proxy_not_found(self):
        """测试删除不存在的代理"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate, \
             patch('backend.nexent_mcp_service.proxy_manager') as mock_manager:
            
            # 设置 mock
            mock_validate.return_value = (True, {"service_name": "nonexistent_server"})
            mock_manager.remove_remote_proxy.return_value = False
            
            # 执行测试
            result = await remove_remote_proxy(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 404)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")

    async def test_remove_remote_proxy_exception(self):
        """测试删除代理时发生异常"""
        # 创建模拟的 Request 对象
        mock_request = MagicMock(spec=Request)
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate, \
             patch('backend.nexent_mcp_service.proxy_manager') as mock_manager:
            
            # 设置 mock
            mock_validate.return_value = (True, {"service_name": "test_server"})
            mock_manager.remove_remote_proxy.side_effect = Exception("Database error")
            
            # 执行测试
            result = await remove_remote_proxy(mock_request)
            
            # 断言
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 500)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")

