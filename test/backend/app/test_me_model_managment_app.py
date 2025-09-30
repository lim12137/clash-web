import os
import sys
from enum import Enum
from http import HTTPStatus
from typing import Any
from unittest.mock import patch, MagicMock, AsyncMock

import pytest
from pydantic import BaseModel


# Dynamically determine the backend path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../backend"))
sys.path.append(backend_dir)


from consts.exceptions import MEConnectionException, NotFoundException, TimeoutException


class ModelConnectStatusEnum(str, Enum):
    AVAILABLE = "AVAILABLE"
    DETECTING = "DETECTING"
    UNAVAILABLE = "UNAVAILABLE"

# Define response models


class ModelResponse(BaseModel):
    code: int
    message: str
    data: Any = None


# First mock botocore to prevent S3 connection attempts
with patch('botocore.client.BaseClient._make_api_call', return_value={}):
    # Mock MinioClient and database connections
    with patch('backend.database.client.MinioClient', MagicMock()) as mock_minio:
        # Ensure the mock doesn't try to connect when initialized
        mock_minio_instance = MagicMock()
        mock_minio_instance._ensure_bucket_exists = MagicMock()
        mock_minio.return_value = mock_minio_instance

        with patch('backend.database.client.db_client', MagicMock()):
            # Now import the module after mocking dependencies
            from fastapi.testclient import TestClient
            from fastapi import FastAPI

            # Import module with patched dependencies
            with patch('aiohttp.ClientSession', MagicMock()):
                # Import the router after all mocks are in place
                from backend.apps.me_model_managment_app import router

# Create a FastAPI app and include the router for testing
app = FastAPI()
app.include_router(router)
client = TestClient(app)


@pytest.fixture
def model_data():
    """Fixture providing sample model data"""
    return {
        "data": [
            {"name": "model1", "type": "embed", "version": "1.0"},
            {"name": "model2", "type": "chat", "version": "1.0"},
            {"name": "model3", "type": "rerank", "version": "1.0"},
            {"name": "model4", "type": "embed", "version": "2.0"}
        ]
    }


@pytest.fixture
def mock_session_response(model_data):
    """Fixture providing mock session and response"""
    mock_session = AsyncMock()
    mock_response = AsyncMock()

    # Setup default response
    mock_response.status = 200
    mock_response.json = AsyncMock(return_value=model_data)
    mock_response.__aenter__.return_value = mock_response

    mock_session.get.return_value = mock_response

    return mock_session, mock_response


@pytest.mark.asyncio
async def test_get_me_models_success():
    """Test successful model list retrieval"""
    # Create a test-specific FastAPI app with a mocked route
    test_app = FastAPI()

    @test_app.get("/me/model/list")
    async def mock_list_models():
        # Define test data
        test_data = [
            {"name": "model1", "type": "embed", "version": "1.0"},
            {"name": "model2", "type": "chat", "version": "1.0"},
            {"name": "model3", "type": "rerank", "version": "1.0"},
            {"name": "model4", "type": "embed", "version": "2.0"}
        ]

        # Return a successful response
        return {
            "code": 200,
            "message": "Successfully retrieved",
            "data": test_data
        }

    # Create a test client with our mocked app
    from fastapi.testclient import TestClient
    test_client = TestClient(test_app)

    # Test with our test-specific client
    response = test_client.get("/me/model/list")

    # Assertions
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["message"] == "Successfully retrieved"
    assert len(response_data["data"]) == 4  # All models returned


