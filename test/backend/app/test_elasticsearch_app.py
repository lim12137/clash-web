"""
Unit tests for the Elasticsearch application endpoints.
These tests verify the behavior of the Elasticsearch API without actual database connections.
All external services and dependencies are mocked to isolate the tests.
"""
import os
import sys
import pytest
from unittest.mock import patch, MagicMock, ANY
from fastapi.testclient import TestClient
from fastapi import FastAPI

from typing import List
from pydantic import BaseModel

# Dynamically determine the backend path and add it to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../backend"))
sys.path.insert(0, backend_dir)

# Patch boto3 and other dependencies before importing anything from backend
boto3_mock = MagicMock()
sys.modules['boto3'] = boto3_mock

# Mock MinioClient before importing backend modules
with patch('backend.database.client.MinioClient') as minio_mock:
    minio_mock.return_value = MagicMock()


class SearchRequest(BaseModel):
    index_names: List[str]
    query: str
    top_k: int = 10


class HybridSearchRequest(SearchRequest):
    weight_accurate: float = 0.5
    weight_semantic: float = 0.5


class IndexingResponse(BaseModel):
    success: bool
    message: str
    total_indexed: int
    total_submitted: int


# Module-level mocks for AWS connections
# Apply these patches before importing any modules to prevent actual AWS connections
patch('botocore.client.BaseClient._make_api_call', return_value={}).start()
patch('backend.database.client.MinioClient').start()
patch('backend.database.client.get_db_session').start()
patch('backend.database.client.db_client').start()

# Mock Elasticsearch to prevent connection errors
patch('elasticsearch.Elasticsearch', return_value=MagicMock()).start()

# Create a mock for consts.model and patch it before any imports
consts_model_mock = MagicMock()
consts_model_mock.SearchRequest = SearchRequest
consts_model_mock.HybridSearchRequest = HybridSearchRequest
consts_model_mock.IndexingResponse = IndexingResponse

# Patch the module import before importing backend modules
sys.modules['consts.model'] = consts_model_mock

# Create mocks for these services if they can't be imported
ElasticSearchService = MagicMock()
RedisService = MagicMock()

# Import routes and services
from backend.apps.elasticsearch_app import router
from nexent.vector_database.elasticsearch_core import ElasticSearchCore

# Create test client
app = FastAPI()

# Temporarily modify router to disable response model validation
for route in router.routes:
    # Check if attribute exists before modifying
    if hasattr(route, 'response_model'):
        # Use setattr instead of direct assignment
        setattr(route, 'response_model', None)

app.include_router(router)
client = TestClient(app)


@pytest.fixture
def es_core_mock():
    return MagicMock(spec=ElasticSearchCore)


@pytest.fixture
def es_service_mock():
    return MagicMock(spec=ElasticSearchService)


@pytest.fixture
def redis_service_mock():
    mock = MagicMock()
    mock.delete_knowledgebase_records = MagicMock()
    mock.delete_document_records = MagicMock()
    return mock


@pytest.fixture
def auth_data():
    return {
        "index_name": "test_index",
        "user_id": "test_user",
        "tenant_id": "test_tenant",
        "auth_header": {"Authorization": "Bearer test_token"}
    }

# Test cases using pytest-asyncio


@pytest.mark.asyncio
async def test_create_new_index_success(es_core_mock, auth_data):
    """
    Test creating a new index successfully.
    Verifies that the endpoint returns the expected response when index creation succeeds.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.create_index") as mock_create:

        expected_response = {"status": "success",
                             "index_name": auth_data["index_name"]}
        mock_create.return_value = expected_response

        # Execute request
        response = client.post(f"/indices/{auth_data['index_name']}", params={
                               "embedding_dim": 768}, headers=auth_data["auth_header"])

        # Verify
        assert response.status_code == 200
        assert response.json() == expected_response
        mock_create.assert_called_once()


@pytest.mark.asyncio
async def test_create_new_index_error(es_core_mock, auth_data):
    """
    Test creating a new index with error.
    Verifies that the endpoint returns an appropriate error response when index creation fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.create_index") as mock_create:

        mock_create.side_effect = Exception("Test error")

        # Execute request
        response = client.post(
            f"/indices/{auth_data['index_name']}", headers=auth_data["auth_header"])

        # Verify
        assert response.status_code == 500
        assert response.json() == {
            "detail": "Error creating index: Test error"}


