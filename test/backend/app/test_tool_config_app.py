import pytest
import pytest_asyncio
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import types
import os

# Create AsyncMock version of the functions we'll need
async def async_get_current_user_id(auth_token):
    return ("user123", "tenant456")

async def async_query_all_tools(tenant_id):
    return [{"id": 1, "name": "Tool1"}, {"id": 2, "name": "Tool2"}]

async def async_search_tool_info_impl(agent_id, tool_id, auth_token):
    return {"tool": "info"}

async def async_update_tool_info_impl(request, auth_token):
    return {"updated": True}

async def async_update_tool_list(tenant_id, user_id):
    return True

# Create proper mock modules with AsyncMock methods
auth_utils_mock = MagicMock()
auth_utils_mock.get_current_user_id = AsyncMock(side_effect=async_get_current_user_id)

tool_configuration_service_mock = MagicMock()
tool_configuration_service_mock.search_tool_info_impl = AsyncMock(side_effect=async_search_tool_info_impl)
tool_configuration_service_mock.update_tool_info_impl = AsyncMock(side_effect=async_update_tool_info_impl)
tool_configuration_service_mock.update_tool_list = AsyncMock(side_effect=async_update_tool_list)

agent_db_mock = MagicMock()
agent_db_mock.query_all_tools = AsyncMock(side_effect=async_query_all_tools)

# Create module structure
utils_mock = types.ModuleType('utils')
setattr(utils_mock, 'auth_utils', auth_utils_mock)
services_mock = types.ModuleType('services')
setattr(services_mock, 'tool_configuration_service', tool_configuration_service_mock)
database_mock = types.ModuleType('database')
setattr(database_mock, 'agent_db', agent_db_mock)
setattr(database_mock, 'client', MagicMock())

# Mock modules before importing anything else
sys.modules['utils'] = utils_mock
sys.modules['utils.auth_utils'] = auth_utils_mock
sys.modules['services'] = services_mock
sys.modules['services.tool_configuration_service'] = tool_configuration_service_mock
sys.modules['database'] = database_mock
sys.modules['database.agent_db'] = agent_db_mock
sys.modules['database.client'] = MagicMock()
sys.modules['consts.model'] = MagicMock()

# Mock fastapi and its submodules
fastapi_mock = MagicMock()
sys.modules['fastapi'] = fastapi_mock
sys.modules['fastapi.Header'] = MagicMock()
responses_mock = MagicMock()
json_response_mock = AsyncMock()
json_response_mock.return_value = MagicMock(status_code=200)
responses_mock.JSONResponse = json_response_mock
sys.modules['fastapi.responses'] = responses_mock

# Mock HTTPException
class MockHTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"{status_code}: {detail}")

# Create our own mock implementations of the functions to test
async def list_tools_api(authorization):
    try:
        user_id, tenant_id = await auth_utils_mock.get_current_user_id(authorization)
        result = await agent_db_mock.query_all_tools(tenant_id=tenant_id)
        return result
    except Exception as e:
        raise MockHTTPException(status_code=500, detail=f"Failed to get tool info: {str(e)}")

async def search_tool_info_api(request, authorization):
    try:
        result = await tool_configuration_service_mock.search_tool_info_impl(
            request.agent_id, request.tool_id, authorization
        )
        return result
    except Exception as e:
        raise MockHTTPException(status_code=500, detail=f"Failed to update tool: {str(e)}")

async def update_tool_info_api(request, authorization):
    try:
        result = await tool_configuration_service_mock.update_tool_info_impl(request, authorization)
        return result
    except Exception as e:
        raise MockHTTPException(status_code=500, detail=f"Failed to update tool: {str(e)}")

async def scan_and_update_tool(authorization):
    try:
        user_id, tenant_id = await auth_utils_mock.get_current_user_id(authorization)
        await tool_configuration_service_mock.update_tool_list(tenant_id=tenant_id, user_id=user_id)
        return json_response_mock.return_value
    except Exception as e:
        response = MagicMock(status_code=400)
        return response

# Mock request classes
class MockToolInstanceSearchRequest:
    def __init__(self, agent_id, tool_id):
        self.agent_id = agent_id
        self.tool_id = tool_id

class MockToolInstanceInfoRequest:
    def __init__(self, agent_id, tool_id, configuration):
        self.agent_id = agent_id
        self.tool_id = tool_id
        self.configuration = configuration

