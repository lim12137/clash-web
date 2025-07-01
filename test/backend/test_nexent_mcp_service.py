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
    """test healthcheck endpoint"""

    async def test_healthcheck_success(self):
        """test healthcheck success"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        mock_request.query_params = {"mcp_url": "http://test-server.com"}
        
        # create mock client instance
        mock_client_instance = AsyncMock()
        mock_client_instance.is_connected.return_value = True
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate, \
             patch('backend.nexent_mcp_service.Client') as mock_client_class:
            
            # set mock
            mock_validate.return_value = (True, {"mcp_url": "http://test-server.com"})
            mock_client_class.return_value = mock_client_instance
            
            # execute test
            result = await healthcheck(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            # check return json content
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "success")
            self.assertEqual(response_data["url"], "http://test-server.com")
            self.assertTrue(response_data["connected"])

    async def test_healthcheck_invalid_params(self):
        """test healthcheck invalid params"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        mock_request.query_params = {}
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate:
            # set mock return invalid params
            mock_error_response = JSONResponse(
                {"status": "error", "message": "Missing required parameter: mcp_url"},
                status_code=400
            )
            mock_validate.return_value = (False, mock_error_response)
            
            # execute test
            result = await healthcheck(mock_request)
            
            # assert
            self.assertEqual(result, mock_error_response)

    async def test_healthcheck_connection_error(self):
        """test healthcheck connection error"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        mock_request.query_params = {"mcp_url": "http://unreachable-server.com"}
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate, \
             patch('backend.nexent_mcp_service.Client') as mock_client_class:
            
            # set mock
            mock_validate.return_value = (True, {"mcp_url": "http://unreachable-server.com"})
            mock_client_class.side_effect = Exception("Connection failed")
            
            # execute test
            result = await healthcheck(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 500)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")


class TestListRemoteProxies(unittest.TestCase):
    """test list_remote_proxies endpoint"""

    async def test_list_remote_proxies_success(self):
        """test list remote proxies success"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        
        # mock proxy manager
        mock_proxies = {
            "server1": MagicMock(mcp_url="http://server1.com", transport="sse"),
            "server2": MagicMock(mcp_url="http://server2.com", transport="sse")
        }
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager:
            mock_manager.list_remote_proxies.return_value = mock_proxies
            
            # execute test
            result = await list_remote_proxies(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "success")
            self.assertIn("proxies", response_data)
            self.assertEqual(len(response_data["proxies"]), 2)
            self.assertEqual(response_data["proxies"]["server1"]["mcp_url"], "http://server1.com")

    async def test_list_remote_proxies_empty(self):
        """test list remote proxies empty"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager:
            mock_manager.list_remote_proxies.return_value = {}
            
            # execute test
            result = await list_remote_proxies(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "success")
            self.assertEqual(len(response_data["proxies"]), 0)


class TestAddRemoteProxy(unittest.TestCase):
    """test add_remote_proxy endpoint"""

    async def test_add_remote_proxy_success(self):
        """test add remote proxy success"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        mock_request.json = AsyncMock(return_value={
            "mcp_url": "http://test-server.com",
            "service_name": "test_server",
            "transport": "sse"
        })
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager, \
             patch('backend.nexent_mcp_service.RemoteMCPConfig') as mock_config:
            
            # set mock
            mock_config_instance = MagicMock()
            mock_config_instance.mcp_url = "http://test-server.com"
            mock_config_instance.service_name = "test_server"
            mock_config_instance.transport = "sse"
            mock_config.return_value = mock_config_instance
            mock_manager.add_remote_proxy.return_value = True
            
            # execute test
            result = await add_remote_proxy(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "success")
            mock_manager.add_remote_proxy.assert_called_once()

    async def test_add_remote_proxy_service_exists(self):
        """test add remote proxy service exists"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        mock_request.json = AsyncMock(return_value={
            "mcp_url": "http://test-server.com",
            "service_name": "existing_server",
            "transport": "sse"
        })
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager, \
             patch('backend.nexent_mcp_service.RemoteMCPConfig') as mock_config:
            
            # set mock throw ValueError
            mock_config_instance = MagicMock()
            mock_config.return_value = mock_config_instance
            mock_manager.add_remote_proxy.side_effect = ValueError("Service name already exists")
            
            # execute test
            result = await add_remote_proxy(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 409)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")

    async def test_add_remote_proxy_connection_error(self):
        """test add remote proxy connection error"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        mock_request.json = AsyncMock(return_value={
            "mcp_url": "http://unreachable-server.com",
            "service_name": "unreachable_server",
            "transport": "sse"
        })
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager, \
             patch('backend.nexent_mcp_service.RemoteMCPConfig') as mock_config:
            
            # set mock throw ConnectionError
            mock_config_instance = MagicMock()
            mock_config.return_value = mock_config_instance
            mock_manager.add_remote_proxy.side_effect = ConnectionError("Cannot connect to remote MCP server")
            
            # execute test
            result = await add_remote_proxy(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 503)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")

    async def test_add_remote_proxy_invalid_request(self):
        """test add remote proxy invalid request"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        mock_request.json = AsyncMock(return_value={
            "mcp_url": "invalid-url",
            "service_name": "",
            "transport": "invalid"
        })
        
        with patch('backend.nexent_mcp_service.RemoteMCPConfig') as mock_config:
            # set mock throw Exception
            mock_config.side_effect = Exception("Invalid request data")
            
            # execute test
            result = await add_remote_proxy(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 400)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")

    async def test_add_remote_proxy_failed(self):
        """test add remote proxy failed"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        mock_request.json = AsyncMock(return_value={
            "mcp_url": "http://test-server.com",
            "service_name": "test_server",
            "transport": "sse"
        })
        
        with patch('backend.nexent_mcp_service.proxy_manager') as mock_manager, \
             patch('backend.nexent_mcp_service.RemoteMCPConfig') as mock_config:
            
            # set mock
            mock_config_instance = MagicMock()
            mock_config.return_value = mock_config_instance
            mock_manager.add_remote_proxy.return_value = False
            
            # execute test
            result = await add_remote_proxy(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 500)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")