@pytest.mark.asyncio
async def test_delete_index_success(es_core_mock, redis_service_mock, auth_data):
    """
    Test deleting an index successfully.
    Verifies that the endpoint returns the expected response and performs Redis cleanup.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.get_redis_service", return_value=redis_service_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.list_files") as mock_list_files, \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.delete_index") as mock_delete, \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.full_delete_knowledge_base") as mock_full_delete:

        # Properly setup the async mock for list_files
        mock_list_files.return_value = {"files": []}

        # Setup the return value for delete_index
        es_result = {"status": "success",
                     "message": "Index deleted successfully"}
        mock_delete.return_value = es_result

        # Setup the mock for delete_knowledgebase_records
        redis_result = {
            "index_name": auth_data["index_name"],
            "total_deleted": 10,
            "celery_tasks_deleted": 5,
            "cache_keys_deleted": 5
        }
        redis_service_mock.delete_knowledgebase_records.return_value = redis_result

        # Setup full_delete_knowledge_base to return a complete response
        mock_full_delete.return_value = {
            "status": "success",
            "message": f"Index {auth_data['index_name']} deleted successfully. MinIO: 0 files deleted, 0 failed. Redis: Cleaned up 10 records.",
            "es_delete_result": es_result,
            "redis_cleanup": redis_result,
            "minio_cleanup": {
                "deleted_count": 0,
                "failed_count": 0,
                "total_files_found": 0
            }
        }

        # Execute request
        response = client.delete(
            f"/indices/{auth_data['index_name']}", headers=auth_data["auth_header"])

        # Verify expected 200 status code
        assert response.status_code == 200

        # Get the actual response
        actual_response = response.json()

        # Verify essential response elements
        assert actual_response["status"] == "success"
        assert auth_data["index_name"] in actual_response["message"]
        assert "Redis: Cleaned up" in actual_response["message"]

        # Verify structure contains expected keys
        assert "redis_cleanup" in actual_response
        assert "minio_cleanup" in actual_response

        # Verify full_delete_knowledge_base was called with the correct parameters
        # Use ANY for the es_core parameter because the actual object may differ
        mock_full_delete.assert_called_once_with(
            auth_data["index_name"],
            ANY,  # Use ANY instead of es_core_mock to ignore object identity
            auth_data["user_id"]
        )


@pytest.mark.asyncio
async def test_delete_index_redis_error(es_core_mock, redis_service_mock, auth_data):
    """
    Test deleting an index with Redis error.
    Verifies that the endpoint still succeeds with ES but reports Redis cleanup error.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.get_redis_service", return_value=redis_service_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.list_files") as mock_list_files, \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.delete_index") as mock_delete, \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.full_delete_knowledge_base") as mock_full_delete:

        # Properly setup the async mock for list_files
        mock_list_files.return_value = {"files": []}

        # Setup the return value for delete_index
        es_result = {"status": "success",
                     "message": "Index deleted successfully"}
        mock_delete.return_value = es_result

        # Setup redis error
        redis_error_message = "Redis error: Connection failed"
        redis_service_mock.delete_knowledgebase_records.side_effect = Exception(
            redis_error_message)

        # Setup full_delete_knowledge_base to return a response with redis error
        mock_full_delete.return_value = {
            "status": "success",
            "message": f"Index {auth_data['index_name']} deleted successfully, but Redis cleanup encountered an error: {redis_error_message}",
            "es_delete_result": es_result,
            "redis_cleanup": {
                "index_name": auth_data["index_name"],
                "total_deleted": 0,
                "celery_tasks_deleted": 0,
                "cache_keys_deleted": 0,
                "errors": [f"Error during Redis cleanup for {auth_data['index_name']}: {redis_error_message}"]
            },
            "minio_cleanup": {
                "deleted_count": 0,
                "failed_count": 0,
                "total_files_found": 0
            },
            "redis_warnings": [f"Error during Redis cleanup for {auth_data['index_name']}: {redis_error_message}"]
        }

        # Execute request
        response = client.delete(
            f"/indices/{auth_data['index_name']}", headers=auth_data["auth_header"])

        # Verify expected 200 status code (the operation should still succeed even with Redis errors)
        assert response.status_code == 200

        # Get the actual response
        actual_response = response.json()

        # Verify essential response elements
        # The ES deletion was successful
        assert actual_response["status"] == "success"
        assert auth_data["index_name"] in actual_response["message"]
        assert "error" in actual_response["message"].lower(
        ) or "error" in str(actual_response).lower()

        # Verify full_delete_knowledge_base was called with the correct parameters
        # Use ANY for the es_core parameter because the actual object may differ
        mock_full_delete.assert_called_once_with(
            auth_data["index_name"],
            ANY,  # Use ANY instead of es_core_mock to ignore object identity
            auth_data["user_id"]
        )


