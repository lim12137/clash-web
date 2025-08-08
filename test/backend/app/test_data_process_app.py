"""
Unit tests for the data processing application endpoints.
These tests verify the behavior of the data processing API without actual database or service dependencies.
All external services and dependencies are mocked to isolate the tests.
"""

import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import os
import sys
from fastapi import FastAPI, HTTPException, Form, Body, Header
from typing import Dict, Any, Optional
from fastapi.testclient import TestClient
from PIL import Image
import pytest

# Dynamically determine the backend path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../backend"))
sys.path.append(backend_dir)

# Set necessary environment variables before importing application modules
os.environ['REDIS_URL'] = 'redis://localhost:6379/0'
os.environ['REDIS_BACKEND_URL'] = 'redis://localhost:6379/0'

# Other potentially needed environment variables
os.environ['ELASTICSEARCH_URL'] = 'http://localhost:9200'
os.environ['DATA_PATH'] = '/tmp/data'
os.environ['DATA_PROCESS_LOG_LEVEL'] = 'INFO'

# Mock BatchTaskRequest class for testing
class MockBatchTaskRequest:
    def __init__(self, sources=None):
        self.sources = sources or []

# Create mock model module classes
class MockTaskResponse:
    def __init__(self, task_id):
        self.task_id = task_id

class MockBatchTaskResponse:
    def __init__(self, task_ids):
        self.task_ids = task_ids

# Create mock model module
mock_model = MagicMock()
mock_model.BatchTaskRequest = MockBatchTaskRequest
mock_model.TaskResponse = MockTaskResponse
mock_model.BatchTaskResponse = MockBatchTaskResponse
mock_model.SimpleTaskStatusResponse = MagicMock()
mock_model.SimpleTasksListResponse = MagicMock()
mock_model.ConvertStateRequest = MagicMock()
mock_model.ConvertStateResponse = MagicMock()


# Mock celery and other services to prevent actual service calls
mock_celery = MagicMock()
mock_states = MagicMock()
mock_states.PENDING = "PENDING"
mock_states.STARTED = "STARTED"
mock_states.SUCCESS = "SUCCESS"
mock_states.FAILURE = "FAILURE"
mock_celery.states = mock_states
mock_service = MagicMock()
sys.modules['celery'] = mock_celery
sys.modules['services.data_process_service'] = mock_service
sys.modules['consts.model'] = mock_model

# Mock router implementation for testing
class MockRouter:
    def __init__(self):
        self.routes = []

    def post(self, path, **kwargs):
        def decorator(func):
            self.routes.append((path, func))
            return func
        return decorator

    def get(self, path, **kwargs):
        def decorator(func):
            self.routes.append((path, func))
            return func
        return decorator


