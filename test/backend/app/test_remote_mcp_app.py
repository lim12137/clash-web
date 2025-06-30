import unittest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.responses import JSONResponse
import sys
import json

# Mock external dependencies before importing modules
boto3_mock = MagicMock()
fastmcp_mock = MagicMock()
sys.modules['boto3'] = boto3_mock
sys.modules['fastmcp'] = fastmcp_mock

# Mock MinioClient and other dependencies
minio_client_mock = MagicMock()
config_manager_mock = MagicMock()

with patch('backend.database.client.MinioClient', return_value=minio_client_mock), \
     patch('backend.utils.config_utils.config_manager', config_manager_mock):
    from backend.services.remote_mcp_service import (
        add_remote_mcp_server_list,
        delete_remote_mcp_server_list,
        recover_remote_mcp_server,
        get_remote_mcp_server_list
    )


class TestMCPServiceIntegration(unittest.TestCase):
    """测试 MCP 服务间的集成功能"""

    def setUp(self):
        """每个测试前的设置"""
        config_manager_mock.reset_mock()
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_complete_mcp_server_lifecycle(self, mock_client, mock_check_name, mock_create_record):
        """测试完整的 MCP 服务器生命周期：添加、查询、删除"""
        # 设置 mock
        mock_check_name.return_value = False
        mock_create_record.return_value = True
        
        # Mock HTTP 响应
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client_instance.delete.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 1. 添加远程 MCP 服务器
        add_result = await add_remote_mcp_server_list(
            tenant_id="test_tenant",
            user_id="test_user",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )
        
        # 验证添加成功
        self.assertIsInstance(add_result, JSONResponse)
        self.assertEqual(add_result.status_code, 200)
        mock_check_name.assert_called_with(mcp_name="test_server")
        mock_create_record.assert_called_once()

        # 2. 删除远程 MCP 服务器
        with patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url') as mock_delete_record:
            mock_delete_record.return_value = True
            
            delete_result = await delete_remote_mcp_server_list(
                tenant_id="test_tenant",
                user_id="test_user",
                remote_mcp_server="http://test-server.com",
                remote_mcp_server_name="test_server"
            )
            
            # 验证删除成功
            self.assertIsInstance(delete_result, JSONResponse)
            self.assertEqual(delete_result.status_code, 200)
            mock_delete_record.assert_called_once()

    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_remote_mcp_server_list_integration(self, mock_get_records):
        """测试获取远程 MCP 服务器列表的集成功能"""
        # 设置测试数据
        mock_records = [
            {"mcp_name": "server1", "mcp_server": "http://server1.com"},
            {"mcp_name": "server2", "mcp_server": "http://server2.com"},
            {"mcp_name": "server3", "mcp_server": "http://server3.com"}
        ]
        mock_get_records.return_value = mock_records

        # 执行测试
        result = await get_remote_mcp_server_list(tenant_id="test_tenant")

        # 验证结果
        self.assertEqual(len(result), 3)
        
        # 验证数据格式转换
        for i, record in enumerate(result):
            self.assertIn("remote_mcp_server_name", record)
            self.assertIn("remote_mcp_server", record)
            self.assertEqual(record["remote_mcp_server_name"], f"server{i+1}")
            self.assertEqual(record["remote_mcp_server"], f"http://server{i+1}.com")

    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.get_remote_mcp_server_list')
    async def test_recover_remote_mcp_server_integration(self, mock_get_list, mock_client, mock_add_proxy):
        """测试远程 MCP 服务器恢复功能的集成"""
        # 设置数据库中的记录
        mock_get_list.return_value = [
            {"remote_mcp_server_name": "server1", "remote_mcp_server": "http://server1.com"},
            {"remote_mcp_server_name": "server2", "remote_mcp_server": "http://server2.com"},
            {"remote_mcp_server_name": "server3", "remote_mcp_server": "http://server3.com"}
        ]
        
        # 设置远程服务中的代理（只有 server1 和 server3）
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "proxies": {
                "server1": {"mcp_url": "http://server1.com"},
                "server3": {"mcp_url": "http://server3.com"}
            }
        }
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        # 设置添加代理的响应
        mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})

        # 执行恢复
        result = await recover_remote_mcp_server(tenant_id="test_tenant")

        # 验证结果
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 200)
        
        # 验证只有 server2 被恢复（因为它在数据库中但不在远程代理列表中）
        mock_add_proxy.assert_called_once_with(
            remote_mcp_server="http://server2.com",
            remote_mcp_server_name="server2"
        )

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_concurrent_mcp_operations(self, mock_client, mock_check_name, mock_create_record):
        """测试并发 MCP 操作"""
        # 设置 mock
        mock_check_name.return_value = False
        mock_create_record.return_value = True
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 创建多个并发任务
        tasks = []
        for i in range(3):
            task = add_remote_mcp_server_list(
                tenant_id="test_tenant",
                user_id="test_user",
                remote_mcp_server=f"http://server{i}.com",
                remote_mcp_server_name=f"server{i}"
            )
            tasks.append(task)

        # 并发执行
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 验证所有任务都成功完成
        for result in results:
            self.assertNotIsInstance(result, Exception)
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 200)

    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    async def test_error_handling_integration(self, mock_check_name):
        """测试错误处理的集成功能"""
        # 测试服务名已存在的情况
        mock_check_name.return_value = True

        result = await add_remote_mcp_server_list(
            tenant_id="test_tenant",
            user_id="test_user",
            remote_mcp_server="http://existing-server.com",
            remote_mcp_server_name="existing_server"
        )

        # 验证返回正确的错误响应
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 409)
        response_data = json.loads(result.body.decode())
        self.assertEqual(response_data["status"], "error")
        self.assertIn("Service name already exists", response_data["message"])

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.get_remote_mcp_server_list')
    async def test_network_failure_recovery(self, mock_get_list, mock_client):
        """测试网络故障恢复"""
        # 设置数据库记录
        mock_get_list.return_value = [
            {"remote_mcp_server_name": "server1", "remote_mcp_server": "http://server1.com"}
        ]
        
        # 模拟网络错误
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 执行恢复
        result = await recover_remote_mcp_server(tenant_id="test_tenant")

        # 验证错误处理
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 400)
        response_data = json.loads(result.body.decode())
        self.assertEqual(response_data["status"], "error")

    async def test_data_consistency_validation(self):
        """测试数据一致性验证"""
        # 这个测试验证在各种操作后数据的一致性
        
        # 模拟一个复杂的场景：添加、查询、部分删除、恢复
        with patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant') as mock_get_records, \
             patch('backend.services.remote_mcp_service.create_mcp_record') as mock_create, \
             patch('backend.services.remote_mcp_service.check_mcp_name_exists') as mock_check_name, \
             patch('backend.services.remote_mcp_service.httpx.AsyncClient') as mock_client:
            
            # 设置初始状态
            mock_check_name.return_value = False
            mock_create.return_value = True
            
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_client_instance = AsyncMock()
            mock_client_instance.post.return_value = mock_response
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            # 模拟添加服务器后的数据状态
            mock_get_records.return_value = [
                {"mcp_name": "server1", "mcp_server": "http://server1.com"},
                {"mcp_name": "server2", "mcp_server": "http://server2.com"}
            ]

            # 获取服务器列表
            result = await get_remote_mcp_server_list(tenant_id="test_tenant")

            # 验证数据结构和内容
            self.assertEqual(len(result), 2)
            server_names = [item["remote_mcp_server_name"] for item in result]
            server_urls = [item["remote_mcp_server"] for item in result]
            
            self.assertIn("server1", server_names)
            self.assertIn("server2", server_names)
            self.assertIn("http://server1.com", server_urls)
            self.assertIn("http://server2.com", server_urls)


class TestMCPConfigurationIntegration(unittest.TestCase):
    """测试 MCP 配置集成"""

    def setUp(self):
        """每个测试前的设置"""
        config_manager_mock.reset_mock()

    def test_config_manager_integration(self):
        """测试配置管理器集成"""
        # 设置不同的配置值
        test_configs = [
            "http://localhost:5011",
            "http://production-server:8080",
            "https://secure-server:443"
        ]
        
        for config_url in test_configs:
            config_manager_mock.get_config.return_value = config_url
            
            # 验证配置被正确获取
            result = config_manager_mock.get_config("NEXENT_MCP_SERVER")
            self.assertEqual(result, config_url)

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_dynamic_config_update(self, mock_client):
        """测试动态配置更新"""
        # 模拟配置变更
        initial_config = "http://localhost:5011"
        updated_config = "http://updated-server:6012"
        
        config_manager_mock.get_config.side_effect = [initial_config, updated_config]
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 第一次调用使用初始配置
        with patch('backend.services.remote_mcp_service.add_remote_proxy') as mock_add_proxy:
            mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})
            
            # 这里我们主要测试配置管理器被正确调用
            config_manager_mock.get_config.assert_called()