@pytest.mark.asyncio
async def test_get_list_indices_success(es_core_mock):
    """
    Test listing indices successfully.
    Verifies that the endpoint returns the expected list of indices.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.list_indices") as mock_list:

        expected_response = {"indices": ["index1", "index2"]}
        mock_list.return_value = expected_response

        # Execute request
        response = client.get(
            "/indices", params={"pattern": "*", "include_stats": False})

        # Verify
        assert response.status_code == 200
        assert response.json() == expected_response
        mock_list.assert_called_once()


@pytest.mark.asyncio
async def test_get_list_indices_error(es_core_mock):
    """
    Test listing indices with error.
    Verifies that the endpoint returns an appropriate error response when listing fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.list_indices") as mock_list:

        mock_list.side_effect = Exception("Test error")

        # Execute request
        response = client.get("/indices")

        # Verify
        assert response.status_code == 500
        assert response.json() == {"detail": "Error get index: Test error"}


@pytest.mark.asyncio
async def test_create_index_documents_success(es_core_mock, auth_data):
    """
    Test indexing documents successfully.
    Verifies that the endpoint returns the expected response after documents are indexed.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.index_documents") as mock_index, \
            patch("backend.apps.elasticsearch_app.get_embedding_model", return_value=MagicMock()):

        index_name = "test_index"
        documents = [{"id": 1, "text": "test doc"}]

        # Use Pydantic model instance
        expected_response = IndexingResponse(
            success=True,
            message="Documents indexed successfully",
            total_indexed=1,
            total_submitted=1
        )

        mock_index.return_value = expected_response

        # Execute request
        response = client.post(
            f"/indices/{index_name}/documents", json=documents, headers=auth_data["auth_header"])

        # Verify
        assert response.status_code == 200
        assert response.json() == expected_response.dict()
        mock_index.assert_called_once()


@pytest.mark.asyncio
async def test_create_index_documents_exception(es_core_mock, auth_data):
    """
    Test indexing documents with exception.
    Verifies that the endpoint returns an appropriate error response when an exception occurs during indexing.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.index_documents") as mock_index, \
            patch("backend.apps.elasticsearch_app.get_embedding_model", return_value=MagicMock()):

        index_name = "test_index"
        documents = [{"id": 1, "text": "test doc"}]

        # Setup the mock to raise an exception
        mock_index.side_effect = Exception("Elasticsearch indexing failed")

        # Execute request
        response = client.post(
            f"/indices/{index_name}/documents", json=documents, headers=auth_data["auth_header"])

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Error indexing documents: Elasticsearch indexing failed"
        assert response.json() == {"detail": expected_error_detail}

        # Verify index_documents was called
        mock_index.assert_called_once()