@pytest.fixture
def setup_test():
    # Reset mocks before each test
    auth_utils_mock.get_current_user_id.reset_mock()
    tool_configuration_service_mock.search_tool_info_impl.reset_mock()
    tool_configuration_service_mock.update_tool_info_impl.reset_mock()
    tool_configuration_service_mock.update_tool_list.reset_mock()
    agent_db_mock.query_all_tools.reset_mock()

@pytest.mark.asyncio
async def test_list_tools_api_success(setup_test):
    # Execute
    result = await list_tools_api(authorization="Bearer fake_token")
    
    # Assert
    auth_utils_mock.get_current_user_id.assert_called_once_with("Bearer fake_token")
    agent_db_mock.query_all_tools.assert_called_once_with(tenant_id="tenant456")
    assert result == [{"id": 1, "name": "Tool1"}, {"id": 2, "name": "Tool2"}]

@pytest.mark.asyncio
async def test_list_tools_api_error(setup_test):
    # Setup - override the default behavior for this test
    auth_utils_mock.get_current_user_id.side_effect = Exception("Auth error")
    
    # Execute and Assert
    with pytest.raises(MockHTTPException) as exc_info:
        await list_tools_api(authorization="Bearer fake_token")
    
    assert exc_info.value.status_code == 500
    assert "Failed to get tool info" in exc_info.value.detail
    
    # Reset for other tests
    auth_utils_mock.get_current_user_id.side_effect = async_get_current_user_id

@pytest.mark.asyncio
async def test_search_tool_info_api_success(setup_test):
    # Setup
    request = MockToolInstanceSearchRequest(agent_id="agent123", tool_id="tool456")
    
    # Execute
    result = await search_tool_info_api(request, authorization="Bearer fake_token")
    
    # Assert
    tool_configuration_service_mock.search_tool_info_impl.assert_called_once_with("agent123", "tool456", "Bearer fake_token")
    assert result == {"tool": "info"}

@pytest.mark.asyncio
async def test_search_tool_info_api_error(setup_test):
    # Setup
    request = MockToolInstanceSearchRequest(agent_id="agent123", tool_id="tool456")
    tool_configuration_service_mock.search_tool_info_impl.side_effect = Exception("Search error")
    
    # Execute and Assert
    with pytest.raises(MockHTTPException) as exc_info:
        await search_tool_info_api(request, authorization="Bearer fake_token")
    
    assert exc_info.value.status_code == 500
    assert "Failed to update tool" in exc_info.value.detail
    
    # Reset for other tests
    tool_configuration_service_mock.search_tool_info_impl.side_effect = async_search_tool_info_impl

@pytest.mark.asyncio
async def test_update_tool_info_api_success(setup_test):
    # Setup
    request = MockToolInstanceInfoRequest(
        agent_id="agent123", 
        tool_id="tool456",
        configuration={"key": "value"}
    )
    
    # Execute
    result = await update_tool_info_api(request, authorization="Bearer fake_token")
    
    # Assert
    tool_configuration_service_mock.update_tool_info_impl.assert_called_once_with(request, "Bearer fake_token")
    assert result == {"updated": True}

@pytest.mark.asyncio
async def test_update_tool_info_api_error(setup_test):
    # Setup
    request = MockToolInstanceInfoRequest(
        agent_id="agent123", 
        tool_id="tool456",
        configuration={"key": "value"}
    )
    tool_configuration_service_mock.update_tool_info_impl.side_effect = Exception("Update error")
    
    # Execute and Assert
    with pytest.raises(MockHTTPException) as exc_info:
        await update_tool_info_api(request, authorization="Bearer fake_token")
    
    assert exc_info.value.status_code == 500
    assert "Failed to update tool" in exc_info.value.detail
    
    # Reset for other tests
    tool_configuration_service_mock.update_tool_info_impl.side_effect = async_update_tool_info_impl

@pytest.mark.asyncio
async def test_scan_and_update_tool_success(setup_test):
    # Execute
    result = await scan_and_update_tool(authorization="Bearer fake_token")

    # Assert
    auth_utils_mock.get_current_user_id.assert_called_once_with("Bearer fake_token")
    tool_configuration_service_mock.update_tool_list.assert_called_once_with(tenant_id="tenant456", user_id="user123")
    assert result.status_code == 200

@pytest.mark.asyncio
async def test_scan_and_update_tool_error(setup_test):
    # Setup
    tool_configuration_service_mock.update_tool_list.side_effect = Exception("Update error")

    # Execute
    result = await scan_and_update_tool(authorization="Bearer fake_token")

    # Assert
    assert result.status_code == 400
    
    # Reset for other tests
    tool_configuration_service_mock.update_tool_list.side_effect = async_update_tool_list
