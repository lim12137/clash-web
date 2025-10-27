import pytest
from unittest.mock import MagicMock, patch
import time
from typing import List, Dict, Any

# Import the class under test
from sdk.nexent.vector_database.elasticsearch_core import ElasticSearchCore


# ----------------------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------------------

@pytest.fixture
def elasticsearch_core_instance():
    """Create an ElasticSearchCore instance for testing."""
    return ElasticSearchCore(
        host="http://localhost:9200",
        api_key="test_api_key",
        verify_certs=False,
        ssl_show_warn=False
    )


@pytest.fixture
def sample_documents():
    """Sample documents for testing."""
    return [
        {
            "content": "This is test content 1",
            "title": "Test Document 1",
            "filename": "test1.pdf",
            "path_or_url": "/path/to/test1.pdf"
        },
        {
            "content": "This is test content 2",
            "title": "Test Document 2",
            "filename": "test2.pdf",
            "path_or_url": "/path/to/test2.pdf",
            "file_size": 1024,
            "create_time": "2025-01-15T10:30:00",
            "date": "2025-01-15",
            "process_source": "CustomProcessor",
            "id": "existing_id_123"
        }
    ]


# ----------------------------------------------------------------------------
# Tests for _preprocess_documents method
# ----------------------------------------------------------------------------

def test_preprocess_documents_with_complete_document(elasticsearch_core_instance, sample_documents):
    """Test preprocessing a document that already has all required fields."""
    # Use the second document which has all fields
    complete_doc = [sample_documents[1]]
    content_field = "content"
    
    result = elasticsearch_core_instance._preprocess_documents(complete_doc, content_field)
    
    assert len(result) == 1
    doc = result[0]
    
    # Should preserve existing values
    assert doc["content"] == "This is test content 2"
    assert doc["title"] == "Test Document 2"
    assert doc["filename"] == "test2.pdf"
    assert doc["path_or_url"] == "/path/to/test2.pdf"
    assert doc["file_size"] == 1024
    assert doc["create_time"] == "2025-01-15T10:30:00"
    assert doc["date"] == "2025-01-15"
    assert doc["process_source"] == "CustomProcessor"
    assert doc["id"] == "existing_id_123"


def test_preprocess_documents_with_incomplete_document(elasticsearch_core_instance, sample_documents):
    """Test preprocessing a document missing required fields."""
    # Use the first document which is missing several fields
    incomplete_doc = [sample_documents[0]]
    content_field = "content"
    
    with patch('time.strftime') as mock_strftime, \
         patch('time.time') as mock_time, \
         patch('time.gmtime') as mock_gmtime:
        
        # Mock time functions
        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_gmtime.return_value = None
        
        result = elasticsearch_core_instance._preprocess_documents(incomplete_doc, content_field)
    
    assert len(result) == 1
    doc = result[0]
    
    # Should preserve existing values
    assert doc["content"] == "This is test content 1"
    assert doc["title"] == "Test Document 1"
    assert doc["filename"] == "test1.pdf"
    assert doc["path_or_url"] == "/path/to/test1.pdf"
    
    # Should add missing fields with default values
    assert doc["create_time"] == "2025-01-15T10:30:00"
    assert doc["date"] == "2025-01-15"
    assert doc["file_size"] == 0
    assert doc["process_source"] == "Unstructured"
    
    # Should generate an ID
    assert "id" in doc
    assert doc["id"].startswith("1642234567_")
    assert len(doc["id"]) <= 20


def test_preprocess_documents_with_multiple_documents(elasticsearch_core_instance, sample_documents):
    """Test preprocessing multiple documents."""
    content_field = "content"
    
    with patch('time.strftime') as mock_strftime, \
         patch('time.time') as mock_time, \
         patch('time.gmtime') as mock_gmtime:
        
        # Mock time functions
        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_gmtime.return_value = None
        
        result = elasticsearch_core_instance._preprocess_documents(sample_documents, content_field)
    
    assert len(result) == 2
    
    # First document should have defaults added
    doc1 = result[0]
    assert doc1["create_time"] == "2025-01-15T10:30:00"
    assert doc1["date"] == "2025-01-15"
    assert doc1["file_size"] == 0
    assert doc1["process_source"] == "Unstructured"
    assert "id" in doc1
    
    # Second document should preserve existing values
    doc2 = result[1]
    assert doc2["create_time"] == "2025-01-15T10:30:00"
    assert doc2["date"] == "2025-01-15"
    assert doc2["file_size"] == 1024
    assert doc2["process_source"] == "CustomProcessor"
    assert doc2["id"] == "existing_id_123"


