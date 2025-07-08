import unittest
import os
import json
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from io import BytesIO
from pathlib import Path
import sys  

# Dynamically determine the backend path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../backend"))
sys.path.append(backend_dir)

# Setup patches for dependencies before importing modules
patches = [
    patch('botocore.client.BaseClient._make_api_call', return_value={}),
    patch('backend.database.client.MinioClient', MagicMock()),
    patch('backend.database.client.db_client', MagicMock()),
    patch('backend.utils.auth_utils.get_current_user_id', MagicMock(return_value=('test_user', 'test_tenant'))),
    patch('backend.utils.attachment_utils.convert_image_to_text', 
          MagicMock(side_effect=lambda query, image_input, tenant_id, language='zh': 'mocked image text')),
    patch('backend.utils.attachment_utils.convert_long_text_to_text', 
          MagicMock(side_effect=lambda query, file_context, tenant_id, language='zh': 'mocked text content')),
    patch('httpx.AsyncClient', MagicMock())
]

# Start all patches
for p in patches:
    p.start()

# Now import the modules after applying all patches
from fastapi.testclient import TestClient
from fastapi import UploadFile, HTTPException
from fastapi import FastAPI
from backend.apps.file_management_app import router

# Create a FastAPI app and include the router for testing
app = FastAPI()
app.include_router(router)
client = TestClient(app)