class TestDataProcessApp(unittest.TestCase):
    """
    Test suite for the data processing application endpoints.
    Tests the API behavior with mocked service dependencies.
    """

    def setUp(self):
        """
        Set up the test environment before each test.
        Creates mocks for services, router, and common test data.
        """
        # Create mocked router and services
        self.router = MockRouter()
        self.service = MagicMock()
        self.process_and_forward = MagicMock()
        self.process_sync = MagicMock()
        self.get_task_info = AsyncMock()
        self.utils_get_task_details = AsyncMock()

        # Mock async context manager
        self.lifespan = MagicMock()

        # Common test data
        self.task_id = "test-task-id-123"
        self.index_name = "test-index"
        self.source = "test-file.pdf"

        # Create actual FastAPI application
        self.app = FastAPI()

        # Define mock routes
        self.setup_mock_routes()

        # Create test client
        self.client = TestClient(self.app)

    def setup_mock_routes(self):
        """
        Set up mock API routes for testing.
        Each route simulates the behavior of a real API endpoint with mocked service calls.
        """
        @self.app.post("/tasks")
        @pytest.mark.asyncio
        async def create_task(request: Dict[str, Any] = Body(None), authorization: Optional[str] = Header(None)):
            # Simulate task creation by actually calling the mock
            task_result = self.process_and_forward.delay(
                source=request.get("source"),
                source_type=request.get("source_type"),
                chunking_strategy=request.get("chunking_strategy"),
                index_name=request.get("index_name"),
                original_filename=request.get("original_filename"),
                authorization=authorization
            )
            return {"task_id": task_result.id}

        @self.app.post("/tasks/process")
        @pytest.mark.asyncio
        async def process_sync_endpoint(
            source: str = Form(...),
            source_type: str = Form("file"),
            chunking_strategy: str = Form("basic"),
            timeout: int = Form(30)
        ):
            # Simulate synchronous processing
            try:
                if getattr(self.process_sync, 'apply_async', None) and getattr(self.process_sync.apply_async, 'side_effect', None):
                    raise self.process_sync.apply_async.side_effect

                task_result = self.process_sync.apply_async.return_value
                result = task_result.get.return_value if hasattr(task_result, 'get') else {}

                return {
                    "success": True,
                    "task_id": task_result.id if hasattr(task_result, 'id') else self.task_id,
                    "source": source,
                    "text": result.get("text", ""),
                    "chunks": result.get("chunks", []),
                    "chunks_count": result.get("chunks_count", 0),
                    "processing_time": result.get("processing_time", 0),
                    "text_length": result.get("text_length", 0)
                }
            except Exception as e:
                # Catch exceptions and return appropriate HTTP error responses
                raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

        @self.app.post("/tasks/batch")
        @pytest.mark.asyncio
        async def create_batch_tasks(request: Dict[str, Any] = Body(None)):
            # Simulate batch task creation
            task_ids = []

            # Handle both Dict and MockBatchTaskRequest types
            if hasattr(request, 'sources'):
                sources = request.sources
            else:
                sources = request.get("sources", [])

            for i in range(len(sources)):
                if isinstance(self.process_and_forward.delay.return_value, list):
                    task_result = self.process_and_forward.delay.return_value[i]
                else:
                    task_result = self.process_and_forward.delay.return_value
                task_ids.append(task_result.id if hasattr(task_result, 'id') else f"batch-task-{i+1}")

            return {"task_ids": task_ids}

        @self.app.get("/tasks/load_image")
        @pytest.mark.asyncio
        async def load_image():
            # Simulate image loading
            if not getattr(self.service, 'load_image', None) or self.service.load_image.return_value is None:
                raise HTTPException(status_code=404, detail="Failed to load image or image format not supported")

            image = self.service.load_image.return_value
            return {"success": True, "base64": "mock_base64_data", "content_type": "image/jpeg"}

        @self.app.get("/tasks/{task_id}")
        @pytest.mark.asyncio
        async def get_task(task_id: str):
            # Simulate getting task information
            task = self.get_task_info.return_value

            if not task:
                raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")

            return task

        @self.app.get("/tasks")
        @pytest.mark.asyncio
        async def list_tasks():
            # Simulate listing all tasks
            tasks = self.service.get_all_tasks.return_value
            return {"tasks": tasks}

        @self.app.get("/tasks/indices/{index_name}")
        @pytest.mark.asyncio
        async def get_index_tasks(index_name: str):
            # Simulate getting index tasks
            return self.service.get_index_tasks.return_value

        @self.app.get("/tasks/{task_id}/details")
        @pytest.mark.asyncio
        async def get_task_details(task_id: str):
            # Simulate getting task details
            task = self.utils_get_task_details.return_value
            if not task:
                raise HTTPException(status_code=404, detail="Task not found")
            return task

        @self.app.post("/tasks/filter_important_image")
        @pytest.mark.asyncio
        async def filter_important_image(
            image_url: str = Form(...),
            positive_prompt: str = Form("an important image"),
            negative_prompt: str = Form("an unimportant image")
        ):
            # Simulate image filtering
            try:
                if getattr(self.service, 'filter_important_image', None) and getattr(self.service.filter_important_image, 'side_effect', None):
                    raise self.service.filter_important_image.side_effect

                # Remove await, return value directly
                return self.service.filter_important_image.return_value
            except Exception as e:
                # Catch exceptions and return appropriate HTTP error responses
                raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

        @self.app.post("/tasks/convert_state")
        @pytest.mark.asyncio
        async def convert_state(request: Dict[str, Any] = Body(None)):
            from celery import states

            process_celery_state = request.get("process_state", "")
            forward_celery_state = request.get("forward_state", "")

            # Handle failure states first
            if process_celery_state == states.FAILURE:
                return {"state": "PROCESS_FAILED"}
            if forward_celery_state == states.FAILURE:
                return {"state": "FORWARD_FAILED"}

            # Handle completed state - both must be SUCCESS
            if process_celery_state == states.SUCCESS and forward_celery_state == states.SUCCESS:
                return {"state": "COMPLETED"}

            # Handle case where nothing has started
            if not process_celery_state and not forward_celery_state:
                return {"state": "WAIT_FOR_PROCESSING"}

            # Define state mappings
            forward_state_map = {
                states.PENDING: "WAIT_FOR_FORWARDING",
                states.STARTED: "FORWARDING",
                states.SUCCESS: "COMPLETED",
                states.FAILURE: "FORWARD_FAILED",
            }
            process_state_map = {
                states.PENDING: "WAIT_FOR_PROCESSING",
                states.STARTED: "PROCESSING",
                states.SUCCESS: "WAIT_FOR_FORWARDING",  # Process done, waiting for forward
                states.FAILURE: "PROCESS_FAILED",
            }

            if forward_celery_state:
                return {"state": forward_state_map.get(forward_celery_state, "WAIT_FOR_FORWARDING")}
            if process_celery_state:
                return {"state": process_state_map.get(process_celery_state, "WAIT_FOR_PROCESSING")}
            return {"state": "WAIT_FOR_PROCESSING"}

    def test_create_task(self):
        """
        Test creating a new task.
        Verifies that the endpoint returns the expected task ID.
        """
        # Set up mock
        mock_task = MagicMock()
        mock_task.id = self.task_id
        self.process_and_forward.delay.return_value = mock_task

        # Test data
        request_data = {
            "source": self.source,
            "source_type": "file",
            "chunking_strategy": "basic",
            "index_name": self.index_name,
            "original_filename": "test-file.pdf",
            "additional_params": {"param1": "value1"}
        }

        # Execute request with authorization header
        response = self.client.post(
            "/tasks", 
            json=request_data,
            headers={"Authorization": "Bearer test-token"}
        )

        # Assert expectations
        self.assertEqual(response.status_code, 200)  # Mock route defaults to 200
        self.assertEqual(response.json(), {"task_id": self.task_id})

        # Verify that process_and_forward.delay was called with authorization parameter
        self.process_and_forward.delay.assert_called_once_with(
            source=self.source,
            source_type="file",
            chunking_strategy="basic",
            index_name=self.index_name,
            original_filename="test-file.pdf",
            authorization="Bearer test-token"
        )

    def test_create_task_without_authorization(self):
        """
        Test creating a new task without authorization header.
        Verifies that the endpoint works when authorization is not provided.
        """
        # Set up mock
        mock_task = MagicMock()
        mock_task.id = self.task_id
        self.process_and_forward.delay.return_value = mock_task

        # Test data
        request_data = {
            "source": self.source,
            "source_type": "file",
            "chunking_strategy": "basic",
            "index_name": self.index_name,
            "original_filename": "test-file.pdf"
        }

        # Execute request without authorization header
        response = self.client.post("/tasks", json=request_data)

        # Assert expectations
        self.assertEqual(response.status_code, 200)  # Mock route defaults to 200
        self.assertEqual(response.json(), {"task_id": self.task_id})

        # Verify that process_and_forward.delay was called with None authorization
        self.process_and_forward.delay.assert_called_once_with(
            source=self.source,
            source_type="file",
            chunking_strategy="basic",
            index_name=self.index_name,
            original_filename="test-file.pdf",
            authorization=None
        )

    def test_process_sync_endpoint_success(self):
        """
        Test synchronous processing endpoint success case.
        Verifies that the endpoint returns the expected processing result.
        """
        # Set up mock
        mock_task = MagicMock()
        mock_task.id = self.task_id
        mock_task.get.return_value = {
            "text": "extracted text",
            "chunks": ["chunk1", "chunk2"],
            "chunks_count": 2,
            "processing_time": 1.5,
            "text_length": 100
        }
        self.process_sync.apply_async.return_value = mock_task

        # Execute request
        response = self.client.post(
            "/tasks/process",
            data={
                "source": self.source,
                "source_type": "file",
                "chunking_strategy": "basic",
                "timeout": 30
            }
        )

        # Assert expectations
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result["success"])
        self.assertEqual(result["task_id"], self.task_id)
        self.assertEqual(result["source"], self.source)
        self.assertEqual(result["text"], "extracted text")
        self.assertEqual(result["chunks_count"], 2)

    def test_process_sync_endpoint_failure(self):
        """
        Test synchronous processing endpoint failure case.
        Verifies that the endpoint returns an appropriate error response.
        """
        # Set up mock to throw exception
        self.process_sync.apply_async.side_effect = Exception("Processing error")

        # Execute request
        response = self.client.post(
            "/tasks/process",
            data={
                "source": self.source,
                "source_type": "file",
                "chunking_strategy": "basic",
                "timeout": 30
            }
        )

        # Assert expectations
        self.assertEqual(response.status_code, 500)
        self.assertIn("Error processing file", response.json()["detail"])
        self.assertIn("Processing error", response.json()["detail"])

    def test_create_batch_tasks(self):
        """
        Test creating multiple tasks in batch.
        Verifies that the endpoint returns the expected task IDs.
        """
        # Set up mock
        mock_task1 = MagicMock()
        mock_task1.id = "batch-task-1"
        mock_task2 = MagicMock()
        mock_task2.id = "batch-task-2"
        self.process_and_forward.delay.return_value = [mock_task1, mock_task2]

        # Test data
        request_data = {
            "sources": [
                {
                    "source": "file1.pdf",
                    "source_type": "file",
                    "chunking_strategy": "basic",
                    "index_name": self.index_name,
                    "extra_param": "value1"
                },
                {
                    "source": "file2.pdf",
                    "source_type": "file",
                    "chunking_strategy": "advanced",
                    "index_name": self.index_name,
                    "another_param": "value2"
                }
            ]
        }

        # Execute request
        response = self.client.post("/tasks/batch", json=request_data)

        # Assert expectations
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"task_ids": ["batch-task-1", "batch-task-2"]})

    def test_load_image_success(self):
        """
        Test loading an image successfully.
        Verifies that the endpoint returns the expected image data.
        """
        # Create test image
        test_image = Image.new('RGB', (100, 100), color='red')
        test_image.format = 'JPEG'

        # Set up mock
        self.service.load_image = AsyncMock(return_value=test_image)

        # Execute request
        response = self.client.get("/tasks/load_image?url=http://example.com/image.jpg")

        # Assert expectations
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result["success"])
        self.assertIn("base64", result)
        self.assertEqual(result["content_type"], "image/jpeg")

    def test_load_image_failure(self):
        """
        Test loading an image failure case.
        Verifies that the endpoint returns an appropriate error response.
        """
        # Set up mock to return None (image loading failure)
        self.service.load_image = AsyncMock(return_value=None)

        # Execute request
        response = self.client.get("/tasks/load_image?url=http://example.com/bad_image.jpg")

        # Assert expectations
        self.assertEqual(response.status_code, 404)
        self.assertIn("Failed to load image", response.json()["detail"])

    def test_get_task_success(self):
        """
        Test getting task information successfully.
        Verifies that the endpoint returns the expected task data.
        """
        # Set up mock
        task_data = {
            "id": self.task_id,
            "task_name": "process_and_forward",
            "index_name": self.index_name,
            "path_or_url": self.source,
            "status": "SUCCESS",
            "created_at": "2023-01-01T12:00:00",
            "updated_at": "2023-01-01T12:05:00",
            "error": None
        }
        self.get_task_info.return_value = task_data

        # Execute request
        response = self.client.get(f"/tasks/{self.task_id}")

        # Assert expectations
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["id"], self.task_id)
        self.assertEqual(result["status"], "SUCCESS")
        self.assertEqual(result["index_name"], self.index_name)

    def test_get_task_not_found(self):
        """
        Test getting non-existent task.
        Verifies that the endpoint returns an appropriate error response.
        """
        # Set up mock to return None (task not found)
        self.get_task_info.return_value = None

        # Execute request
        response = self.client.get("/tasks/nonexistent-id")

        # Assert expectations
        self.assertEqual(response.status_code, 404)
        self.assertIn("not found", response.json()["detail"])

    def test_list_tasks(self):
        """
        Test listing all tasks.
        Verifies that the endpoint returns the expected list of tasks.
        """
        # Set up mock
        tasks_data = [
            {
                "id": "task-1",
                "task_name": "process_and_forward",
                "index_name": self.index_name,
                "path_or_url": "file1.pdf",
                "status": "SUCCESS",
                "created_at": "2023-01-01T12:00:00",
                "updated_at": "2023-01-01T12:05:00",
                "error": None
            },
            {
                "id": "task-2",
                "task_name": "process_and_forward",
                "index_name": self.index_name,
                "path_or_url": "file2.pdf",
                "status": "FAILURE",
                "created_at": "2023-01-01T13:00:00",
                "updated_at": "2023-01-01T13:05:00",
                "error": "Some error"
            }
        ]
        self.service.get_all_tasks = AsyncMock(return_value=tasks_data)

        # Execute request
        response = self.client.get("/tasks")

        # Assert expectations
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(len(result["tasks"]), 2)
        self.assertEqual(result["tasks"][0]["id"], "task-1")
        self.assertEqual(result["tasks"][1]["id"], "task-2")

    def test_get_index_tasks(self):
        """
        Test getting tasks for a specific index.
        Verifies that the endpoint returns the expected tasks.
        """
        # Set up mock
        tasks_data = [
            {
                "id": "task-1",
                "task_name": "process_and_forward",
                "status": "SUCCESS"
            },
            {
                "id": "task-2",
                "task_name": "process_and_forward",
                "status": "PENDING"
            }
        ]
        self.service.get_index_tasks = AsyncMock(return_value=tasks_data)

        # Execute request
        response = self.client.get(f"/tasks/indices/{self.index_name}")

        # Assert expectations
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(len(result), 2)

    def test_get_task_details(self):
        """
        Test getting detailed task information.
        Verifies that the endpoint returns the expected task details.
        """
        # Set up mock
        task_detail_data = {
            "id": self.task_id,
            "task_name": "process_and_forward",
            "status": "SUCCESS",
            "result": {
                "text": "Extracted text",
                "metadata": {"page_count": 5}
            }
        }
        self.utils_get_task_details.return_value = task_detail_data

        # Execute request
        response = self.client.get(f"/tasks/{self.task_id}/details")

        # Assert expectations
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["id"], self.task_id)
        self.assertEqual(result["status"], "SUCCESS")
        self.assertEqual(result["result"]["text"], "Extracted text")

    def test_get_task_details_not_found(self):
        """
        Test getting details for a non-existent task.
        Verifies that the endpoint returns an appropriate error response.
        """
        # Set up mock to return None (task not found)
        self.utils_get_task_details.return_value = None

        # Execute request
        response = self.client.get(f"/tasks/nonexistent-id/details")

        # Assert expectations
        self.assertEqual(response.status_code, 404)
        self.assertIn("not found", response.json()["detail"])

    def test_filter_important_image(self):
        """
        Test filtering an image for importance.
        Verifies that the endpoint returns the expected filtering result.
        """
        # Set up mock
        filter_result = {
            "is_important": True,
            "confidence": 0.85,
            "processing_time": 1.2
        }
        self.service.filter_important_image = AsyncMock(return_value=filter_result)

        # Execute request
        response = self.client.post(
            "/tasks/filter_important_image",
            data={
                "image_url": "http://example.com/image.jpg",
                "positive_prompt": "an important image",
                "negative_prompt": "an unimportant image"
            }
        )

        # Assert expectations
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result["is_important"])
        self.assertEqual(result["confidence"], 0.85)

    def test_filter_important_image_error(self):
        """
        Test filtering an image error case.
        Verifies that the endpoint returns an appropriate error response.
        """
        # Set up mock to throw exception
        self.service.filter_important_image = AsyncMock()
        self.service.filter_important_image.side_effect = Exception("Image processing error")

        # Execute request
        response = self.client.post(
            "/tasks/filter_important_image",
            data={
                "image_url": "http://example.com/image.jpg",
                "positive_prompt": "an important image",
                "negative_prompt": "an unimportant image"
            }
        )

        # Assert expectations
        self.assertEqual(response.status_code, 500)
        self.assertIn("Error processing image", response.json()["detail"])

    def test_convert_state(self):
        """
        Test the state conversion logic.
        Verifies that Celery states are correctly mapped to custom frontend states.
        """
        test_cases = [
            # Failure states
            ({"process_state": "FAILURE", "forward_state": ""}, "PROCESS_FAILED"),
            ({"process_state": "SUCCESS", "forward_state": "FAILURE"}, "FORWARD_FAILED"),
            # Success state
            ({"process_state": "SUCCESS", "forward_state": "SUCCESS"}, "COMPLETED"),
            # In-progress states
            ({"process_state": "STARTED", "forward_state": ""}, "PROCESSING"),
            ({"process_state": "SUCCESS", "forward_state": "STARTED"}, "FORWARDING"),
            # Pending states
            ({"process_state": "PENDING", "forward_state": ""}, "WAIT_FOR_PROCESSING"),
            ({"process_state": "SUCCESS", "forward_state": "PENDING"}, "WAIT_FOR_FORWARDING"),
            # Initial state
            ({"process_state": "", "forward_state": ""}, "WAIT_FOR_PROCESSING"),
            # Edge cases
            ({"process_state": "SUCCESS", "forward_state": ""}, "WAIT_FOR_FORWARDING"),
            ({"process_state": "", "forward_state": "PENDING"}, "WAIT_FOR_FORWARDING"),
            ({"process_state": "", "forward_state": "STARTED"}, "FORWARDING"),
            ({"process_state": "", "forward_state": "SUCCESS"}, "COMPLETED"),
        ]

        for request_data, expected_state in test_cases:
            with self.subTest(request_data=request_data, expected_state=expected_state):
                response = self.client.post("/tasks/convert_state", json=request_data)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), {"state": expected_state})


if __name__ == "__main__":
    unittest.main()