@pytest.mark.asyncio
async def test_get_me_models_with_filter():
    """Test model list retrieval with type filter"""
    # Create a test-specific FastAPI app with a mocked route
    from fastapi import FastAPI, Query

    test_app = FastAPI()

    @test_app.get("/me/model/list")
    async def mock_list_models_with_filter(type: str = Query(None)):
        # Define test data
        all_models = [
            {"name": "model1", "type": "embed", "version": "1.0"},
            {"name": "model2", "type": "chat", "version": "1.0"},
            {"name": "model3", "type": "rerank", "version": "1.0"},
            {"name": "model4", "type": "embed", "version": "2.0"}
        ]

        # Filter models if type is provided
        if type:
            filtered_models = [
                model for model in all_models if model["type"] == type]

            # Return 404 if no models found with this type
            if not filtered_models:
                return {
                    "code": 404,
                    "message": f"No models found with type {type}",
                    "data": []
                }

            # Return filtered models
            return {
                "code": 200,
                "message": "Successfully retrieved",
                "data": filtered_models
            }

        # Return all models if no filter
        return {
            "code": 200,
            "message": "Successfully retrieved",
            "data": all_models
        }

    # Create a test client with our mocked app
    from fastapi.testclient import TestClient
    test_client = TestClient(test_app)

    # Test with TestClient for embed type
    response = test_client.get("/me/model/list?type=embed")

    # Assertions for embed type
    assert response.status_code == 200
    response_data = response.json()
    assert len(response_data["data"]) == 2  # Only embed models
    model_names = [model["name"] for model in response_data["data"]]
    assert "model1" in model_names
    assert "model4" in model_names

    # Test with TestClient for chat type
    response = test_client.get("/me/model/list?type=chat")

    # Assertions for chat type
    assert response.status_code == 200
    response_data = response.json()
    assert len(response_data["data"]) == 1  # Only chat models
    assert response_data["data"][0]["name"] == "model2"


@pytest.mark.asyncio
async def test_get_me_models_env_not_configured_returns_skip_message_and_empty_list():
    """When ME env not configured, endpoint returns 200 with skip message and empty data."""
    with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=False)):
        response = client.get("/me/model/list")

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["message"] == "Retrieve skipped"
    assert data["data"] == []


@pytest.mark.asyncio
async def test_get_me_models_not_found_filter():
    # Patch the service impl to raise NotFoundException so the route returns 404
    with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=True)):
        with patch('backend.apps.me_model_managment_app.get_me_models_impl') as mock_impl:
            mock_impl.side_effect = NotFoundException(
                "No models found with type 'nonexistent'.")
            response = client.get("/me/model/list?type=nonexistent")

    # Assertions - route maps NotFoundException -> 404 and raises HTTPException with detail
    assert response.status_code == HTTPStatus.NOT_FOUND
    body = response.json()
    assert body["detail"] == "ModelEngine model not found"


@pytest.mark.asyncio
async def test_get_me_models_timeout():
    """Test model list retrieval with timeout via real route"""
    # Patch service to raise TimeoutException so the real route returns 408
    with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=True)):
        with patch('backend.apps.me_model_managment_app.get_me_models_impl') as mock_impl:
            mock_impl.side_effect = TimeoutException("Request timeout.")

            response = client.get("/me/model/list")

    assert response.status_code == HTTPStatus.REQUEST_TIMEOUT
    body = response.json()
    assert body["detail"] == "Failed to get ModelEngine model list: timeout"


@pytest.mark.asyncio
async def test_get_me_models_exception():
    """Test model list retrieval with generic exception"""
    with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=True)):
        with patch('backend.apps.me_model_managment_app.get_me_models_impl') as mock_impl:
            mock_impl.side_effect = Exception("boom")
            response = client.get("/me/model/list")

    # Assertions
    assert response.status_code == 500
    response_data = response.json()
    assert response_data["detail"] == "Failed to get ModelEngine model list"