def test_preprocess_documents_preserves_original_data(elasticsearch_core_instance):
    """Test that original documents are not modified."""
    original_docs = [
        {
            "content": "Original content",
            "title": "Original title"
        }
    ]
    content_field = "content"
    
    with patch('time.strftime') as mock_strftime, \
         patch('time.time') as mock_time, \
         patch('time.gmtime') as mock_gmtime:
        
        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_gmtime.return_value = None
        
        result = elasticsearch_core_instance._preprocess_documents(original_docs, content_field)
    
    # Original document should remain unchanged
    assert original_docs[0] == {"content": "Original content", "title": "Original title"}
    
    # Result should be a new document with added fields
    assert result[0]["content"] == "Original content"
    assert result[0]["title"] == "Original title"
    assert "create_time" in result[0]
    assert "date" in result[0]
    assert "file_size" in result[0]
    assert "process_source" in result[0]
    assert "id" in result[0]


def test_preprocess_documents_with_empty_list(elasticsearch_core_instance):
    """Test preprocessing an empty list of documents."""
    content_field = "content"
    
    result = elasticsearch_core_instance._preprocess_documents([], content_field)
    
    assert result == []


def test_preprocess_documents_id_generation(elasticsearch_core_instance):
    """Test that ID generation works correctly with different content."""
    docs = [
        {"content": "Content 1"},
        {"content": "Content 2"},
        {"content": "Content 1"}  # Same content as first
    ]
    content_field = "content"
    
    with patch('time.strftime') as mock_strftime, \
         patch('time.time') as mock_time, \
         patch('time.gmtime') as mock_gmtime:
        
        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_gmtime.return_value = None
        
        result = elasticsearch_core_instance._preprocess_documents(docs, content_field)
    
    assert len(result) == 3
    
    # All documents should have IDs
    assert "id" in result[0]
    assert "id" in result[1]
    assert "id" in result[2]
    
    # IDs should be different for different content
    assert result[0]["id"] != result[1]["id"]
    
    # Same content should generate same hash part (but might be different due to time)
    id1_parts = result[0]["id"].split("_")
    id3_parts = result[2]["id"].split("_")
    assert len(id1_parts) == 2
    assert len(id3_parts) == 2
    assert id1_parts[1] == id3_parts[1]  # Hash part should be same


def test_preprocess_documents_with_none_values(elasticsearch_core_instance):
    """Test preprocessing documents with None values."""
    docs = [
        {
            "content": "Test content",
            "file_size": None,
            "create_time": None,
            "date": None,
            "process_source": None
        }
    ]
    content_field = "content"
    
    with patch('time.strftime') as mock_strftime, \
         patch('time.time') as mock_time, \
         patch('time.gmtime') as mock_gmtime:
        
        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_gmtime.return_value = None
        
        result = elasticsearch_core_instance._preprocess_documents(docs, content_field)
    
    doc = result[0]
    
    # None values should be replaced with defaults
    assert doc["file_size"] == 0
    assert doc["create_time"] == "2025-01-15T10:30:00"
    assert doc["date"] == "2025-01-15"
    assert doc["process_source"] == "Unstructured"
    assert "id" in doc


def test_preprocess_documents_with_zero_values(elasticsearch_core_instance):
    """Test that zero values are preserved and not replaced."""
    docs = [
        {
            "content": "Test content",
            "file_size": 0,
            "create_time": "2025-01-15T10:30:00",
            "date": "2025-01-15",
            "process_source": "CustomProcessor"
        }
    ]
    content_field = "content"
    
    with patch('time.strftime') as mock_strftime, \
         patch('time.time') as mock_time, \
         patch('time.gmtime') as mock_gmtime:
        
        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_gmtime.return_value = None
        
        result = elasticsearch_core_instance._preprocess_documents(docs, content_field)
    
    doc = result[0]
    
    # Zero values should be preserved
    assert doc["file_size"] == 0
    assert doc["create_time"] == "2025-01-15T10:30:00"
    assert doc["date"] == "2025-01-15"
    assert doc["process_source"] == "CustomProcessor"


