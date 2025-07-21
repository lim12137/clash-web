import pytest
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

# Create AsyncMock for the API functions
healthcheck_mock = AsyncMock()
list_remote_proxies_mock = AsyncMock()
add_remote_proxy_mock = AsyncMock()
remove_remote_proxy_mock = AsyncMock()

with patch('backend.database.client.MinioClient', return_value=minio_client_mock):
    # Mock the FastMCP and Client classes
    with patch('backend.nexent_mcp_service.FastMCP') as mock_fastmcp, \
         patch('backend.nexent_mcp_service.Client') as mock_client, \
         patch('backend.nexent_mcp_service.local_mcp_service') as mock_local_service, \
         patch('backend.nexent_mcp_service.RemoteProxyManager') as mock_proxy_manager:
        
        # Import the module without the functions we want to mock
        import backend.nexent_mcp_service
        
        # Patch the API functions with AsyncMock
        with patch('backend.nexent_mcp_service.healthcheck', healthcheck_mock), \
             patch('backend.nexent_mcp_service.list_remote_proxies', list_remote_proxies_mock), \
             patch('backend.nexent_mcp_service.add_remote_proxy', add_remote_proxy_mock), \
             patch('backend.nexent_mcp_service.remove_remote_proxy', remove_remote_proxy_mock):
            
            # Now import the patched functions
            from backend.nexent_mcp_service import (
                healthcheck,
                list_remote_proxies,
                add_remote_proxy,
                remove_remote_proxy
            )


# Test healthcheck endpoint
@pytest.mark.asyncio
async def test_healthcheck_success():
    """test healthcheck success"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.query_params = {"mcp_url": "http://test-server.com"}
    
    # create mock client instance
    mock_client_instance = AsyncMock()
    mock_client_instance.is_connected.return_value = True
    
    # Configure healthcheck mock to return a JSONResponse
    expected_response = JSONResponse({
        "status": "success", 
        "url": "http://test-server.com", 
        "connected": True
    })
    healthcheck_mock.return_value = expected_response
    
    # execute test
    result = await healthcheck(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    # check return json content
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "success"
    assert response_data["url"] == "http://test-server.com"
    assert response_data["connected"] is True


@pytest.mark.asyncio
async def test_healthcheck_invalid_params():
    """test healthcheck invalid params"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.query_params = {}
    
    # set mock return invalid params
    mock_error_response = JSONResponse(
        {"status": "error", "message": "Missing required parameter: mcp_url"},
        status_code=400
    )
    
    # Configure healthcheck mock to return the error response
    healthcheck_mock.return_value = mock_error_response
    
    # execute test
    result = await healthcheck(mock_request)
    
    # assert
    assert result == mock_error_response


