import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.responses import JSONResponse

import sys
sys.modules['boto3'] = MagicMock()

# 需要测试的四个方法
with patch('backend.database.client.MinioClient', MagicMock()):
    from backend.services.remote_mcp_service import (
        mcp_server_health,
        add_remote_mcp_server_list,
        delete_remote_mcp_server_list,
        get_remote_mcp_server_list
    )

class TestMcpServerHealth(unittest.IsolatedAsyncioTestCase):
    """测试 mcp_server_health"""
    @patch('backend.services.remote_mcp_service.Client')
    async def test_health_success(self, mock_client_cls):
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.is_connected.return_value = True
        mock_client_cls.return_value = mock_client
        resp = await mcp_server_health('http://test-server')
        self.assertIsInstance(resp, JSONResponse)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.body, b'{"message":"Successfully connected to remote MCP server","status":"success"}')

    @patch('backend.services.remote_mcp_service.Client')
    async def test_health_fail(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.is_connected.return_value = False
        mock_client_cls.return_value = mock_client
        resp = await mcp_server_health('http://test-server')
        self.assertEqual(resp.status_code, 503)
        self.assertIn(b'Cannot connect to remote MCP server', resp.body)

    @patch('backend.services.remote_mcp_service.Client', side_effect=Exception('fail'))
    async def test_health_exception(self, mock_client_cls):
        resp = await mcp_server_health('http://test-server')
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'Failed to add remote MCP proxy', resp.body)

    @patch('backend.services.remote_mcp_service.Client')
    async def test_health_with_https_url(self, mock_client_cls):
        """测试 HTTPS URL 的健康检查"""
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.is_connected.return_value = True
        mock_client_cls.return_value = mock_client
        resp = await mcp_server_health('https://secure-server.com')
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b'Successfully connected', resp.body)

    @patch('backend.services.remote_mcp_service.Client')
    async def test_health_with_port(self, mock_client_cls):
        """测试带端口的 URL 健康检查"""
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.is_connected.return_value = True
        mock_client_cls.return_value = mock_client
        resp = await mcp_server_health('http://test-server:8080')
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b'Successfully connected', resp.body)

class TestAddRemoteMcpServerList(unittest.IsolatedAsyncioTestCase):
    """测试 add_remote_mcp_server_list"""
    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.mcp_server_health')
    async def test_add_success(self, mock_health, mock_create):
        mock_health.return_value = JSONResponse(status_code=200, content={"message": "mock"})
        mock_create.return_value = True
        resp = await add_remote_mcp_server_list('tid', 'uid', 'http://srv', 'name')
        self.assertIsInstance(resp, JSONResponse)
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b'Successfully added remote MCP proxy', resp.body)

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.mcp_server_health')
    async def test_add_health_fail(self, mock_health, mock_create):
        mock_health.return_value = JSONResponse(status_code=503, content={"message": "mock"})
        resp = await add_remote_mcp_server_list('tid', 'uid', 'http://srv', 'name')
        self.assertEqual(resp.status_code, 503)

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.mcp_server_health')
    async def test_add_db_fail(self, mock_health, mock_create):
        mock_health.return_value = JSONResponse(status_code=200, content={"message": "mock"})
        mock_create.return_value = False
        resp = await add_remote_mcp_server_list('tid', 'uid', 'http://srv', 'name')
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'database error', resp.body)

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.mcp_server_health')
    async def test_add_with_special_characters(self, mock_health, mock_create):
        """测试包含特殊字符的服务器名称"""
        mock_health.return_value = JSONResponse(status_code=200, content={"message": "mock"})
        mock_create.return_value = True
        resp = await add_remote_mcp_server_list('tid', 'uid', 'http://srv', 'test-server_123')
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b'Successfully added', resp.body)

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.mcp_server_health')
    async def test_add_with_long_url(self, mock_health, mock_create):
        """测试长 URL"""
        long_url = 'http://' + 'a' * 100 + '.com'
        mock_health.return_value = JSONResponse(status_code=200, content={"message": "mock"})
        mock_create.return_value = True
        resp = await add_remote_mcp_server_list('tid', 'uid', long_url, 'name')
        self.assertEqual(resp.status_code, 200)