def test_preprocess_large_batch_of_documents(elasticsearch_core_instance):
    """Test preprocessing a large batch of documents (100+ chunks scenario)."""
    # Simulate processing a large file that generates 150 chunks
    large_docs = [
        {
            "content": f"Chunk content number {i}",
            "title": f"Document chunk {i}",
            "filename": "large_document.pdf",
            "path_or_url": "/path/to/large_document.pdf"
        }
        for i in range(150)
    ]
    content_field = "content"

    with patch('time.strftime') as mock_strftime, \
            patch('time.time') as mock_time, \
            patch('time.gmtime') as mock_gmtime:

        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_gmtime.return_value = None

        result = elasticsearch_core_instance._preprocess_documents(
            large_docs, content_field)

    # Should process all 150 documents
    assert len(result) == 150

    # Verify each document has required fields
    for i, doc in enumerate(result):
        assert doc["content"] == f"Chunk content number {i}"
        assert doc["title"] == f"Document chunk {i}"
        assert doc["filename"] == "large_document.pdf"
        assert doc["path_or_url"] == "/path/to/large_document.pdf"
        assert "create_time" in doc
        assert "date" in doc
        assert "file_size" in doc
        assert "process_source" in doc
        assert "id" in doc


def test_preprocess_documents_performance_with_large_batch(elasticsearch_core_instance):
    """Test that preprocessing performance is acceptable for large batches."""
    import time as time_module

    # Create 200 documents to test performance
    large_docs = [
        {
            "content": f"Content {i}" * 100,  # Longer content
            "title": f"Title {i}",
            "filename": f"file_{i}.txt"
        }
        for i in range(200)
    ]
    content_field = "content"

    with patch('time.strftime') as mock_strftime, \
            patch('time.time') as mock_time, \
            patch('time.gmtime') as mock_gmtime:

        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_gmtime.return_value = None

        start = time_module.time()
        result = elasticsearch_core_instance._preprocess_documents(
            large_docs, content_field)
        elapsed = time_module.time() - start

    # Should complete in reasonable time (< 5 seconds for 200 docs)
    assert elapsed < 5.0

    # All documents should be processed
    assert len(result) == 200


def test_preprocess_documents_maintains_order(elasticsearch_core_instance):
    """Test that document order is preserved during preprocessing."""
    docs = [
        {"content": f"Content {i}", "sequence": i}
        for i in range(50)
    ]
    content_field = "content"

    with patch('time.strftime') as mock_strftime, \
            patch('time.time') as mock_time, \
            patch('time.gmtime') as mock_gmtime:

        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_gmtime.return_value = None

        result = elasticsearch_core_instance._preprocess_documents(
            docs, content_field)

    # Verify order is maintained
    for i, doc in enumerate(result):
        assert doc["sequence"] == i
        assert doc["content"] == f"Content {i}"


# ----------------------------------------------------------------------------
# Tests for index management methods
# ----------------------------------------------------------------------------

def test_create_vector_index_success(elasticsearch_core_instance):
    """Test creating a new vector index successfully."""
    with patch.object(elasticsearch_core_instance.client.indices, 'exists') as mock_exists, \
            patch.object(elasticsearch_core_instance.client.indices, 'create') as mock_create, \
            patch.object(elasticsearch_core_instance, '_force_refresh_with_retry') as mock_refresh, \
            patch.object(elasticsearch_core_instance, '_ensure_index_ready') as mock_ready:

        mock_exists.return_value = False
        mock_create.return_value = {"acknowledged": True}
        mock_refresh.return_value = True
        mock_ready.return_value = True

        result = elasticsearch_core_instance.create_vector_index(
            "test_index", embedding_dim=1024)

        assert result is True
        mock_exists.assert_called_once_with(index="test_index")
        mock_create.assert_called_once()
        mock_refresh.assert_called_once_with("test_index")
        mock_ready.assert_called_once_with("test_index")


def test_create_vector_index_already_exists(elasticsearch_core_instance):
    """Test creating an index that already exists."""
    with patch.object(elasticsearch_core_instance.client.indices, 'exists') as mock_exists, \
            patch.object(elasticsearch_core_instance, '_ensure_index_ready') as mock_ready:

        mock_exists.return_value = True
        mock_ready.return_value = True

        result = elasticsearch_core_instance.create_vector_index(
            "existing_index")

        assert result is True
        mock_exists.assert_called_once_with(index="existing_index")
        mock_ready.assert_called_once_with("existing_index")