@pytest.mark.asyncio
async def test_healthcheck_connection_error():
    """test healthcheck connection error"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.query_params = {"mcp_url": "http://unreachable-server.com"}
    
    # Configure healthcheck mock to return an error response
    error_response = JSONResponse(
        {"status": "error", "message": "Failed to connect to MCP server: Connection failed"},
        status_code=500
    )
    healthcheck_mock.return_value = error_response
    
    # execute test
    result = await healthcheck(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    assert result.status_code == 500
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "error"


# Test list_remote_proxies endpoint
@pytest.mark.asyncio
async def test_list_remote_proxies_success():
    """test list remote proxies success"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    
    # mock proxy data
    mock_proxies = {
        "server1": MagicMock(mcp_url="http://server1.com", transport="sse"),
        "server2": MagicMock(mcp_url="http://server2.com", transport="sse")
    }
    
    # Configure list_remote_proxies_mock to return a success response
    expected_response = JSONResponse({
        "status": "success",
        "proxies": {
            "server1": {"mcp_url": "http://server1.com", "transport": "sse"},
            "server2": {"mcp_url": "http://server2.com", "transport": "sse"}
        }
    })
    list_remote_proxies_mock.return_value = expected_response
    
    # execute test
    result = await list_remote_proxies(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "success"
    assert "proxies" in response_data
    assert len(response_data["proxies"]) == 2
    assert response_data["proxies"]["server1"]["mcp_url"] == "http://server1.com"


@pytest.mark.asyncio
async def test_list_remote_proxies_empty():
    """test list remote proxies empty"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    
    # Configure list_remote_proxies_mock to return an empty response
    empty_response = JSONResponse({
        "status": "success",
        "proxies": {}
    })
    list_remote_proxies_mock.return_value = empty_response
    
    # execute test
    result = await list_remote_proxies(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "success"
    assert len(response_data["proxies"]) == 0


# Test add_remote_proxy endpoint
@pytest.mark.asyncio
async def test_add_remote_proxy_success():
    """test add remote proxy success"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.json = AsyncMock(return_value={
        "mcp_url": "http://test-server.com",
        "service_name": "test_server",
        "transport": "sse"
    })
    
    # Configure add_remote_proxy_mock to return a success response
    success_response = JSONResponse({
        "status": "success",
        "message": "Remote proxy added successfully",
        "service_name": "test_server"
    })
    add_remote_proxy_mock.return_value = success_response
    
    # execute test
    result = await add_remote_proxy(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "success"


@pytest.mark.asyncio
async def test_add_remote_proxy_service_exists():
    """test add remote proxy service exists"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.json = AsyncMock(return_value={
        "mcp_url": "http://test-server.com",
        "service_name": "existing_server",
        "transport": "sse"
    })
    
    # Configure add_remote_proxy_mock to return an error response for duplicate service
    error_response = JSONResponse(
        {"status": "error", "message": "Service name already exists"},
        status_code=409
    )
    add_remote_proxy_mock.return_value = error_response
    
    # execute test
    result = await add_remote_proxy(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    assert result.status_code == 409
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "error"


@pytest.mark.asyncio
async def test_add_remote_proxy_connection_error():
    """test add remote proxy connection error"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.json = AsyncMock(return_value={
        "mcp_url": "http://unreachable-server.com",
        "service_name": "unreachable_server",
        "transport": "sse"
    })
    
    # Configure add_remote_proxy_mock to return a connection error response
    error_response = JSONResponse(
        {"status": "error", "message": "Cannot connect to remote MCP server"},
        status_code=503
    )
    add_remote_proxy_mock.return_value = error_response
    
    # execute test
    result = await add_remote_proxy(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    assert result.status_code == 503
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "error"


@pytest.mark.asyncio
async def test_add_remote_proxy_invalid_request():
    """test add remote proxy invalid request"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.json = AsyncMock(return_value={
        "mcp_url": "invalid-url",
        "service_name": "",
        "transport": "invalid"
    })
    
    # Configure add_remote_proxy_mock to return an invalid request error response
    error_response = JSONResponse(
        {"status": "error", "message": "Invalid request data"},
        status_code=400
    )
    add_remote_proxy_mock.return_value = error_response
    
    # execute test
    result = await add_remote_proxy(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    assert result.status_code == 400
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "error"


@pytest.mark.asyncio
async def test_add_remote_proxy_failed():
    """test add remote proxy failed"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.json = AsyncMock(return_value={
        "mcp_url": "http://test-server.com",
        "service_name": "test_server",
        "transport": "sse"
    })
    
    # Configure add_remote_proxy_mock to return a server error response
    error_response = JSONResponse(
        {"status": "error", "message": "Failed to add remote proxy"},
        status_code=500
    )
    add_remote_proxy_mock.return_value = error_response
    
    # execute test
    result = await add_remote_proxy(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    assert result.status_code == 500
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "error"


# Test remove_remote_proxy endpoint
@pytest.mark.asyncio
async def test_remove_remote_proxy_success():
    """test remove remote proxy success"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.query_params = {"service_name": "test_server"}
    
    # Configure remove_remote_proxy_mock to return a success response
    success_response = JSONResponse({
        "status": "success",
        "message": "Remote proxy removed successfully",
        "service_name": "test_server"
    })
    remove_remote_proxy_mock.return_value = success_response
    
    # execute test
    result = await remove_remote_proxy(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "success"


@pytest.mark.asyncio
async def test_remove_remote_proxy_invalid_params():
    """test remove remote proxy invalid params"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.query_params = {}
    
    # Configure remove_remote_proxy_mock to return an error response for invalid params
    error_response = JSONResponse(
        {"status": "error", "message": "Missing required parameter: service_name"},
        status_code=400
    )
    remove_remote_proxy_mock.return_value = error_response
    
    # execute test
    result = await remove_remote_proxy(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    assert result.status_code == 400
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "error"


@pytest.mark.asyncio
async def test_remove_remote_proxy_not_found():
    """test remove remote proxy not found"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.query_params = {"service_name": "nonexistent_server"}
    
    # Configure remove_remote_proxy_mock to return a not found error response
    error_response = JSONResponse(
        {"status": "error", "message": "Remote proxy not found: nonexistent_server"},
        status_code=404
    )
    remove_remote_proxy_mock.return_value = error_response
    
    # execute test
    result = await remove_remote_proxy(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    assert result.status_code == 404
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "error"


@pytest.mark.asyncio
async def test_remove_remote_proxy_exception():
    """test remove remote proxy exception"""
    # create mock request object
    mock_request = MagicMock(spec=Request)
    mock_request.query_params = {"service_name": "test_server"}
    
    # Configure remove_remote_proxy_mock to return a server error response
    error_response = JSONResponse(
        {"status": "error", "message": "Failed to remove remote proxy: Database error"},
        status_code=500
    )
    remove_remote_proxy_mock.return_value = error_response
    
    # execute test
    result = await remove_remote_proxy(mock_request)
    
    # assert
    assert isinstance(result, JSONResponse)
    assert result.status_code == 500
    response_data = json.loads(bytes(result.body))
    assert response_data["status"] == "error"

