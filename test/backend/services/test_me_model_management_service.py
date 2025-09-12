import sys
import os

import aiohttp
import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from http import HTTPStatus

# Add the project root directory to sys.path
sys.path.insert(0, os.path.abspath(
    os.path.join(os.path.dirname(__file__), '../../..')))

from consts.exceptions import NotFoundException, TimeoutException

# Sample test data
sample_models_data = {
    "data": [
        {"name": "model1", "type": "embed", "version": "1.0"},
        {"name": "model2", "type": "chat", "version": "1.0"},
        {"name": "model3", "type": "rerank", "version": "1.0"},
        {"name": "model4", "type": "embed", "version": "2.0"}
    ]
}

sample_models_list = [
    {"name": "model1", "type": "embed", "version": "1.0"},
    {"name": "model2", "type": "chat", "version": "1.0"},
    {"name": "model3", "type": "rerank", "version": "1.0"},
    {"name": "model4", "type": "embed", "version": "2.0"}
]


@pytest.mark.asyncio
async def test_get_me_models_impl_success_no_filter():
    """Test successful model list retrieval without type filter"""
    # Mock the consts.const module and import the function
    with patch('consts.const.MODEL_ENGINE_APIKEY', 'mock-api-key'), \
            patch('consts.const.MODEL_ENGINE_HOST', 'http://mock-model-engine-host'):

        # Import the function after mocking
        from services.me_model_management_service import get_me_models_impl

        # Create mock response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=sample_models_data)
        mock_response.raise_for_status = MagicMock()

        # Create mock session
        mock_session = AsyncMock()
        mock_get = AsyncMock()
        mock_get.__aenter__.return_value = mock_response
        mock_session.get = MagicMock(return_value=mock_get)

        # Create mock session factory
        mock_client_session = AsyncMock()
        mock_client_session.__aenter__.return_value = mock_session

        # Patch the ClientSession
        with patch('services.me_model_management_service.aiohttp.ClientSession') as mock_session_class:
            mock_session_class.return_value = mock_client_session

            # Test the function
            data = await get_me_models_impl(timeout=30, type="")

            # Assertions
            assert data == sample_models_list
            assert len(data) == 4

            # Verify correct URL and headers were used
            mock_session.get.assert_called_once()
            called_url = mock_session.get.call_args[0][0]
            assert called_url == "http://mock-model-engine-host/open/router/v1/models"

            called_headers = mock_session.get.call_args[1]['headers']
            assert called_headers['Authorization'] == 'Bearer mock-api-key'


@pytest.mark.asyncio
async def test_get_me_models_impl_success_with_filter():
    """Test successful model list retrieval with type filter"""
    # Mock the consts.const module and import the function
    with patch('consts.const.MODEL_ENGINE_APIKEY', 'mock-api-key'), \
            patch('consts.const.MODEL_ENGINE_HOST', 'http://mock-model-engine-host'):

        # Import the function after mocking
        from services.me_model_management_service import get_me_models_impl

        # Create mock response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=sample_models_data)
        mock_response.raise_for_status = MagicMock()

        # Create mock session
        mock_session = AsyncMock()
        mock_get = AsyncMock()
        mock_get.__aenter__.return_value = mock_response
        mock_session.get = MagicMock(return_value=mock_get)

        # Create mock session factory
        mock_client_session = AsyncMock()
        mock_client_session.__aenter__.return_value = mock_session

        # Patch the ClientSession
        with patch('services.me_model_management_service.aiohttp.ClientSession') as mock_session_class:
            mock_session_class.return_value = mock_client_session

            # Test the function with embed type filter
            data = await get_me_models_impl(timeout=30, type="embed")

            # Assertions
            expected_embed_models = [
                {"name": "model1", "type": "embed", "version": "1.0"},
                {"name": "model4", "type": "embed", "version": "2.0"}
            ]
            assert data == expected_embed_models
            assert len(data) == 2

            # Verify correct URL and headers were used
            mock_session.get.assert_called_once()