def test_delete_index_success(elasticsearch_core_instance):
    """Test deleting an index successfully."""
    with patch.object(elasticsearch_core_instance.client.indices, 'delete') as mock_delete:
        mock_delete.return_value = {"acknowledged": True}

        result = elasticsearch_core_instance.delete_index("test_index")

        assert result is True
        mock_delete.assert_called_once_with(index="test_index")


def test_delete_index_not_found(elasticsearch_core_instance):
    """Test deleting an index that doesn't exist."""
    from elasticsearch import exceptions

    with patch.object(elasticsearch_core_instance.client.indices, 'delete') as mock_delete:
        mock_delete.side_effect = exceptions.NotFoundError(
            "Index not found", {}, {})

        result = elasticsearch_core_instance.delete_index("nonexistent_index")

        assert result is False
        mock_delete.assert_called_once_with(index="nonexistent_index")


def test_get_user_indices_success(elasticsearch_core_instance):
    """Test getting user indices successfully."""
    with patch.object(elasticsearch_core_instance.client.indices, 'get_alias') as mock_get_alias:
        mock_get_alias.return_value = {
            "user_index_1": {},
            "user_index_2": {},
            ".system_index": {}
        }

        result = elasticsearch_core_instance.get_user_indices()

        assert len(result) == 2
        assert "user_index_1" in result
        assert "user_index_2" in result
        assert ".system_index" not in result


# ----------------------------------------------------------------------------
# Tests for document operations
# ----------------------------------------------------------------------------

def test_index_documents_empty_list(elasticsearch_core_instance):
    """Test indexing an empty list of documents."""
    mock_embedding_model = MagicMock()

    result = elasticsearch_core_instance.index_documents(
        "test_index",
        mock_embedding_model,
        [],
        content_field="content"
    )

    assert result == 0


def test_index_documents_small_batch(elasticsearch_core_instance):
    """Test indexing a small batch of documents (< 64)."""
    mock_embedding_model = MagicMock()
    mock_embedding_model.get_embeddings.return_value = [[0.1] * 1024] * 3
    mock_embedding_model.embedding_model_name = "test-model"

    documents = [
        {"content": "Test content 1", "title": "Test 1"},
        {"content": "Test content 2", "title": "Test 2"},
        {"content": "Test content 3", "title": "Test 3"}
    ]

    with patch.object(elasticsearch_core_instance.client, 'bulk') as mock_bulk, \
            patch('time.strftime') as mock_strftime, \
            patch('time.time') as mock_time:

        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_bulk.return_value = {"errors": False, "items": []}

        result = elasticsearch_core_instance.index_documents(
            "test_index",
            mock_embedding_model,
            documents,
            content_field="content"
        )

        assert result == 3
        mock_embedding_model.get_embeddings.assert_called_once()
        mock_bulk.assert_called_once()


def test_index_documents_large_batch(elasticsearch_core_instance):
    """Test indexing a large batch of documents (>= 64)."""
    mock_embedding_model = MagicMock()
    mock_embedding_model.get_embeddings.return_value = [[0.1] * 1024] * 64
    mock_embedding_model.embedding_model_name = "test-model"

    documents = [
        {"content": f"Test content {i}", "title": f"Test {i}"}
        for i in range(100)
    ]

    with patch.object(elasticsearch_core_instance.client, 'bulk') as mock_bulk, \
            patch.object(elasticsearch_core_instance, '_force_refresh_with_retry') as mock_refresh, \
            patch('time.strftime') as mock_strftime, \
            patch('time.time') as mock_time, \
            patch('time.sleep'):

        mock_strftime.side_effect = lambda fmt, t: "2025-01-15T10:30:00" if "T" in fmt else "2025-01-15"
        mock_time.return_value = 1642234567
        mock_bulk.return_value = {"errors": False, "items": []}
        mock_refresh.return_value = True

        result = elasticsearch_core_instance.index_documents(
            "test_index",
            mock_embedding_model,
            documents,
            batch_size=64,
            content_field="content"
        )

        assert result == 100
        assert mock_embedding_model.get_embeddings.call_count >= 2
        mock_bulk.assert_called()
        mock_refresh.assert_called_once_with("test_index")