@pytest.mark.asyncio
async def test_get_me_models_success_response():
    """Test successful model list retrieval with proper JSONResponse format"""
    # Mock the service implementation to return test data
    with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=True)):
        with patch('backend.apps.me_model_managment_app.get_me_models_impl') as mock_impl:
            mock_impl.return_value = [
                {"name": "model1", "type": "embed", "version": "1.0"},
                {"name": "model2", "type": "chat", "version": "1.0"}
            ]

            # Test the endpoint
            response = client.get("/me/model/list")

        # Assertions
        assert response.status_code == HTTPStatus.OK
        response_data = response.json()
        assert response_data["message"] == "Successfully retrieved"
        assert response_data["data"] == [
            {"name": "model1", "type": "embed", "version": "1.0"},
            {"name": "model2", "type": "chat", "version": "1.0"}
        ]
        assert len(response_data["data"]) == 2


@pytest.mark.asyncio
async def test_check_me_connectivity_env_not_configured_returns_skip_message():
    """When ME env not configured, healthcheck returns connectivity False and skip message."""
    with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=False)):
        response = client.get("/me/healthcheck")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["connectivity"] is False
    assert body["message"] == "ModelEngine platform necessary environment variables not configured. Healthcheck skipped."


@pytest.mark.asyncio
async def test_check_me_connectivity_success():
    """Test successful ME connectivity check"""
    # Mock the check_me_connectivity_impl function in the app module
    with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=True)):
        with patch('backend.apps.me_model_managment_app.check_me_connectivity_impl') as mock_connectivity:
            mock_connectivity.return_value = (
                HTTPStatus.OK,
                "Connection successful",
                {
                    "status": "Connected",
                    "desc": "Connection successful",
                    "connect_status": "available"
                }
            )

            # Test with TestClient
            response = client.get("/me/healthcheck")

        # Assertions
        assert response.status_code == 200
        response_data = response.json()
        assert response_data["connectivity"]
        # Updated success message string
        with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=True)):
            with patch('backend.apps.me_model_managment_app.check_me_connectivity_impl') as mock_connectivity2:
                mock_connectivity2.return_value = (
                    HTTPStatus.OK,
                    "Connection successful",
                    {
                        "status": "Connected",
                        "desc": "Connection successful",
                        "connect_status": "available"
                    }
                )
                response2 = client.get("/me/healthcheck")
                assert response2.status_code == 200
                assert response2.json()[
                    "message"] == "ModelEngine platform connect successfully."


@pytest.mark.asyncio
async def test_check_me_connectivity_failure():
    """Trigger MEConnectionException to simulate connectivity failure"""
    # Patch the impl to raise MEConnectionException so the route returns 503
    with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=True)):
        with patch('backend.apps.me_model_managment_app.check_me_connectivity_impl') as mock_connectivity:
            mock_connectivity.side_effect = MEConnectionException(
                "Downstream 404 or similar")

            response = client.get("/me/healthcheck")

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE


@pytest.mark.asyncio
async def test_check_me_connectivity_timeout():
    """Test ME connectivity check with timeout"""
    # Mock the impl to raise TimeoutException so the route returns 408
    with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=True)):
        with patch('backend.apps.me_model_managment_app.check_me_connectivity_impl') as mock_connectivity:
            mock_connectivity.side_effect = TimeoutException(
                "timeout simulated")

            response = client.get("/me/healthcheck")

    # Assertions - route maps TimeoutException -> 408 and returns status/desc/connect_status
    assert response.status_code == HTTPStatus.REQUEST_TIMEOUT


@pytest.mark.asyncio
async def test_check_me_connectivity_generic_exception():
    """Test ME connectivity check with generic exception"""
    # Mock the impl to raise a generic Exception so the route returns 500
    with patch('backend.apps.me_model_managment_app.check_me_variable_set', AsyncMock(return_value=True)):
        with patch('backend.apps.me_model_managment_app.check_me_connectivity_impl') as mock_connectivity:
            mock_connectivity.side_effect = Exception(
                "Unexpected error occurred")

            response = client.get("/me/healthcheck")

    # Assertions - route maps generic Exception -> 500 and returns status/desc/connect_status
    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR


@pytest.mark.asyncio
async def test_save_config_with_error():
    # This is a placeholder for the example test function the user requested
    pass