@pytest.mark.asyncio
async def test_get_me_models_impl_filter_not_found():
    """Test model list retrieval with non-existent type filter"""
    # Mock the consts.const module and import the function
    with patch('consts.const.MODEL_ENGINE_APIKEY', 'mock-api-key'), \
            patch('consts.const.MODEL_ENGINE_HOST', 'http://mock-model-engine-host'):

        # Import the function after mocking
        from services.me_model_management_service import get_me_models_impl

        # Create mock response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=sample_models_data)
        mock_response.raise_for_status = MagicMock()

        # Create mock session
        mock_session = AsyncMock()
        mock_get = AsyncMock()
        mock_get.__aenter__.return_value = mock_response
        mock_session.get = MagicMock(return_value=mock_get)

        # Create mock session factory
        mock_client_session = AsyncMock()
        mock_client_session.__aenter__.return_value = mock_session

        # Patch the ClientSession
        with patch('services.me_model_management_service.aiohttp.ClientSession') as mock_session_class:
            mock_session_class.return_value = mock_client_session

            # Test the function with non-existent type filter - should raise Exception (not NotFoundException)
            with pytest.raises(Exception) as exc_info:
                await get_me_models_impl(timeout=30, type="nonexistent")

            # Verify the exception message contains expected information
            assert "Failed to get model list: No models found with type 'nonexistent'" in str(
                exc_info.value)


@pytest.mark.asyncio
async def test_get_me_models_impl_timeout():
    """Test model list retrieval with timeout"""
    # Mock the consts.const module and import the function
    with patch('consts.const.MODEL_ENGINE_APIKEY', 'mock-api-key'), \
            patch('consts.const.MODEL_ENGINE_HOST', 'http://mock-model-engine-host'):

        # Import the function after mocking
        from services.me_model_management_service import get_me_models_impl

        # Create mock session that raises TimeoutError
        mock_session = AsyncMock()
        mock_get = AsyncMock()
        mock_get.__aenter__.side_effect = asyncio.TimeoutError()
        mock_session.get = MagicMock(return_value=mock_get)

        # Create mock session factory
        mock_client_session = AsyncMock()
        mock_client_session.__aenter__.return_value = mock_session

        # Patch the ClientSession
        with patch('services.me_model_management_service.aiohttp.ClientSession') as mock_session_class:
            mock_session_class.return_value = mock_client_session

            # Test the function - should raise TimeoutException
            with pytest.raises(TimeoutException) as exc_info:
                await get_me_models_impl(timeout=30, type="")

            # Verify the exception message
            assert "Request timeout." in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_me_models_impl_http_error():
    """Test model list retrieval with HTTP error"""
    # Mock the consts.const module and import the function
    with patch('consts.const.MODEL_ENGINE_APIKEY', 'mock-api-key'), \
            patch('consts.const.MODEL_ENGINE_HOST', 'http://mock-model-engine-host'):

        # Import the function after mocking
        from services.me_model_management_service import get_me_models_impl

        # Create mock response that raises HTTP error
        mock_response = AsyncMock()
        mock_response.raise_for_status = MagicMock(side_effect=aiohttp.ClientResponseError(
            request_info=MagicMock(),
            history=(),
            status=404,
            message="Not Found"
        ))

        # Create mock session
        mock_session = AsyncMock()
        mock_get = AsyncMock()
        mock_get.__aenter__.return_value = mock_response
        mock_session.get = MagicMock(return_value=mock_get)

        # Create mock session factory
        mock_client_session = AsyncMock()
        mock_client_session.__aenter__.return_value = mock_session

        # Patch the ClientSession
        with patch('services.me_model_management_service.aiohttp.ClientSession') as mock_session_class:
            mock_session_class.return_value = mock_client_session

            # Test the function - should raise Exception
            with pytest.raises(Exception) as exc_info:
                await get_me_models_impl(timeout=30, type="")

            # Verify the exception message contains expected information
            assert "Failed to get model list:" in str(exc_info.value)
            assert "404" in str(exc_info.value)
            assert "Not Found" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_me_models_impl_json_parse_error():
    """Test model list retrieval when JSON parsing fails"""
    # Mock the consts.const module and import the function
    with patch('consts.const.MODEL_ENGINE_APIKEY', 'mock-api-key'), \
            patch('consts.const.MODEL_ENGINE_HOST', 'http://mock-model-engine-host'):

        # Import the function after mocking
        from services.me_model_management_service import get_me_models_impl

        # Create mock response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(side_effect=Exception("Invalid JSON"))
        mock_response.raise_for_status = MagicMock()

        # Create mock session
        mock_session = AsyncMock()
        mock_get = AsyncMock()
        mock_get.__aenter__.return_value = mock_response
        mock_session.get = MagicMock(return_value=mock_get)

        # Create mock session factory
        mock_client_session = AsyncMock()
        mock_client_session.__aenter__.return_value = mock_session

        # Patch the ClientSession
        with patch('services.me_model_management_service.aiohttp.ClientSession') as mock_session_class:
            mock_session_class.return_value = mock_client_session

            # Test the function - should raise Exception
            with pytest.raises(Exception) as exc_info:
                await get_me_models_impl(timeout=30, type="")

            # Verify the exception message contains expected information
            assert "Failed to get model list: Invalid JSON." in str(
                exc_info.value)


