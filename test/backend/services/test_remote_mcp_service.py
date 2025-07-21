import asyncio
import pytest
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


# Setup fixture for tests that need config
@pytest.fixture
def setup_config():
    config_manager_mock.get_config.return_value = "http://localhost:5011"


class TestAddRemoteProxy:
    """test add_remote_proxy function"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """set up"""
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @pytest.mark.asyncio
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
        assert isinstance(result, JSONResponse)
        assert result.status_code == 200
        mock_client_instance.post.assert_called_once()

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @pytest.mark.asyncio
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
        assert result.status_code == 409

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @pytest.mark.asyncio
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
        assert result.status_code == 503

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @pytest.mark.asyncio
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
        assert result.status_code == 400


class TestAddRemoteMcpServerList:
    """test add_remote_mcp_server_list function"""

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.add_remote_proxy')  
    @patch('backend.services.remote_mcp_service.get_all_mount_mcp_service')
    @pytest.mark.asyncio
    async def test_add_remote_mcp_server_list_success(self, mock_get_all_mount, mock_add_proxy, mock_check_name, mock_create_record):
        """test add remote mcp server list success"""
        # set mock
        mock_check_name.return_value = False
        mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})
        mock_create_record.return_value = True
        mock_get_all_mount.return_value = ["existing_server"]

        # execute test
        result = await add_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # assert
        assert isinstance(result, JSONResponse)
        assert result.status_code == 200
        mock_check_name.assert_called_once_with(mcp_name="test_server")
        mock_add_proxy.assert_called_once()
        mock_create_record.assert_called_once()

    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @pytest.mark.asyncio
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
        assert isinstance(result, JSONResponse)
        assert result.status_code == 409

    @patch('backend.services.remote_mcp_service.create_mcp_record')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    @patch('backend.services.remote_mcp_service.get_all_mount_mcp_service')
    @pytest.mark.asyncio
    async def test_add_remote_mcp_server_list_database_error(self, mock_get_all_mount, mock_add_proxy, mock_check_name, mock_create_record):
        """test add remote mcp server list database error"""
        # set mock
        mock_check_name.return_value = False
        mock_add_proxy.return_value = JSONResponse(status_code=200, content={"message": "Success"})
        mock_create_record.return_value = False
        mock_get_all_mount.return_value = ["existing_server"]

        # execute test
        result = await add_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="test_server"
        )

        # assert
        assert result is False


class TestDeleteRemoteMcpServerList:
    """test delete_remote_mcp_server_list function"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """set up"""
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @pytest.mark.asyncio
    async def test_delete_remote_mcp_server_list_success(self, mock_check_name_exists, mock_delete_record, mock_client):
        """test delete remote mcp server list success"""
        # set mock
        mock_check_name_exists.return_value = True
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
        assert isinstance(result, JSONResponse)
        assert result.status_code == 200
        mock_delete_record.assert_called_once()
        mock_client_instance.delete.assert_called_once()

    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @patch('backend.services.remote_mcp_service.JSONResponse')
    @pytest.mark.asyncio
    async def test_delete_remote_mcp_server_list_record_not_found(self, mock_json_response, mock_check_name_exists, mock_delete_record):
        """test delete remote mcp server list record not found"""
        # set mock
        mock_check_name_exists.return_value = False
        mock_delete_record.return_value = False
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_json_response.return_value = mock_response

        # execute test
        result = await delete_remote_mcp_server_list(
            tenant_id="tenant_1",
            user_id="user_1",
            remote_mcp_server="http://test-server.com",
            remote_mcp_server_name="nonexistent_server"
        )

        # assert
        assert result.status_code == 400
        # Verify that JSONResponse was called with the expected status code
        mock_json_response.assert_called_with(
            status_code=409,
            content={"message": "Service name not exists", "status": "error"}
        )

    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.delete_mcp_record_by_name_and_url')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @pytest.mark.asyncio
    async def test_delete_remote_mcp_server_list_proxy_not_found(self, mock_check_name_exists, mock_delete_record, mock_client):
        """test delete remote mcp server list proxy not found"""
        # set mock
        mock_check_name_exists.return_value = True
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
        assert result.status_code == 200


class TestGetRemoteMcpServerList:
    """test get_remote_mcp_server_list function"""

    @patch('backend.services.remote_mcp_service.get_all_mount_mcp_service')
    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    @pytest.mark.asyncio
    async def test_get_remote_mcp_server_list_success(self, mock_get_records, mock_get_mount_services):
        """test get remote mcp server list success"""
        # set mock
        mock_records = [
            {"mcp_name": "server1", "mcp_server": "http://server1.com"},
            {"mcp_name": "server2", "mcp_server": "http://server2.com"},
            {"mcp_name": "server3", "mcp_server": "http://server3.com"}
        ]
        mock_get_records.return_value = mock_records
        # mock mount services - only server1 and server3 are mounted (online)
        mock_get_mount_services.return_value = ["server1", "server3"]

        # execute test
        result = await get_remote_mcp_server_list(tenant_id="tenant_1")

        # assert
        assert len(result) == 3
        
        # verify server1 (online)
        assert result[0]["remote_mcp_server_name"] == "server1"
        assert result[0]["remote_mcp_server"] == "http://server1.com"
        assert result[0]["status"] is True
        
        # verify server2 (offline)
        assert result[1]["remote_mcp_server_name"] == "server2"
        assert result[1]["remote_mcp_server"] == "http://server2.com"
        assert result[1]["status"] is False
        
        # verify server3 (online)
        assert result[2]["remote_mcp_server_name"] == "server3"
        assert result[2]["remote_mcp_server"] == "http://server3.com"
        assert result[2]["status"] is True
        
        mock_get_records.assert_called_once_with(tenant_id="tenant_1")
        mock_get_mount_services.assert_called_once()

    @patch('backend.services.remote_mcp_service.get_all_mount_mcp_service')
    @patch('backend.services.remote_mcp_service.get_mcp_records_by_tenant')
    @pytest.mark.asyncio
    async def test_get_remote_mcp_server_list_empty(self, mock_get_records, mock_get_mount_services):
        """test get remote mcp server list empty"""
        # set mock
        mock_get_records.return_value = []
        mock_get_mount_services.return_value = []

        # execute test
        result = await get_remote_mcp_server_list(tenant_id="tenant_1")

        # assert
        assert len(result) == 0
        mock_get_records.assert_called_once_with(tenant_id="tenant_1")
        mock_get_mount_services.assert_called_once()


class TestRecoverRemoteMcpServer:
    """test recover_remote_mcp_server function"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """set up"""
        config_manager_mock.get_config.return_value = "http://localhost:5011"

    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.get_remote_mcp_server_list')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists') 
    @pytest.mark.asyncio
    async def test_recover_remote_mcp_server_success(self, mock_check_name_exists, mock_get_list, mock_client, mock_add_proxy):
        """test recover remote mcp server success"""
        # set mock
        mock_check_name_exists.return_value = True
        mock_get_list.return_value = [
            {"remote_mcp_server_name": "server1", "remote_mcp_server": "http://server1.com", "status": True},
            {"remote_mcp_server_name": "server2", "remote_mcp_server": "http://server2.com", "status": False}
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
        assert isinstance(result, JSONResponse)
        assert result.status_code == 200
        # server2 should be recovered because it is in the record but not in the remote proxy list
        mock_add_proxy.assert_called_once()

    @patch('backend.services.remote_mcp_service.add_remote_proxy')
    @patch('backend.services.remote_mcp_service.httpx.AsyncClient')
    @patch('backend.services.remote_mcp_service.get_remote_mcp_server_list')
    @patch('backend.services.remote_mcp_service.check_mcp_name_exists')
    @pytest.mark.asyncio
    async def test_recover_remote_mcp_server_list_error(self, mock_check_name_exists, mock_get_list, mock_client, mock_add_proxy):
        """test recover remote mcp server list error - tests a case where recovery fails"""
        # set mocks
        mock_check_name_exists.return_value = True
        
        # Return a server with status=False that needs recovery
        mock_get_list.return_value = [
            {"remote_mcp_server_name": "offline_server", "remote_mcp_server": "http://offline-server.com", "status": False}
        ]
        
        # Mock the MCP service response
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        # Mock add_remote_proxy to return an error
        error_response = JSONResponse(status_code=400, content={"message": "Failed to recover", "status": "error"})
        mock_add_proxy.return_value = error_response

        # execute test
        result = await recover_remote_mcp_server(tenant_id="tenant_1")

        # assert
        assert result.status_code == 400
        mock_add_proxy.assert_called_once()
