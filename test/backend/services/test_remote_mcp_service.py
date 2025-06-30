import unittest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.responses import JSONResponse
import httpx
import sys

# Mock external dependencies before importing the module
boto3_mock = MagicMock()
sys.modules['boto3'] = boto3_mock

# Mock MinioClient and database modules
minio_client_mock = MagicMock()
config_manager_mock = MagicMock()

with patch('backend.database.client.MinioClient', return_value=minio_client_mock), \
     patch('backend.utils.config_utils.config_manager', config_manager_mock):
    from backend.services.remote_mcp_service import (
        add_remote_proxy,
        add_remote_mcp_server_list,
        delete_remote_mcp_server_list,
        get_remote_mcp_server_list,
        recover_remote_mcp_server
    )


class TestAddRemoteProxy(unittest.TestCase):
    """测试 add_remote_proxy 函数"""

    def setUp(self):
        """每个测试前的设置"""
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_add_remote_proxy_success(self, mock_client):
        """测试成功添加远程代理"""
        # 设置 mock
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 执行测试
        result = await add_remote_proxy(
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # 断言
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 200)
        mock_client_instance.post.assert_called_once()

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_add_remote_proxy_name_exists(self, mock_client):
        """测试服务名已存在的情况"""
        # 设置 mock
        mock_response = MagicMock()
        mock_response.status_code = 409
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 执行测试
        result = await add_remote_proxy(
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="existing_server"
        )

        # 断言
        self.assertEqual(result.status_code, 409)

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_add_remote_proxy_connection_error(self, mock_client):
        """测试连接错误的情况"""
        # 设置 mock
        mock_response = MagicMock()
        mock_response.status_code = 503
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 执行测试
        result = await add_remote_proxy(
            remote_mcp_server="http://unreachable-server.com",
            remote_mcp_server_name="unreachable_server"
        )

        # 断言
        self.assertEqual(result.status_code, 503)

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_add_remote_proxy_exception(self, mock_client):
        """测试异常处理"""
        # 设置 mock 抛出异常
        mock_client.side_effect = Exception("Connection timeout")

        # 执行测试
        result = await add_remote_proxy(
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # 断言
        self.assertEqual(result.status_code, 400)


class TestAddRemoteMcpServerList(unittest.TestCase):
    """测试 add_remote_mcp_server_list 函数"""

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    async def test_add_remote_mcp_server_list_success(self, mock_add_proxy, mock_check_name, mock_create_record):
        """测试成功添加远程MCP服务器"""
        # 设置 mock
        mock_check_name.return_value = False
        mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})
        mock_create_record.return_value = True

        # 执行测试
        result = await add_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # 断言
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 200)
        mock_check_name.assert_called_once_with(mcp_name="test_server")
        mock_add_proxy.assert_called_once()
        mock_create_record.assert_called_once()

    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    async def test_add_remote_mcp_server_list_name_exists(self, mock_check_name):
        """测试服务名已存在的情况"""
        # 设置 mock
        mock_check_name.return_value = True

        # 执行测试
        result = await add_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="existing_server"
        )

        # 断言
        self.assertEqual(result.status_code, 409)

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    async def test_add_remote_mcp_server_list_database_error(self, mock_add_proxy, mock_check_name, mock_create_record):
        """测试数据库操作失败的情况"""
        # 设置 mock
        mock_check_name.return_value = False
        mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})
        mock_create_record.return_value = False

        # 执行测试
        result = await add_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # 断言
        self.assertFalse(result)


class TestDeleteRemoteMcpServerList(unittest.TestCase):
    """测试 delete_remote_mcp_server_list 函数"""

    def setUp(self):
        """每个测试前的设置"""
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    async def test_delete_remote_mcp_server_list_success(self, mock_delete_record, mock_client):
        """测试成功删除远程MCP服务器"""
        # 设置 mock
        mock_delete_record.return_value = True
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.delete.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 执行测试
        result = await delete_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # 断言
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 200)
        mock_delete_record.assert_called_once()
        mock_client_instance.delete.assert_called_once()

    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    async def test_delete_remote_mcp_server_list_record_not_found(self, mock_delete_record):
        """测试记录不存在的情况"""
        # 设置 mock
        mock_delete_record.return_value = False

        # 执行测试
        result = await delete_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="nonexistent_server"
        )

        # 断言
        self.assertEqual(result.status_code, 400)

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    async def test_delete_remote_mcp_server_list_proxy_not_found(self, mock_delete_record, mock_client):
        """测试代理不存在的情况"""
        # 设置 mock
        mock_delete_record.return_value = True
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_client_instance = AsyncMock()
        mock_client_instance.delete.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 执行测试
        result = await delete_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # 断言
        self.assertEqual(result.status_code, 400)


class TestGetRemoteMcpServerList(unittest.TestCase):
    """测试 get_remote_mcp_server_list 函数"""

    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_remote_mcp_server_list_success(self, mock_get_records):
        """测试成功获取远程MCP服务器列表"""
        # 设置 mock
        mock_records = [
            {"mcp_name": "server1", "mcp_server": "http://server1.com"},
            {"mcp_name": "server2", "mcp_server": "http://server2.com"}
        ]
        mock_get_records.return_value = mock_records

        # 执行测试
        result = await get_remote_mcp_server_list(tenant_id="tenant_1")

        # 断言
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["remote_mcp_server_name"], "server1")
        self.assertEqual(result[0]["remote_mcp_server"], "http://server1.com")
        mock_get_records.assert_called_once_with(tenant_id="tenant_1")

    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_remote_mcp_server_list_empty(self, mock_get_records):
        """测试空列表情况"""
        # 设置 mock
        mock_get_records.return_value = []

        # 执行测试
        result = await get_remote_mcp_server_list(tenant_id="tenant_1")

        # 断言
        self.assertEqual(len(result), 0)


class TestRecoverRemoteMcpServer(unittest.TestCase):
    """测试 recover_remote_mcp_server 函数"""

    def setUp(self):
        """每个测试前的设置"""
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.get_remote_mcp_server_list')
    async def test_recover_remote_mcp_server_success(self, mock_get_list, mock_client, mock_add_proxy):
        """测试成功恢复远程MCP服务器"""
        # 设置 mock
        mock_get_list.return_value = [
            {"remote_mcp_server_name": "server1", "remote_mcp_server": "http://server1.com"},
            {"remote_mcp_server_name": "server2", "remote_mcp_server": "http://server2.com"}
        ]
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "proxies": {
                "server1": {"mcp_url": "http://server1.com"}
            }
        }
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})

        # 执行测试
        result = await recover_remote_mcp_server(tenant_id="tenant_1")

        # 断言
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 200)
        # server2 应该被恢复，因为它在记录中但不在远程代理列表中
        mock_add_proxy.assert_called_once()

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.get_remote_mcp_server_list')
    async def test_recover_remote_mcp_server_list_error(self, mock_get_list, mock_client):
        """测试获取远程代理列表失败的情况"""
        # 设置 mock
        mock_get_list.return_value = []
        
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 执行测试
        result = await recover_remote_mcp_server(tenant_id="tenant_1")

        # 断言
        self.assertEqual(result.status_code, 400)
