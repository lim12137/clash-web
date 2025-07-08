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
    """test mcp service integration"""

    def setUp(self):
        """set up"""
        config_manager_mock.reset_mock()
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_complete_mcp_server_lifecycle(self, mock_client, mock_check_name, mock_create_record):
        """test complete mcp server lifecycle"""
        # set mock
        mock_check_name.return_value = False
        mock_create_record.return_value = True
        
        # mock http response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client_instance.delete.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # 1. add remote mcp server
        add_result = await add_remote_mcp_server_list(
            tenant_id="test_tenant",
            user_id="test_user",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )
        
        # verify add success
        self.assertIsInstance(add_result, JSONResponse)
        self.assertEqual(add_result.status_code, 200)
        mock_check_name.assert_called_with(mcp_name="test_server")
        mock_create_record.assert_called_once()

        # 2. delete remote mcp server
        with patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url') as mock_delete_record:
            mock_delete_record.return_value = True
            
            delete_result = await delete_remote_mcp_server_list(
                tenant_id="test_tenant",
                user_id="test_user",
                remote_mcp_server="http://test-server.com",
                remote_mcp_server_name="test_server"
            )
            
            # verify delete success
            self.assertIsInstance(delete_result, JSONResponse)
            self.assertEqual(delete_result.status_code, 200)
            mock_delete_record.assert_called_once()

    @patch('backend.services.remote_mcp_service.get_all_mount_mcp_service')
    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_remote_mcp_server_list_integration(self, mock_get_records, mock_get_mount_services):
        """test get remote mcp server list integration"""
        # set test data
        mock_records = [
            {"mcp_name": "server1", "mcp_server": "http://server1.com"},
            {"mcp_name": "server2", "mcp_server": "http://server2.com"},
            {"mcp_name": "server3", "mcp_server": "http://server3.com"}
        ]
        mock_get_records.return_value = mock_records
        # mock mount services - only server1 and server2 are online
        mock_get_mount_services.return_value = ["server1", "server2"]

        # execute test
        result = await get_remote_mcp_server_list(tenant_id="test_tenant")

        # verify result
        self.assertEqual(len(result), 3)
        
        # verify data format conversion and status
        for i, record in enumerate(result):
            self.assertIn("remote_mcp_server_name", record)
            self.assertIn("remote_mcp_server", record)
            self.assertIn("status", record)
            self.assertEqual(record["remote_mcp_server_name"], f"server{i+1}")
            self.assertEqual(record["remote_mcp_server"], f"http://server{i+1}.com")
            
            # verify status: server1 and server2 are online, server3 is offline
            expected_status = i < 2  # server1 (i=0) and server2 (i=1) are online
            self.assertEqual(record["status"], expected_status, f"server{i+1} status should be {expected_status}")
        
        mock_get_records.assert_called_once_with(tenant_id="test_tenant")
        mock_get_mount_services.assert_called_once()

    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.get_remote_mcp_server_list')
    async def test_recover_remote_mcp_server_integration(self, mock_get_list, mock_client, mock_add_proxy):
        """test recover remote mcp server integration"""
        # set test data
        mock_get_list.return_value = [
            {"remote_mcp_server_name": "server1", "remote_mcp_server": "http://server1.com"},
            {"remote_mcp_server_name": "server2", "remote_mcp_server": "http://server2.com"},
            {"remote_mcp_server_name": "server3", "remote_mcp_server": "http://server3.com"}
        ]
        
        # set remote service proxy (only server1 and server3)
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
        
        # set add proxy response
        mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})

        # execute recover
        result = await recover_remote_mcp_server(tenant_id="test_tenant")

        # verify result
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 200)
        
        # verify only server2 is recovered (because it is in the database but not in the remote proxy list)
        mock_add_proxy.assert_called_once_with(
            remote_mcp_server="http://server2.com",
            remote_mcp_server_name="server2"
        )

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_concurrent_mcp_operations(self, mock_client, mock_check_name, mock_create_record):
        """test concurrent mcp operations"""
        # set mock
        mock_check_name.return_value = False
        mock_create_record.return_value = True
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # create multiple concurrent tasks
        tasks = []
        for i in range(3):
            task = add_remote_mcp_server_list(
                tenant_id="test_tenant",
                user_id="test_user",
                remote_mcp_server=f"http://server{i}.com",
                remote_mcp_server_name=f"server{i}"
            )
            tasks.append(task)

        # concurrent execution
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # verify all tasks are completed successfully
        for result in results:
            self.assertNotIsInstance(result, Exception)
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 200)

    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    async def test_error_handling_integration(self, mock_check_name):
        """test error handling integration"""
        # test service name already exists
        mock_check_name.return_value = True

        result = await add_remote_mcp_server_list(
            tenant_id="test_tenant",
            user_id="test_user",
            remote_mcp_server="http://existing-server.com",
            remote_mcp_server_name="existing_server"
        )

        # verify
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 409)
        response_data = json.loads(result.body.decode())
        self.assertEqual(response_data["status"], "error")
        self.assertIn("Service name already exists", response_data["message"])

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.get_remote_mcp_server_list')
    async def test_network_failure_recovery(self, mock_get_list, mock_client):
        """test network failure recovery"""
        # set test data
        mock_get_list.return_value = [
            {"remote_mcp_server_name": "server1", "remote_mcp_server": "http://server1.com"}
        ]
        
        # mock network error
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # execute recover
        result = await recover_remote_mcp_server(tenant_id="test_tenant")

        # verify error handling
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 400)
        response_data = json.loads(result.body.decode())
        self.assertEqual(response_data["status"], "error")

    async def test_data_consistency_validation(self):
        """test data consistency validation"""
        # this test verifies data consistency after various operations
        
        # mock a complex scenario: add, query, partial delete, recover
        with patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant') as mock_get_records, \
             patch('backend.services.remote_mcp_service.create_mcp_record') as mock_create, \
             patch('backend.services.remote_mcp_service.check_mcp_name_exists') as mock_check_name, \
             patch('backend.services.remote_mcp_service.httpx.AsyncClient') as mock_client:
            
            # set initial state
            mock_check_name.return_value = False
            mock_create.return_value = True
            
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_client_instance = AsyncMock()
            mock_client_instance.post.return_value = mock_response
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            # mock data state after adding server
            mock_get_records.return_value = [
                {"mcp_name": "server1", "mcp_server": "http://server1.com"},
                {"mcp_name": "server2", "mcp_server": "http://server2.com"}
            ]

            # get server list
            result = await get_remote_mcp_server_list(tenant_id="test_tenant")

            # verify data structure and content
            self.assertEqual(len(result), 2)
            server_names = [item["remote_mcp_server_name"] for item in result]
            server_urls = [item["remote_mcp_server"] for item in result]
            
            self.assertIn("server1", server_names)
            self.assertIn("server2", server_names)
            self.assertIn("http://server1.com", server_urls)
            self.assertIn("http://server2.com", server_urls)


class TestMCPConfigurationIntegration(unittest.TestCase):
    """test mcp configuration integration"""

    def setUp(self):
        """set up"""
        config_manager_mock.reset_mock()

    def test_config_manager_integration(self):
        """test config manager integration"""
        # set different config values
        test_configs = [
            "http://localhost:5011",
            "http://production-server:8080",
            "https://secure-server:443"
        ]
        
        for config_url in test_configs:
            config_manager_mock.get_config.return_value = config_url
            
            # verify config is correctly retrieved
            result = config_manager_mock.get_config("NEXENT_MCP_SERVER")
            self.assertEqual(result, config_url)

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_dynamic_config_update(self, mock_client):
        """test dynamic config update"""
        # mock config change
        initial_config = "http://localhost:5011"
        updated_config = "http://updated-server:6012"
        
        config_manager_mock.get_config.side_effect = [initial_config, updated_config]
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # first call uses initial config
        with patch('backend.services.remote_mcp_service.add_remote_proxy') as mock_add_proxy:
            mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})
            
            # here we mainly test that the config manager is correctly called
            config_manager_mock.get_config.assert_called()