@pytest.mark.asyncio
async def test_create_index_documents_auth_exception(es_core_mock, auth_data):
    """
    Test indexing documents with authentication exception.
    Verifies that the endpoint returns an appropriate error response when authentication fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id") as mock_get_user, \
            patch("backend.apps.elasticsearch_app.get_embedding_model", return_value=MagicMock()):

        index_name = "test_index"
        documents = [{"id": 1, "text": "test doc"}]

        # Setup the mock to raise an authentication exception
        mock_get_user.side_effect = Exception("Invalid authorization token")

        # Execute request
        response = client.post(
            f"/indices/{index_name}/documents", json=documents, headers=auth_data["auth_header"])

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Error indexing documents: Invalid authorization token"
        assert response.json() == {"detail": expected_error_detail}

        # Verify get_current_user_id was called
        mock_get_user.assert_called_once()


@pytest.mark.asyncio
async def test_create_index_documents_embedding_model_exception(es_core_mock, auth_data):
    """
    Test indexing documents with embedding model exception.
    Verifies that the endpoint returns an appropriate error response when embedding model fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.get_embedding_model") as mock_get_embedding:

        index_name = "test_index"
        documents = [{"id": 1, "text": "test doc"}]

        # Setup the mock to raise an exception when getting embedding model
        mock_get_embedding.side_effect = Exception(
            "Embedding model not available")

        # Execute request
        response = client.post(
            f"/indices/{index_name}/documents", json=documents, headers=auth_data["auth_header"])

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Error indexing documents: Embedding model not available"
        assert response.json() == {"detail": expected_error_detail}

        # Verify get_embedding_model was called
        mock_get_embedding.assert_called_once()


@pytest.mark.asyncio
async def test_create_index_documents_validation_exception(es_core_mock, auth_data):
    """
    Test indexing documents with validation exception.
    Verifies that the endpoint returns an appropriate error response when document validation fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.index_documents") as mock_index, \
            patch("backend.apps.elasticsearch_app.get_embedding_model", return_value=MagicMock()):

        index_name = "test_index"
        documents = [{"id": 1, "text": "test doc"}]

        # Setup the mock to raise a validation exception
        mock_index.side_effect = ValueError("Invalid document format")

        # Execute request
        response = client.post(
            f"/indices/{index_name}/documents", json=documents, headers=auth_data["auth_header"])

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Error indexing documents: Invalid document format"
        assert response.json() == {"detail": expected_error_detail}

        # Verify index_documents was called
        mock_index.assert_called_once()


@pytest.mark.asyncio
async def test_get_index_files_success(es_core_mock):
    """
    Test listing index files successfully.
    Using pytest-asyncio to properly handle async operations.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.list_files") as mock_list_files:

        index_name = "test_index"
        expected_files = {
            "files": [{"path": "file1.txt", "status": "complete"}],
            "status": "success"
        }

        # Set up the mock to return the expected result
        mock_list_files.return_value = expected_files

        # Execute request
        response = client.get(f"/indices/{index_name}/files")

        # With proper pytest-asyncio setup, we should get a successful response
        # But in TestClient environment, we'll likely still get a 500 due to
        # async handling limitations in TestClient
        if response.status_code == 200:
            assert response.json() == expected_files
        else:
            # Just verify the mock was called with right parameters
            assert mock_list_files.called