class TestFileManagementApp(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Keep track of patches to stop them in tearDownClass
        cls.patches = patches

    @classmethod
    def tearDownClass(cls):
        # Stop all patches
        for p in cls.patches:
            p.stop()

    def setUp(self):
        # Create mock files for testing
        self.mock_file_content = b"test file content"
        self.mock_image_content = b"mock image binary data"
        self.upload_dir = Path("test_uploads")
        self.upload_dir.mkdir(exist_ok=True)

    def tearDown(self):
        # Clean up test files
        if self.upload_dir.exists():
            for file in self.upload_dir.iterdir():
                file.unlink()
            self.upload_dir.rmdir()

    def create_mock_upload_file(self, filename="test.txt", content=None):
        content = content or self.mock_file_content
        return {
            "file": (filename, BytesIO(content), "text/plain")
        }

    @patch("backend.apps.file_management_app.save_upload_file")
    @patch("backend.apps.file_management_app.trigger_data_process")
    @patch("backend.apps.file_management_app.upload_dir", Path("test_uploads"))
    async def test_upload_files_success(self, mock_trigger, mock_save):
        # Configure mocks
        mock_save.return_value = asyncio.Future()
        mock_save.return_value.set_result(True)
        
        mock_trigger.return_value = asyncio.Future()
        mock_trigger.return_value.set_result({
            "status": "success",
            "task_ids": ["123"]
        })
        
        # Create test client
        with TestClient(app) as client:
            response = client.post(
                "/file/upload",
                files=[
                    ("file", ("test1.txt", BytesIO(b"test1 content"), "text/plain")),
                    ("file", ("test2.txt", BytesIO(b"test2 content"), "text/plain"))
                ],
                data={"chunking_strategy": "paragraph", "index_name": "test_index"}
            )
        
        # Assertions
        self.assertEqual(response.status_code, 201)
        self.assertIn("message", response.json())
        self.assertIn("uploaded_files", response.json())
        self.assertIn("process_tasks", response.json())

    @patch("backend.apps.file_management_app.save_upload_file")
    @patch("backend.apps.file_management_app.trigger_data_process")
    @patch("backend.apps.file_management_app.upload_dir", Path("test_uploads"))
    async def test_upload_files_processing_error(self, mock_trigger, mock_save):
        # Configure mocks
        mock_save.return_value = asyncio.Future()
        mock_save.return_value.set_result(True)
        
        mock_trigger.return_value = asyncio.Future()
        mock_trigger.return_value.set_result({
            "status": "error",
            "message": "Processing failed"
        })
        
        # Create test client
        with TestClient(app) as client:
            response = client.post(
                "/file/upload",
                files=[("file", ("test.txt", BytesIO(b"test content"), "text/plain"))],
                data={"chunking_strategy": "paragraph", "index_name": "test_index"}
            )
        
        # Assertions
        self.assertEqual(response.status_code, 500)
        self.assertIn("error", response.json())

    @patch("backend.apps.file_management_app.save_upload_file")
    async def test_upload_files_no_files(self, mock_save):
        mock_save.return_value = asyncio.Future()
        mock_save.return_value.set_result(False)
        
        # Create test client
        with TestClient(app) as client:
            response = client.post(
                "/file/upload",
                files=[],
                data={"chunking_strategy": "paragraph", "index_name": "test_index"}
            )
        
        # Assertions
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.json())

    @patch("backend.apps.file_management_app.upload_fileobj")
    async def test_storage_upload_files_success(self, mock_upload):
        # Configure mock
        mock_upload.return_value = {
            "success": True,
            "file_name": "test.txt",
            "url": "https://test-url.com/test.txt"
        }
        
        # Create test client
        with TestClient(app) as client:
            response = client.post(
                "/file/storage",
                files=[
                    ("files", ("test1.txt", BytesIO(b"test1 content"), "text/plain")),
                    ("files", ("test2.txt", BytesIO(b"test2 content"), "text/plain"))
                ],
                data={"folder": "test_folder"}
            )
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        self.assertIn("message", response.json())
        self.assertEqual(response.json()["success_count"], 2)
        self.assertEqual(response.json()["failed_count"], 0)

    @patch("backend.apps.file_management_app.upload_fileobj")
    async def test_storage_upload_files_partial_failure(self, mock_upload):
        # Configure mock to simulate one success and one failure
        mock_upload.side_effect = [
            {
                "success": True,
                "file_name": "test1.txt",
                "url": "https://test-url.com/test1.txt"
            },
            Exception("Upload failed")
        ]
        
        # Create test client
        with TestClient(app) as client:
            response = client.post(
                "/file/storage",
                files=[
                    ("files", ("test1.txt", BytesIO(b"test1 content"), "text/plain")),
                    ("files", ("test2.txt", BytesIO(b"test2 content"), "text/plain"))
                ]
            )
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success_count"], 1)
        self.assertEqual(response.json()["failed_count"], 1)

    @patch("backend.apps.file_management_app.list_files")
    async def test_get_storage_files(self, mock_list):
        # Configure mock
        mock_list.return_value = [
            {"name": "test1.txt", "size": 100, "url": "https://test-url.com/test1.txt"},
            {"name": "test2.txt", "size": 200, "url": "https://test-url.com/test2.txt"}
        ]
        
        # Create test client
        with TestClient(app) as client:
            response = client.get("/file/storage?prefix=test&limit=10&include_urls=true")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 2)
        self.assertEqual(len(response.json()["files"]), 2)

    @patch("backend.apps.file_management_app.list_files")
    async def test_get_storage_files_no_urls(self, mock_list):
        # Configure mock
        mock_list.return_value = [
            {"name": "test1.txt", "size": 100, "url": "https://test-url.com/test1.txt"},
            {"name": "test2.txt", "size": 200, "url": "https://test-url.com/test2.txt"}
        ]
        
        # Create test client
        with TestClient(app) as client:
            response = client.get("/file/storage?include_urls=false")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        for file in response.json()["files"]:
            self.assertNotIn("url", file)

    @patch("backend.apps.file_management_app.list_files")
    async def test_get_storage_files_error(self, mock_list):
        # Configure mock
        mock_list.side_effect = Exception("Storage access error")
        
        # Create test client
        with TestClient(app) as client:
            response = client.get("/file/storage")
        
        # Assertions
        self.assertEqual(response.status_code, 500)
        self.assertIn("detail", response.json())

    @patch("backend.apps.file_management_app.get_file_url")
    async def test_get_storage_file_success(self, mock_get_url):
        # Configure mock
        mock_get_url.return_value = {
            "success": True,
            "url": "https://test-url.com/test.txt",
            "metadata": {"content-type": "text/plain"}
        }
        
        # Create test client
        with TestClient(app) as client:
            response = client.get("/file/storage/folder/test.txt?download=false&expires=1800")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)
        self.assertEqual(response.json()["url"], "https://test-url.com/test.txt")

    @patch("backend.apps.file_management_app.get_file_url")
    async def test_get_storage_file_download(self, mock_get_url):
        # Configure mock
        mock_get_url.return_value = {
            "success": True,
            "url": "https://test-url.com/test.txt",
        }
        
        # Create test client
        with TestClient(app) as client:
            response = client.get("/file/storage/folder/test.txt?download=true")
        
        # Assertions
        self.assertEqual(response.status_code, 307)  # Should redirect
        self.assertEqual(response.headers["location"], "https://test-url.com/test.txt")

    @patch("backend.apps.file_management_app.get_file_url")
    async def test_get_storage_file_not_found(self, mock_get_url):
        # Configure mock
        mock_get_url.return_value = {
            "success": False,
            "error": "File not found"
        }
        
        # Create test client
        with TestClient(app) as client:
            response = client.get("/file/storage/folder/nonexistent.txt")
        
        # Assertions
        self.assertEqual(response.status_code, 404)

    @patch("backend.apps.file_management_app.delete_file")
    async def test_remove_storage_file_success(self, mock_delete):
        # Configure mock
        mock_delete.return_value = {
            "success": True,
        }
        
        # Create test client
        with TestClient(app) as client:
            response = client.delete("/file/storage/test.txt")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)

    @patch("backend.apps.file_management_app.delete_file")
    async def test_remove_storage_file_not_found(self, mock_delete):
        # Configure mock
        mock_delete.return_value = {
            "success": False,
            "error": "File not found"
        }
        
        # Create test client
        with TestClient(app) as client:
            response = client.delete("/file/storage/nonexistent.txt")
        
        # Assertions
        self.assertEqual(response.status_code, 404)

    @patch("backend.apps.file_management_app.get_file_url")
    async def test_get_storage_file_batch_urls(self, mock_get_url):
        # Configure mock
        mock_get_url.side_effect = [
            {"success": True, "url": "https://test-url.com/test1.txt"},
            {"success": False, "error": "File not found"}
        ]
        
        request_data = {"object_names": ["test1.txt", "nonexistent.txt"]}
        
        # Create test client
        with TestClient(app) as client:
            response = client.post(
                "/file/storage/batch-urls?expires=1800",
                json=request_data
            )
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success_count"], 1)
        self.assertEqual(response.json()["failed_count"], 1)

    async def test_get_storage_file_batch_urls_invalid_request(self):
        request_data = {"invalid_field": ["test.txt"]}
        
        # Create test client
        with TestClient(app) as client:
            response = client.post(
                "/file/storage/batch-urls",
                json=request_data
            )
        
        # Assertions
        self.assertEqual(response.status_code, 400)

    @patch("backend.apps.file_management_app.get_current_user_id")
    @patch("backend.apps.file_management_app.process_image_file")
    @patch("backend.apps.file_management_app.process_text_file")
    async def test_preprocess_api_mixed_files(self, mock_process_text, mock_process_image, mock_get_user):
        # Configure mocks
        mock_get_user.return_value = ("user123", "tenant456")
        mock_process_image.return_value = asyncio.Future()
        mock_process_image.return_value.set_result("Image content processed")
        mock_process_text.return_value = asyncio.Future()
        mock_process_text.return_value.set_result("Text content processed")
        
        # Create test client with streaming response test
        # Note: TestClient doesn't fully support testing streaming responses
        # This is a simplified test
        with TestClient(app) as client:
            with patch('backend.apps.file_management_app.StreamingResponse', MagicMock()) as mock_stream:
                response = client.post(
                    "/file/preprocess",
                    files=[
                        ("files", ("test.jpg", BytesIO(b"image data"), "image/jpeg")),
                        ("files", ("test.txt", BytesIO(b"text data"), "text/plain"))
                    ],
                    data={"query": "test query"},
                    headers={"authorization": "Bearer test_token"}
                )

    @patch("backend.apps.file_management_app.convert_image_to_text")
    async def test_process_image_file(self, mock_convert):
        # Import directly in the test to use the already established mocks
        from backend.apps.file_management_app import process_image_file
        
        # Configure mock
        mock_convert.return_value = "Extracted text from image"
        
        # Test the function
        result = await process_image_file(
            query="Test query",
            filename="test.jpg",
            file_content=self.mock_image_content,
            tenant_id="tenant123"
        )
        
        # Assertions
        self.assertIn("Image file test.jpg content", result)
        self.assertIn("Extracted text from image", result)

    @patch('httpx.AsyncClient')
    async def test_process_text_file(self, mock_client):
        # Import directly in the test to use the already established mocks
        from backend.apps.file_management_app import process_text_file
        
        # Setup mock response for httpx client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"text": "Extracted raw text from file"}
        
        mock_client_instance = MagicMock()
        mock_client_instance.post.return_value = asyncio.Future()
        mock_client_instance.post.return_value.set_result(mock_response)
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        # Test the function
        result = await process_text_file(
            query="Test query",
            filename="test.txt",
            file_content=self.mock_file_content,
            tenant_id="tenant123",
            language="en"
        )
        
        # Assertions
        self.assertIn("File test.txt content", result)

    def test_get_file_description(self):
        # Import directly in the test to use the already established mocks
        from backend.apps.file_management_app import get_file_description
        
        # Create mock UploadFile objects
        text_file = MagicMock()
        text_file.filename = "document.txt"
        
        image_file = MagicMock()
        image_file.filename = "photo.jpg"
        
        # Test the function
        result = get_file_description([text_file, image_file])
        
        # Assertions
        self.assertIn("User provided some reference files", result)
        self.assertIn("Image file photo.jpg", result)
        self.assertIn("File document.txt", result)

    def test_options_route(self):
        # Create test client
        with TestClient(app) as client:
            response = client.options("/file/test_path")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["detail"], "OK")


if __name__ == "__main__":
    unittest.main()