class TestDeleteRemoteMcpServerList(unittest.IsolatedAsyncioTestCase):
    """测试 delete_remote_mcp_server_list"""
    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    async def test_delete_success(self, mock_delete):
        mock_delete.return_value = True
        resp = await delete_remote_mcp_server_list('tid', 'uid', 'http://srv', 'name')
        self.assertIsInstance(resp, JSONResponse)
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b'Successfully deleted remote MCP proxy', resp.body)

    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    async def test_delete_fail(self, mock_delete):
        mock_delete.return_value = False
        resp = await delete_remote_mcp_server_list('tid', 'uid', 'http://srv', 'name')
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'Failed to delete remote MCP server', resp.body)

    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    async def test_delete_nonexistent_server(self, mock_delete):
        """测试删除不存在的服务器"""
        mock_delete.return_value = False
        resp = await delete_remote_mcp_server_list('tid', 'uid', 'http://nonexistent', 'nonexistent')
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'server not record', resp.body)

    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    async def test_delete_with_special_characters(self, mock_delete):
        """测试删除包含特殊字符的服务器"""
        mock_delete.return_value = True
        resp = await delete_remote_mcp_server_list('tid', 'uid', 'http://srv', 'test-server_123')
        self.assertEqual(resp.status_code, 200)

class TestGetRemoteMcpServerList(unittest.IsolatedAsyncioTestCase):
    """测试 get_remote_mcp_server_list"""
    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_list(self, mock_get):
        mock_get.return_value = [
            {"mcp_name": "n1", "mcp_server": "u1", "status": True},
            {"mcp_name": "n2", "mcp_server": "u2", "status": False}
        ]
        result = await get_remote_mcp_server_list('tid')
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["remote_mcp_server_name"], "n1")
        self.assertEqual(result[1]["status"], False)

    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_empty(self, mock_get):
        mock_get.return_value = []
        result = await get_remote_mcp_server_list('tid')
        self.assertEqual(result, [])

    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_single_record(self, mock_get):
        """测试获取单个记录"""
        mock_get.return_value = [
            {"mcp_name": "single_server", "mcp_server": "http://single.com", "status": True}
        ]
        result = await get_remote_mcp_server_list('tid')
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["remote_mcp_server_name"], "single_server")
        self.assertEqual(result[0]["remote_mcp_server"], "http://single.com")
        self.assertEqual(result[0]["status"], True)

    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_large_list(self, mock_get):
        """测试获取大量记录"""
        large_list = []
        for i in range(100):
            large_list.append({
                "mcp_name": f"server_{i}",
                "mcp_server": f"http://server_{i}.com",
                "status": i % 2 == 0  # 交替状态
            })
        mock_get.return_value = large_list
        result = await get_remote_mcp_server_list('tid')
        self.assertEqual(len(result), 100)
        self.assertEqual(result[0]["remote_mcp_server_name"], "server_0")
        self.assertEqual(result[99]["remote_mcp_server_name"], "server_99")

    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_with_special_characters(self, mock_get):
        """测试包含特殊字符的记录"""
        mock_get.return_value = [
            {"mcp_name": "test-server_123", "mcp_server": "http://test-server.com:8080", "status": True}
        ]
        result = await get_remote_mcp_server_list('tid')
        self.assertEqual(result[0]["remote_mcp_server_name"], "test-server_123")
        self.assertEqual(result[0]["remote_mcp_server"], "http://test-server.com:8080")

class TestIntegrationScenarios(unittest.IsolatedAsyncioTestCase):
    """集成测试场景"""
    
    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    @patch('backend.services.remote_mcp_service.mcp_server_health')
    async def test_full_lifecycle(self, mock_health, mock_get, mock_delete, mock_create):
        """测试完整的 MCP 服务器生命周期"""
        # 1. 健康检查成功
        mock_health.return_value = JSONResponse(status_code=200, content={"message": "mock"})
        mock_create.return_value = True
        
        # 2. 添加服务器
        add_resp = await add_remote_mcp_server_list('tid', 'uid', 'http://srv', 'name')
        self.assertEqual(add_resp.status_code, 200)
        
        # 3. 获取服务器列表
        mock_get.return_value = [{"mcp_name": "name", "mcp_server": "http://srv", "status": True}]
        list_result = await get_remote_mcp_server_list('tid')
        self.assertEqual(len(list_result), 1)
        self.assertEqual(list_result[0]["remote_mcp_server_name"], "name")
        
        # 4. 删除服务器
        mock_delete.return_value = True
        delete_resp = await delete_remote_mcp_server_list('tid', 'uid', 'http://srv', 'name')
        self.assertEqual(delete_resp.status_code, 200)

if __name__ == '__main__':
    unittest.main()