def test_delete_documents_by_path_or_url_success(elasticsearch_core_instance):
    """Test deleting documents by path_or_url successfully."""
    with patch.object(elasticsearch_core_instance.client, 'delete_by_query') as mock_delete:
        mock_delete.return_value = {"deleted": 5}

        result = elasticsearch_core_instance.delete_documents_by_path_or_url(
            "test_index",
            "/path/to/file.pdf"
        )

        assert result == 5
        mock_delete.assert_called_once()


# ----------------------------------------------------------------------------
# Tests for search operations
# ----------------------------------------------------------------------------

def test_accurate_search_success(elasticsearch_core_instance):
    """Test accurate search with text matching."""
    with patch.object(elasticsearch_core_instance, 'exec_query') as mock_exec, \
            patch('sdk.nexent.vector_database.elasticsearch_core.calculate_term_weights') as mock_weights, \
            patch('sdk.nexent.vector_database.elasticsearch_core.build_weighted_query') as mock_build:

        mock_weights.return_value = {"test": 1.0}
        mock_build.return_value = {
            "query": {"match": {"content": "test query"}}}
        mock_exec.return_value = [
            {
                "score": 10.5,
                "document": {"content": "Test document", "title": "Test"},
                "index": "test_index"
            }
        ]

        result = elasticsearch_core_instance.accurate_search(
            ["test_index"],
            "test query",
            top_k=5
        )

        assert len(result) == 1
        assert result[0]["score"] == 10.5
        mock_weights.assert_called_once_with("test query")
        mock_build.assert_called_once_with("test query", {"test": 1.0})
        mock_exec.assert_called_once()


def test_semantic_search_success(elasticsearch_core_instance):
    """Test semantic search with vector similarity."""
    mock_embedding_model = MagicMock()
    mock_embedding_model.get_embeddings.return_value = [[0.1] * 1024]

    with patch.object(elasticsearch_core_instance, 'exec_query') as mock_exec:
        mock_exec.return_value = [
            {
                "score": 0.95,
                "document": {"content": "Similar document", "title": "Doc"},
                "index": "test_index"
            }
        ]

        result = elasticsearch_core_instance.semantic_search(
            ["test_index"],
            "test query",
            mock_embedding_model,
            top_k=5
        )

        assert len(result) == 1
        assert result[0]["score"] == 0.95
        mock_embedding_model.get_embeddings.assert_called_once_with(
            "test query")
        mock_exec.assert_called_once()


def test_hybrid_search_success(elasticsearch_core_instance):
    """Test hybrid search combining accurate and semantic results."""
    mock_embedding_model = MagicMock()

    with patch.object(elasticsearch_core_instance, 'accurate_search') as mock_accurate, \
            patch.object(elasticsearch_core_instance, 'semantic_search') as mock_semantic:

        mock_accurate.return_value = [
            {
                "score": 10.0,
                "document": {"id": "doc1", "content": "Test doc 1"},
                "index": "test_index"
            }
        ]

        mock_semantic.return_value = [
            {
                "score": 0.9,
                "document": {"id": "doc1", "content": "Test doc 1"},
                "index": "test_index"
            },
            {
                "score": 0.8,
                "document": {"id": "doc2", "content": "Test doc 2"},
                "index": "test_index"
            }
        ]

        result = elasticsearch_core_instance.hybrid_search(
            ["test_index"],
            "test query",
            mock_embedding_model,
            top_k=5,
            weight_accurate=0.3
        )

        assert len(result) == 2
        assert all("score" in r for r in result)
        assert all("document" in r for r in result)
        mock_accurate.assert_called_once()
        mock_semantic.assert_called_once()


# ----------------------------------------------------------------------------
# Tests for statistics and monitoring
# ----------------------------------------------------------------------------