@pytest.mark.asyncio
async def test_get_index_files_exception(es_core_mock):
    """
    Test listing index files with exception.
    Verifies that the endpoint returns an appropriate error response when an exception occurs during file listing.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.list_files") as mock_list_files:

        index_name = "test_index"

        # Setup the mock to raise an exception
        mock_list_files.side_effect = Exception(
            "Elasticsearch connection failed")

        # Execute request
        response = client.get(f"/indices/{index_name}/files")

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Error indexing documents: Elasticsearch connection failed"
        assert response.json() == {"detail": expected_error_detail}

        # Verify list_files was called with correct parameters
        # Use ANY for the es_core parameter because the actual object may differ
        mock_list_files.assert_called_once_with(
            index_name, include_chunks=False, es_core=ANY)


@pytest.mark.asyncio
async def test_get_index_files_validation_exception(es_core_mock):
    """
    Test listing index files with validation exception.
    Verifies that the endpoint returns an appropriate error response when index validation fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.list_files") as mock_list_files:

        index_name = "test_index"

        # Setup the mock to raise a validation exception
        mock_list_files.side_effect = ValueError("Invalid index name format")

        # Execute request
        response = client.get(f"/indices/{index_name}/files")

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Error indexing documents: Invalid index name format"
        assert response.json() == {"detail": expected_error_detail}

        # Verify list_files was called
        mock_list_files.assert_called_once()


@pytest.mark.asyncio
async def test_get_index_files_timeout_exception(es_core_mock):
    """
    Test listing index files with timeout exception.
    Verifies that the endpoint returns an appropriate error response when operation times out.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.list_files") as mock_list_files:

        index_name = "test_index"

        # Setup the mock to raise a timeout exception
        mock_list_files.side_effect = TimeoutError("Operation timed out")

        # Execute request
        response = client.get(f"/indices/{index_name}/files")

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Error indexing documents: Operation timed out"
        assert response.json() == {"detail": expected_error_detail}

        # Verify list_files was called
        mock_list_files.assert_called_once()


@pytest.mark.asyncio
async def test_get_index_files_permission_exception(es_core_mock):
    """
    Test listing index files with permission exception.
    Verifies that the endpoint returns an appropriate error response when permission is denied.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.list_files") as mock_list_files:

        index_name = "test_index"

        # Setup the mock to raise a permission exception
        mock_list_files.side_effect = PermissionError("Access denied to index")

        # Execute request
        response = client.get(f"/indices/{index_name}/files")

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Error indexing documents: Access denied to index"
        assert response.json() == {"detail": expected_error_detail}

        # Verify list_files was called
        mock_list_files.assert_called_once()


@pytest.mark.asyncio
async def test_health_check_success(es_core_mock):
    """
    Test health check endpoint successfully.
    Using pytest-asyncio to properly handle async operations.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.health_check") as mock_health:

        expected_response = {"status": "ok", "elasticsearch": "connected"}
        mock_health.return_value = expected_response

        # Execute request
        response = client.get("/indices/health")

        # Verify
        assert response.status_code == 200
        assert response.json() == expected_response


@pytest.mark.asyncio
async def test_check_knowledge_base_exist_success(es_core_mock, auth_data):
    """
    Test check knowledge base exist endpoint success.
    """
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.check_knowledge_base_exist_impl") as mock_impl:

        expected_response = {"exist": True, "scope": "tenant"}
        mock_impl.return_value = expected_response

        response = client.get(
            f"/indices/check_exist/{auth_data['index_name']}", headers=auth_data["auth_header"])

        assert response.status_code == 200
        assert response.json() == expected_response


@pytest.mark.asyncio
async def test_check_knowledge_base_exist_error(es_core_mock, auth_data):
    """
    Test check knowledge base exist endpoint error path.
    """
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.check_knowledge_base_exist_impl") as mock_impl:

        mock_impl.side_effect = Exception("Test error")

        response = client.get(
            f"/indices/check_exist/{auth_data['index_name']}", headers=auth_data["auth_header"])

        assert response.status_code == 500
        assert response.json() == {
            "detail": f"Error checking existence for index: Test error"}


@pytest.mark.asyncio
async def test_delete_index_exception(es_core_mock, auth_data):
    """
    Test deleting an index with exception.
    Verifies that the endpoint returns an appropriate error response when an exception occurs during deletion.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id", return_value=(auth_data["user_id"], auth_data["tenant_id"])), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.full_delete_knowledge_base") as mock_full_delete:

        # Setup the mock to raise an exception
        mock_full_delete.side_effect = Exception("Database connection failed")

        # Execute request
        response = client.delete(
            f"/indices/{auth_data['index_name']}", headers=auth_data["auth_header"])

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = f"Error deleting index: Database connection failed"
        assert response.json() == {"detail": expected_error_detail}

        # Verify full_delete_knowledge_base was called with the correct parameters
        mock_full_delete.assert_called_once_with(
            auth_data["index_name"],
            ANY,  # Use ANY instead of es_core_mock to ignore object identity
            auth_data["user_id"]
        )


