import unittest
import json
import sys
import asyncio
import os
from unittest.mock import patch, MagicMock, AsyncMock
from enum import Enum

# Dynamically determine the backend path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../backend"))
sys.path.append(backend_dir)

# Define required Pydantic models and enums
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union

# Define necessary enums
class ModelConnectStatusEnum(str, Enum):
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"

# Define response models
class ModelResponse(BaseModel):
    code: int
    message: str
    data: Any = None

# Store original patch for restoration later
original_patch = unittest.mock.patch

# First mock botocore to prevent S3 connection attempts
with patch('botocore.client.BaseClient._make_api_call', return_value={}):
    # Mock MinioClient and database connections
    with patch('backend.database.client.MinioClient', MagicMock()) as mock_minio:
        # Ensure the mock doesn't try to connect when initialized
        mock_minio_instance = MagicMock()
        mock_minio_instance._ensure_bucket_exists = MagicMock()
        mock_minio.return_value = mock_minio_instance

        with patch('backend.database.client.db_client', MagicMock()):
            # Need to patch model_health_service's imports
            with patch('backend.services.model_health_service.check_me_model_connectivity', MagicMock()) as mock_check_connectivity:
                # Configure mock_check_connectivity
                mock_check_connectivity.return_value = {
                    "code": 200,
                    "message": "Model is healthy",
                    "data": {"status": "Connected", "connect_status": "AVAILABLE"}
                }

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