@pytest.mark.asyncio
async def test_get_me_models_impl_connection_exception():
    """Test model list retrieval when connection exception occurs"""
    # Mock the consts.const module and import the function
    with patch('consts.const.MODEL_ENGINE_APIKEY', 'mock-api-key'), \
            patch('consts.const.MODEL_ENGINE_HOST', 'http://mock-model-engine-host'):

        # Import the function after mocking
        from services.me_model_management_service import get_me_models_impl

        # Create mock session that raises exception
        mock_session = AsyncMock()
        mock_get = AsyncMock()
        mock_get.__aenter__.side_effect = Exception("Connection error")
        mock_session.get = MagicMock(return_value=mock_get)

        # Create mock session factory
        mock_client_session = AsyncMock()
        mock_client_session.__aenter__.return_value = mock_session

        # Patch the ClientSession
        with patch('services.me_model_management_service.aiohttp.ClientSession') as mock_session_class:
            mock_session_class.return_value = mock_client_session

            # Test the function - should raise Exception
            with pytest.raises(Exception) as exc_info:
                await get_me_models_impl(timeout=30, type="")

            # Verify the exception message contains expected information
            assert "Failed to get model list: Connection error." in str(
                exc_info.value)


@pytest.mark.asyncio
async def test_get_me_models_impl_different_types():
    """Test model list retrieval with different type filters"""
    # Mock the consts.const module and import the function
    with patch('consts.const.MODEL_ENGINE_APIKEY', 'mock-api-key'), \
            patch('consts.const.MODEL_ENGINE_HOST', 'http://mock-model-engine-host'):

        # Import the function after mocking
        from services.me_model_management_service import get_me_models_impl

        test_cases = [
            ("chat", [{"name": "model2", "type": "chat", "version": "1.0"}]),
            ("rerank", [{"name": "model3", "type": "rerank", "version": "1.0"}]),
            ("embed", [
                {"name": "model1", "type": "embed", "version": "1.0"},
                {"name": "model4", "type": "embed", "version": "2.0"}
            ])
        ]

        for filter_type, expected_models in test_cases:
            # Create mock response
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value=sample_models_data)
            mock_response.raise_for_status = MagicMock()

            # Create mock session
            mock_session = AsyncMock()
            mock_get = AsyncMock()
            mock_get.__aenter__.return_value = mock_response
            mock_session.get = MagicMock(return_value=mock_get)

            # Create mock session factory
            mock_client_session = AsyncMock()
            mock_client_session.__aenter__.return_value = mock_session

            # Patch the ClientSession
            with patch('services.me_model_management_service.aiohttp.ClientSession') as mock_session_class:
                mock_session_class.return_value = mock_client_session

                # Test the function
                data = await get_me_models_impl(timeout=30, type=filter_type)

                # Assertions
                assert data == expected_models
                assert len(data) == len(expected_models)

                # Verify correct URL was called
                mock_session.get.assert_called_once()


@pytest.mark.asyncio
async def test_get_me_models_impl_empty_response():
    """Test model list retrieval with empty response"""
    # Mock the consts.const module and import the function
    with patch('consts.const.MODEL_ENGINE_APIKEY', 'mock-api-key'), \
            patch('consts.const.MODEL_ENGINE_HOST', 'http://mock-model-engine-host'):

        # Import the function after mocking
        from services.me_model_management_service import get_me_models_impl

        empty_models_data = {"data": []}

        # Create mock response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=empty_models_data)
        mock_response.raise_for_status = MagicMock()

        # Create mock session
        mock_session = AsyncMock()
        mock_get = AsyncMock()
        mock_get.__aenter__.return_value = mock_response
        mock_session.get = MagicMock(return_value=mock_get)

        # Create mock session factory
        mock_client_session = AsyncMock()
        mock_client_session.__aenter__.return_value = mock_session

        # Patch the ClientSession
        with patch('services.me_model_management_service.aiohttp.ClientSession') as mock_session_class:
            mock_session_class.return_value = mock_client_session

            # Test the function without filter - should return empty list
            data = await get_me_models_impl(timeout=30, type="")

            # Assertions for no filter
            assert data == []
            assert len(data) == 0

            # Test the function with filter on empty data - should raise Exception
            with pytest.raises(Exception) as exc_info:
                await get_me_models_impl(timeout=30, type="embed")

            # Verify the exception message contains expected information
            assert "Failed to get model list: No models found with type 'embed'" in str(
                exc_info.value)
            assert "Available types: set()" in str(exc_info.value)