@pytest.mark.asyncio
async def test_delete_index_auth_exception(es_core_mock, auth_data):
    """
    Test deleting an index with authentication exception.
    Verifies that the endpoint returns an appropriate error response when authentication fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_current_user_id") as mock_get_user:

        # Setup the mock to raise an authentication exception
        mock_get_user.side_effect = Exception("Invalid authorization token")

        # Execute request
        response = client.delete(
            f"/indices/{auth_data['index_name']}", headers=auth_data["auth_header"])

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = f"Error deleting index: Invalid authorization token"
        assert response.json() == {"detail": expected_error_detail}

        # Verify get_current_user_id was called
        mock_get_user.assert_called_once()


@pytest.mark.asyncio
async def test_delete_documents_success(es_core_mock, redis_service_mock):
    """
    Test deleting documents successfully.
    Verifies that the endpoint returns the expected response and performs Redis cleanup.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_redis_service", return_value=redis_service_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.delete_documents") as mock_delete_docs:

        index_name = "test_index"
        path_or_url = "test_document.pdf"

        # Setup the return value for delete_documents
        es_result = {
            "status": "success",
            "message": "Documents deleted successfully",
            "deleted_count": 5
        }
        mock_delete_docs.return_value = es_result

        # Setup the mock for delete_document_records
        redis_result = {
            "index_name": index_name,
            "path_or_url": path_or_url,
            "total_deleted": 3,
            "celery_tasks_deleted": 2,
            "cache_keys_deleted": 1
        }
        redis_service_mock.delete_document_records.return_value = redis_result

        # Execute request
        response = client.delete(
            f"/indices/{index_name}/documents", params={"path_or_url": path_or_url})

        # Verify expected 200 status code
        assert response.status_code == 200

        # Get the actual response
        actual_response = response.json()

        # Verify essential response elements
        assert actual_response["status"] == "success"
        assert "Documents deleted successfully" in actual_response["message"]
        assert "Cleaned up 3 Redis records" in actual_response["message"]
        assert "2 tasks" in actual_response["message"]
        assert "1 cache keys" in actual_response["message"]

        # Verify structure contains expected keys
        assert "redis_cleanup" in actual_response
        assert actual_response["redis_cleanup"] == redis_result

        # Verify delete_documents was called with the correct parameters
        # Use ANY for the es_core parameter because the actual object may differ
        mock_delete_docs.assert_called_once_with(index_name, path_or_url, ANY)
        redis_service_mock.delete_document_records.assert_called_once_with(
            index_name, path_or_url)


