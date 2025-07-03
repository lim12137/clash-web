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
    """test add_remote_proxy function"""

    def setUp(self):
        """set up"""
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_add_remote_proxy_success(self, mock_client):
        """test add remote proxy success"""
        # set mock
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # execute test
        result = await add_remote_proxy(
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # assert
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 200)
        mock_client_instance.post.assert_called_once()

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_add_remote_proxy_name_exists(self, mock_client):
        """test add remote proxy name exists"""
        # set mock
        mock_response = MagicMock()
        mock_response.status_code = 409
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # execute test
        result = await add_remote_proxy(
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="existing_server"
        )

        # assert
        self.assertEqual(result.status_code, 409)

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_add_remote_proxy_connection_error(self, mock_client):
        """test add remote proxy connection error"""
        # set mock
        mock_response = MagicMock()
        mock_response.status_code = 503
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # execute test
        result = await add_remote_proxy(
            remote_mcp_server="http://unreachable-server.com",
            remote_mcp_server_name="unreachable_server"
        )

        # assert
        self.assertEqual(result.status_code, 503)

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    async def test_add_remote_proxy_exception(self, mock_client):
        """test add remote proxy exception"""
        # set mock throw exception
        mock_client.side_effect = Exception("Connection timeout")

        # execute test
        result = await add_remote_proxy(
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # assert
        self.assertEqual(result.status_code, 400)


class TestAddRemoteMcpServerList(unittest.TestCase):
    """test add_remote_mcp_server_list function"""

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    async def test_add_remote_mcp_server_list_success(self, mock_add_proxy, mock_check_name, mock_create_record):
        """test add remote mcp server list success"""
        # set mock
        mock_check_name.return_value = False
        mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})
        mock_create_record.return_value = True

        # execute test
        result = await add_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # assert
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 200)
        mock_check_name.assert_called_once_with(mcp_name="test_server")
        mock_add_proxy.assert_called_once()
        mock_create_record.assert_called_once()

    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    async def test_add_remote_mcp_server_list_name_exists(self, mock_check_name):
        """test add remote mcp server list name exists"""
        # set mock
        mock_check_name.return_value = True

        # execute test
        result = await add_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="existing_server"
        )

        # assert
        self.assertEqual(result.status_code, 409)

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    async def test_add_remote_mcp_server_list_database_error(self, mock_add_proxy, mock_check_name, mock_create_record):
        """test add remote mcp server list database error"""
        # set mock
        mock_check_name.return_value = False
        mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})
        mock_create_record.return_value = False

        # execute test
        result = await add_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # assert
        self.assertFalse(result)


class TestDeleteRemoteMcpServerList(unittest.TestCase):
    """test delete_remote_mcp_server_list function"""

    def setUp(self):
        """set up"""
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    async def test_delete_remote_mcp_server_list_success(self, mock_delete_record, mock_client):
        """test delete remote mcp server list success"""
        # set mock
        mock_delete_record.return_value = True
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client_instance = AsyncMock()
        mock_client_instance.delete.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # execute test
        result = await delete_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # assert
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 200)
        mock_delete_record.assert_called_once()
        mock_client_instance.delete.assert_called_once()

    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    async def test_delete_remote_mcp_server_list_record_not_found(self, mock_delete_record):
        """test delete remote mcp server list record not found"""
        # set mock
        mock_delete_record.return_value = False

        # execute test
        result = await delete_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="nonexistent_server"
        )

        # assert
        self.assertEqual(result.status_code, 400)

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    async def test_delete_remote_mcp_server_list_proxy_not_found(self, mock_delete_record, mock_client):
        """test delete remote mcp server list proxy not found"""
        # set mock
        mock_delete_record.return_value = True
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_client_instance = AsyncMock()
        mock_client_instance.delete.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # execute test
        result = await delete_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # assert
        self.assertEqual(result.status_code, 400)


class TestGetRemoteMcpServerList(unittest.TestCase):
    """test get_remote_mcp_server_list function"""

    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_remote_mcp_server_list_success(self, mock_get_records):
        """test get remote mcp server list success"""
        # set mock
        mock_records = [
            {"mcp_name": "server1", "mcp_server": "http://server1.com"},
            {"mcp_name": "server2", "mcp_server": "http://server2.com"}
        ]
        mock_get_records.return_value = mock_records

        # execute test
        result = await get_remote_mcp_server_list(tenant_id="tenant_1")

        # assert
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["remote_mcp_server_name"], "server1")
        self.assertEqual(result[0]["remote_mcp_server"], "http://server1.com")
        mock_get_records.assert_called_once_with(tenant_id="tenant_1")

    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    async def test_get_remote_mcp_server_list_empty(self, mock_get_records):
        """test get remote mcp server list empty"""
        # set mock
        mock_get_records.return_value = []

        # execute test
        result = await get_remote_mcp_server_list(tenant_id="tenant_1")

        # assert
        self.assertEqual(len(result), 0)


class TestRecoverRemoteMcpServer(unittest.TestCase):
    """test recover_remote_mcp_server function"""

    def setUp(self):
        """set up"""
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.get_remote_mcp_server_list')
    async def test_recover_remote_mcp_server_success(self, mock_get_list, mock_client, mock_add_proxy):
        """test recover remote mcp server success"""
        # set mock
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

        # execute test
        result = await recover_remote_mcp_server(tenant_id="tenant_1")

        # assert
        self.assertIsInstance(result, JSONResponse)
        self.assertEqual(result.status_code, 200)
        # server2 should be recovered because it is in the record but not in the remote proxy list
        mock_add_proxy.assert_called_once()

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.get_remote_mcp_server_list')
    async def test_recover_remote_mcp_server_list_error(self, mock_get_list, mock_client):
        """test recover remote mcp server list error"""
        # set mock
        mock_get_list.return_value = []
        
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # execute test
        result = await recover_remote_mcp_server(tenant_id="tenant_1")

        # assert
        self.assertEqual(result.status_code, 400)