class TestRemoveRemoteProxy(unittest.TestCase):
    """test remove_remote_proxy endpoint"""

    async def test_remove_remote_proxy_success(self):
        """test remove remote proxy success"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate, \
             patch('backend.nexent_mcp_service.proxy_manager') as mock_manager:
            
            # set mock
            mock_validate.return_value = (True, {"service_name": "test_server"})
            mock_manager.remove_remote_proxy.return_value = True
            
            # execute test
            result = await remove_remote_proxy(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "success")
            mock_manager.remove_remote_proxy.assert_called_once_with("test_server")

    async def test_remove_remote_proxy_invalid_params(self):
        """test remove remote proxy invalid params"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate:
            # set mock return invalid params
            mock_error_response = JSONResponse(
                {"status": "error", "message": "Missing required parameter: service_name"},
                status_code=400
            )
            mock_validate.return_value = (False, mock_error_response)
            
            # execute test
            result = await remove_remote_proxy(mock_request)
            
            # assert
            self.assertEqual(result, mock_error_response)

    async def test_remove_remote_proxy_not_found(self):
        """test remove remote proxy not found"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate, \
             patch('backend.nexent_mcp_service.proxy_manager') as mock_manager:
            
            # set mock
            mock_validate.return_value = (True, {"service_name": "nonexistent_server"})
            mock_manager.remove_remote_proxy.return_value = False
            
            # execute test
            result = await remove_remote_proxy(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 404)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")

    async def test_remove_remote_proxy_exception(self):
        """test remove remote proxy exception"""
        # create mock request object
        mock_request = MagicMock(spec=Request)
        
        with patch('backend.nexent_mcp_service.validate_url_params') as mock_validate, \
             patch('backend.nexent_mcp_service.proxy_manager') as mock_manager:
            
            # set mock
            mock_validate.return_value = (True, {"service_name": "test_server"})
            mock_manager.remove_remote_proxy.side_effect = Exception("Database error")
            
            # execute test
            result = await remove_remote_proxy(mock_request)
            
            # assert
            self.assertIsInstance(result, JSONResponse)
            self.assertEqual(result.status_code, 500)
            response_data = json.loads(result.body.decode())
            self.assertEqual(response_data["status"], "error")