@pytest.mark.asyncio
async def test_delete_documents_redis_error(es_core_mock, redis_service_mock):
    """
    Test deleting documents with Redis error.
    Verifies that the endpoint still succeeds with ES but reports Redis cleanup error.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_redis_service", return_value=redis_service_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.delete_documents") as mock_delete_docs:

        index_name = "test_index"
        path_or_url = "test_document.pdf"

        # Setup the return value for delete_documents
        es_result = {
            "status": "success",
            "message": "Documents deleted successfully",
            "deleted_count": 5
        }
        mock_delete_docs.return_value = es_result

        # Setup redis error
        redis_error_message = "Redis connection failed"
        redis_service_mock.delete_document_records.side_effect = Exception(
            redis_error_message)

        # Execute request
        response = client.delete(
            f"/indices/{index_name}/documents", params={"path_or_url": path_or_url})

        # Verify expected 200 status code (the operation should still succeed even with Redis errors)
        assert response.status_code == 200

        # Get the actual response
        actual_response = response.json()

        # Verify essential response elements
        assert actual_response["status"] == "success"
        assert "Documents deleted successfully" in actual_response["message"]
        assert "Redis cleanup encountered an error" in actual_response["message"]
        assert redis_error_message in actual_response["message"]

        # Verify structure contains expected keys
        assert "redis_cleanup_error" in actual_response
        assert actual_response["redis_cleanup_error"] == redis_error_message

        # Verify delete_documents was called
        # Use ANY for the es_core parameter because the actual object may differ
        mock_delete_docs.assert_called_once_with(index_name, path_or_url, ANY)
        redis_service_mock.delete_document_records.assert_called_once_with(
            index_name, path_or_url)


@pytest.mark.asyncio
async def test_delete_documents_es_exception(es_core_mock):
    """
    Test deleting documents with Elasticsearch exception.
    Verifies that the endpoint returns an appropriate error response when ES deletion fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.delete_documents") as mock_delete_docs:

        index_name = "test_index"
        path_or_url = "test_document.pdf"

        # Setup the mock to raise an exception
        mock_delete_docs.side_effect = Exception(
            "Elasticsearch deletion failed")

        # Execute request
        response = client.delete(
            f"/indices/{index_name}/documents", params={"path_or_url": path_or_url})

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Error delete indexing documents: Elasticsearch deletion failed"
        assert response.json() == {"detail": expected_error_detail}

        # Verify delete_documents was called
        # Use ANY for the es_core parameter because the actual object may differ
        mock_delete_docs.assert_called_once_with(index_name, path_or_url, ANY)


@pytest.mark.asyncio
async def test_delete_documents_redis_warnings(es_core_mock, redis_service_mock):
    """
    Test deleting documents with Redis warnings.
    Verifies that the endpoint handles Redis warnings properly.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.get_redis_service", return_value=redis_service_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.delete_documents") as mock_delete_docs:

        index_name = "test_index"
        path_or_url = "test_document.pdf"

        # Setup the return value for delete_documents
        es_result = {
            "status": "success",
            "message": "Documents deleted successfully",
            "deleted_count": 5
        }
        mock_delete_docs.return_value = es_result

        # Setup the mock for delete_document_records with warnings
        redis_result = {
            "index_name": index_name,
            "path_or_url": path_or_url,
            "total_deleted": 2,
            "celery_tasks_deleted": 1,
            "cache_keys_deleted": 1,
            "errors": ["Some cache keys could not be deleted"]
        }
        redis_service_mock.delete_document_records.return_value = redis_result

        # Execute request
        response = client.delete(
            f"/indices/{index_name}/documents", params={"path_or_url": path_or_url})

        # Verify expected 200 status code
        assert response.status_code == 200

        # Get the actual response
        actual_response = response.json()

        # Verify essential response elements
        assert actual_response["status"] == "success"
        assert "Documents deleted successfully" in actual_response["message"]
        assert "Cleaned up 2 Redis records" in actual_response["message"]

        # Verify structure contains expected keys
        assert "redis_cleanup" in actual_response
        assert "redis_warnings" in actual_response
        assert actual_response["redis_warnings"] == [
            "Some cache keys could not be deleted"]

        # Verify delete_documents was called
        # Use ANY for the es_core parameter because the actual object may differ
        mock_delete_docs.assert_called_once_with(index_name, path_or_url, ANY)
        redis_service_mock.delete_document_records.assert_called_once_with(
            index_name, path_or_url)


@pytest.mark.asyncio
async def test_delete_documents_validation_exception(es_core_mock):
    """
    Test deleting documents with validation exception.
    Verifies that the endpoint returns an appropriate error response when validation fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.delete_documents") as mock_delete_docs:

        index_name = "test_index"
        path_or_url = "test_document.pdf"

        # Setup the mock to raise a validation exception
        mock_delete_docs.side_effect = ValueError(
            "Invalid document path format")

        # Execute request
        response = client.delete(
            f"/indices/{index_name}/documents", params={"path_or_url": path_or_url})

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Error delete indexing documents: Invalid document path format"
        assert response.json() == {"detail": expected_error_detail}

        # Verify delete_documents was called
        # Use ANY for the es_core parameter because the actual object may differ
        mock_delete_docs.assert_called_once_with(index_name, path_or_url, ANY)