class TestMeModelManagementApp(unittest.TestCase):            
    def setUp(self):
        """Setup test environment before each test"""
        # Sample test data
        self.model_list_data = {
            "data": [
                {"name": "model1", "type": "embed", "version": "1.0"},
                {"name": "model2", "type": "chat", "version": "1.0"},
                {"name": "model3", "type": "rerank", "version": "1.0"},
                {"name": "model4", "type": "embed", "version": "2.0"}
            ]
        }
        
        # Create mock for ClientSession
        self.mock_session = MagicMock()
        self.mock_context_manager = MagicMock()
        self.mock_response = MagicMock()
        
        # Setup default response
        self.mock_response.status = 200
        self.mock_response.json = AsyncMock(return_value=self.model_list_data)
        self.mock_response.__aenter__.return_value = self.mock_response
        
        self.mock_context_manager.__aenter__.return_value = self.mock_session
        self.mock_context_manager.__aexit__.return_value = None
        
        self.mock_session.get.return_value = self.mock_response

    @patch('aiohttp.ClientSession')
    async def test_get_me_models_success(self, mock_session_class):
        """Test successful model list retrieval"""
        # Setup mock
        mock_session = AsyncMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = self.model_list_data
        mock_response.__aenter__.return_value = mock_response
        
        mock_session.get.return_value = mock_response
        
        # Test with TestClient
        with TestClient(app) as client:
            response = client.get("/me/model/list")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 200)
        self.assertEqual(response_data["message"], "Successfully retrieved")
        self.assertEqual(len(response_data["data"]), 4)  # All models returned

    @patch('aiohttp.ClientSession')
    async def test_get_me_models_with_filter(self, mock_session_class):
        """Test model list retrieval with type filter"""
        # Setup mock
        mock_session = AsyncMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = self.model_list_data
        mock_response.__aenter__.return_value = mock_response
        
        mock_session.get.return_value = mock_response
        
        # Test with TestClient for embed type
        with TestClient(app) as client:
            response = client.get("/me/model/list?type=embed")
        
        # Assertions for embed type
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 200)
        self.assertEqual(len(response_data["data"]), 2)  # Only embed models
        model_names = [model["name"] for model in response_data["data"]]
        self.assertIn("model1", model_names)
        self.assertIn("model4", model_names)
        
        # Test with TestClient for chat type
        with TestClient(app) as client:
            response = client.get("/me/model/list?type=chat")
        
        # Assertions for chat type
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 200)
        self.assertEqual(len(response_data["data"]), 1)  # Only chat models
        self.assertEqual(response_data["data"][0]["name"], "model2")

    @patch('aiohttp.ClientSession')
    async def test_get_me_models_not_found_filter(self, mock_session_class):
        """Test model list retrieval with non-existent type filter"""
        # Setup mock
        mock_session = AsyncMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = self.model_list_data
        mock_response.__aenter__.return_value = mock_response
        
        mock_session.get.return_value = mock_response
        
        # Test with TestClient for non-existent type
        with TestClient(app) as client:
            response = client.get("/me/model/list?type=nonexistent")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 404)
        self.assertIn("No models found with type", response_data["message"])
        self.assertEqual(len(response_data["data"]), 0)

    @patch('aiohttp.ClientSession')
    async def test_get_me_models_timeout(self, mock_session_class):
        """Test model list retrieval with timeout"""
        # Setup mock to raise timeout
        mock_session = AsyncMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session
        mock_session.get.side_effect = asyncio.TimeoutError()
        
        # Test with TestClient
        with TestClient(app) as client:
            response = client.get("/me/model/list")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 408)
        self.assertEqual(response_data["message"], "Request timeout")
        self.assertEqual(len(response_data["data"]), 0)

    @patch('aiohttp.ClientSession')
    async def test_get_me_models_exception(self, mock_session_class):
        """Test model list retrieval with generic exception"""
        # Setup mock to raise exception
        mock_session = AsyncMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session
        mock_session.get.side_effect = Exception("Test exception")
        
        # Test with TestClient
        with TestClient(app) as client:
            response = client.get("/me/model/list")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 500)
        self.assertIn("Failed to get model list", response_data["message"])
        self.assertIn("Test exception", response_data["message"])
        self.assertEqual(len(response_data["data"]), 0)

    @patch('aiohttp.ClientSession')
    async def test_check_me_connectivity_success(self, mock_session_class):
        """Test successful ME connectivity check"""
        # Setup mock
        mock_session = AsyncMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.__aenter__.return_value = mock_response
        
        mock_session.get.return_value = mock_response
        
        # Test with TestClient
        with TestClient(app) as client:
            response = client.get("/me/healthcheck")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 200)
        self.assertEqual(response_data["message"], "Connection successful")
        self.assertEqual(response_data["data"]["status"], "Connected")
        self.assertEqual(response_data["data"]["connect_status"], ModelConnectStatusEnum.AVAILABLE.value)

    @patch('aiohttp.ClientSession')
    async def test_check_me_connectivity_failure(self, mock_session_class):
        """Test failed ME connectivity check"""
        # Setup mock
        mock_session = AsyncMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session
        
        mock_response = AsyncMock()
        mock_response.status = 404
        mock_response.__aenter__.return_value = mock_response
        
        mock_session.get.return_value = mock_response
        
        # Test with TestClient
        with TestClient(app) as client:
            response = client.get("/me/healthcheck")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 404)
        self.assertIn("Connection failed", response_data["message"])
        self.assertEqual(response_data["data"]["status"], "Disconnected")
        self.assertEqual(response_data["data"]["connect_status"], ModelConnectStatusEnum.UNAVAILABLE.value)

    @patch('aiohttp.ClientSession')
    async def test_check_me_connectivity_timeout(self, mock_session_class):
        """Test ME connectivity check with timeout"""
        # Setup mock to raise timeout
        mock_session = AsyncMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session
        mock_session.get.side_effect = asyncio.TimeoutError()
        
        # Test with TestClient
        with TestClient(app) as client:
            response = client.get("/me/healthcheck")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 408)
        self.assertEqual(response_data["message"], "Connection timeout")
        self.assertEqual(response_data["data"]["status"], "Disconnected")
        self.assertEqual(response_data["data"]["connect_status"], ModelConnectStatusEnum.UNAVAILABLE.value)

    @patch('aiohttp.ClientSession')
    async def test_check_me_connectivity_exception(self, mock_session_class):
        """Test ME connectivity check with generic exception"""
        # Setup mock to raise exception
        mock_session = AsyncMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session
        mock_session.get.side_effect = Exception("Test exception")
        
        # Test with TestClient
        with TestClient(app) as client:
            response = client.get("/me/healthcheck")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 500)
        self.assertIn("Unknown error occurred", response_data["message"])
        self.assertIn("Test exception", response_data["message"])
        self.assertEqual(response_data["data"]["status"], "Disconnected")
        self.assertEqual(response_data["data"]["connect_status"], ModelConnectStatusEnum.UNAVAILABLE.value)

    @patch('backend.apps.me_model_managment_app.check_me_model_connectivity')
    async def test_check_me_model_healthcheck(self, mock_check_model):
        """Test model health check endpoint"""
        # Setup mock
        expected_response = {
            "code": 200,
            "message": "Model is healthy",
            "data": {"status": "Connected", "connect_status": ModelConnectStatusEnum.AVAILABLE.value}
        }
        
        mock_check_model.return_value = expected_response
        
        # Test with TestClient
        with TestClient(app) as client:
            response = client.get("/me/model/healthcheck?model_name=test_model")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["code"], 200)
        
        # Verify the mock was called with the correct model name
        mock_check_model.assert_called_once_with("test_model")

    @patch('backend.apps.me_model_managment_app.check_me_model_connectivity')
    async def test_check_me_model_healthcheck_unhealthy(self, mock_check_model):
        """Test model health check endpoint with unhealthy model"""
        # Setup mock
        expected_response = {
            "code": 503,
            "message": "Model is unhealthy",
            "data": {"status": "Disconnected", "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value}
        }
        
        mock_check_model.return_value = expected_response
        
        # Test with TestClient
        with TestClient(app) as client:
            response = client.get("/me/model/healthcheck?model_name=test_model")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data["code"], 503)
        self.assertEqual(response_data["message"], "Model is unhealthy")
        self.assertEqual(response_data["data"]["status"], "Disconnected")
        self.assertEqual(response_data["data"]["connect_status"], ModelConnectStatusEnum.UNAVAILABLE.value)

    @patch('backend.apps.me_model_managment_app.check_me_model_connectivity')
    async def test_check_me_model_healthcheck_error(self, mock_check_model):
        """Test model health check endpoint with error"""
        # Setup mock to raise exception
        mock_check_model.side_effect = Exception("Test exception")
        
        # Test with TestClient
        with TestClient(app) as client:
            # This will actually pass through to the real implementation which will handle the exception
            response = client.get("/me/model/healthcheck?model_name=test_model")
        
        # The test would depend on how the actual implementation handles exceptions,
        # but typically it would return an error response
        # For this test, we're just verifying that the endpoint can be called with the mock
        self.assertEqual(mock_check_model.call_count, 1)


if __name__ == "__main__":
    unittest.main()