def test_get_file_list_with_details_success(elasticsearch_core_instance):
    """Test getting file list with details."""
    with patch.object(elasticsearch_core_instance.client, 'search') as mock_search:
        mock_search.return_value = {
            "aggregations": {
                "unique_sources": {
                    "buckets": [
                        {
                            "file_sample": {
                                "hits": {
                                    "hits": [
                                        {
                                            "_source": {
                                                "path_or_url": "/path/to/file1.pdf",
                                                "filename": "file1.pdf",
                                                "file_size": 1024,
                                                "create_time": "2025-01-15T10:30:00"
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            }
        }

        result = elasticsearch_core_instance.get_file_list_with_details(
            "test_index")

        assert len(result) == 1
        assert result[0]["path_or_url"] == "/path/to/file1.pdf"
        assert result[0]["filename"] == "file1.pdf"
        assert result[0]["file_size"] == 1024
        mock_search.assert_called_once()


def test_get_index_mapping_success(elasticsearch_core_instance):
    """Test getting index mapping."""
    with patch.object(elasticsearch_core_instance.client.indices, 'get_mapping') as mock_get_mapping:
        mock_get_mapping.return_value = {
            "test_index": {
                "mappings": {
                    "properties": {
                        "content": {"type": "text"},
                        "embedding": {"type": "dense_vector"}
                    }
                }
            }
        }

        result = elasticsearch_core_instance.get_index_mapping(["test_index"])

        assert "test_index" in result
        assert "content" in result["test_index"]
        assert "embedding" in result["test_index"]
        mock_get_mapping.assert_called_once()


def test_get_index_stats_success(elasticsearch_core_instance):
    """Test getting index statistics."""
    with patch.object(elasticsearch_core_instance.client.indices, 'stats') as mock_stats, \
            patch.object(elasticsearch_core_instance.client.indices, 'get_settings') as mock_settings, \
            patch.object(elasticsearch_core_instance.client, 'search') as mock_search:

        mock_stats.return_value = {
            "indices": {
                "test_index": {
                    "primaries": {
                        "docs": {"count": 100},
                        "store": {"size_in_bytes": 1024000},
                        "search": {"query_total": 50},
                        "request_cache": {"hit_count": 25}
                    }
                }
            }
        }

        mock_settings.return_value = {
            "test_index": {
                "settings": {
                    "index": {
                        "creation_date": "1642234567000"
                    }
                }
            }
        }

        mock_search.return_value = {
            "aggregations": {
                "unique_path_or_url_count": {"value": 10},
                "process_sources": {"buckets": [{"key": "Unstructured"}]},
                "embedding_models": {"buckets": [{"key": "test-model"}]}
            }
        }

        result = elasticsearch_core_instance.get_index_stats(
            ["test_index"], embedding_dim=1024)

        assert "test_index" in result
        assert result["test_index"]["base_info"]["doc_count"] == 10
        assert result["test_index"]["base_info"]["chunk_count"] == 100
        mock_stats.assert_called_once()
        mock_settings.assert_called_once()
        mock_search.assert_called_once()


# ----------------------------------------------------------------------------
# Tests for error handling
# ----------------------------------------------------------------------------

def test_handle_bulk_errors_with_errors(elasticsearch_core_instance):
    """Test handling bulk operation errors."""
    response = {
        "errors": True,
        "items": [
            {
                "index": {
                    "error": {
                        "type": "mapper_parsing_exception",
                        "reason": "Failed to parse mapping"
                    }
                }
            }
        ]
    }

    # Should not raise exception, just log errors
    elasticsearch_core_instance._handle_bulk_errors(response)


def test_handle_bulk_errors_version_conflict(elasticsearch_core_instance):
    """Test handling version conflict errors (should be ignored)."""
    response = {
        "errors": True,
        "items": [
            {
                "index": {
                    "error": {
                        "type": "version_conflict_engine_exception",
                        "reason": "Version conflict"
                    }
                }
            }
        ]
    }

    # Should not raise exception or log error for version conflicts
    elasticsearch_core_instance._handle_bulk_errors(response)


def test_bulk_operation_context(elasticsearch_core_instance):
    """Test bulk operation context manager."""
    with patch.object(elasticsearch_core_instance, '_apply_bulk_settings') as mock_apply, \
            patch.object(elasticsearch_core_instance, '_restore_normal_settings') as mock_restore:

        with elasticsearch_core_instance.bulk_operation_context("test_index", estimated_duration=60) as operation_id:
            assert operation_id is not None
            assert "bulk_" in operation_id

        mock_apply.assert_called_once_with("test_index")
        mock_restore.assert_called_once_with("test_index")