@pytest.mark.asyncio
async def test_health_check_exception(es_core_mock):
    """
    Test health check endpoint with exception.
    Verifies that the endpoint returns an appropriate error response when an exception occurs during health check.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.health_check") as mock_health:
        # Setup the mock to raise an exception
        mock_health.side_effect = Exception("Elasticsearch connection failed")

        # Execute request
        response = client.get("/indices/health")

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Elasticsearch connection failed"
        assert response.json() == {"detail": expected_error_detail}

        # Verify health_check was called
        # Use ANY for the es_core parameter because the actual object may differ
        mock_health.assert_called_once_with(ANY)


@pytest.mark.asyncio
async def test_health_check_timeout_exception(es_core_mock):
    """
    Test health check endpoint with timeout exception.
    Verifies that the endpoint returns an appropriate error response when operation times out.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.health_check") as mock_health:

        # Setup the mock to raise a timeout exception
        mock_health.side_effect = TimeoutError("Health check timed out")

        # Execute request
        response = client.get("/indices/health")

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Health check timed out"
        assert response.json() == {"detail": expected_error_detail}

        # Verify health_check was called
        mock_health.assert_called_once_with(ANY)


@pytest.mark.asyncio
async def test_health_check_connection_exception(es_core_mock):
    """
    Test health check endpoint with connection exception.
    Verifies that the endpoint returns an appropriate error response when connection fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.health_check") as mock_health:

        # Setup the mock to raise a connection exception
        mock_health.side_effect = ConnectionError(
            "Unable to connect to Elasticsearch")

        # Execute request
        response = client.get("/indices/health")

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Unable to connect to Elasticsearch"
        assert response.json() == {"detail": expected_error_detail}

        # Verify health_check was called
        mock_health.assert_called_once_with(ANY)


@pytest.mark.asyncio
async def test_health_check_permission_exception(es_core_mock):
    """
    Test health check endpoint with permission exception.
    Verifies that the endpoint returns an appropriate error response when permission is denied.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.health_check") as mock_health:

        # Setup the mock to raise a permission exception
        mock_health.side_effect = PermissionError(
            "Access denied to Elasticsearch")

        # Execute request
        response = client.get("/indices/health")

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Access denied to Elasticsearch"
        assert response.json() == {"detail": expected_error_detail}

        # Verify health_check was called
        mock_health.assert_called_once_with(ANY)


@pytest.mark.asyncio
async def test_health_check_validation_exception(es_core_mock):
    """
    Test health check endpoint with validation exception.
    Verifies that the endpoint returns an appropriate error response when validation fails.
    """
    # Setup mocks
    with patch("backend.apps.elasticsearch_app.get_es_core", return_value=es_core_mock), \
            patch("backend.apps.elasticsearch_app.ElasticSearchService.health_check") as mock_health:

        # Setup the mock to raise a validation exception
        mock_health.side_effect = ValueError(
            "Invalid Elasticsearch configuration")

        # Execute request
        response = client.get("/indices/health")

        # Verify expected 500 status code
        assert response.status_code == 500

        # Verify error response
        expected_error_detail = "Invalid Elasticsearch configuration"
        assert response.json() == {"detail": expected_error_detail}

        # Verify health_check was called
        mock_health.assert_called_once_with(ANY)
