"""
Supplementary test module for elasticsearch_core to improve code coverage

Tests for functions not fully covered in the main test file.
"""
import pytest
from unittest.mock import MagicMock, patch, mock_open
import time
import os
import sys
from typing import List, Dict, Any

# Add the project root to the path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "../../.."))
sys.path.insert(0, project_root)

# Import the class under test
from sdk.nexent.vector_database.elasticsearch_core import ElasticSearchCore
from elasticsearch import exceptions


class TestElasticSearchCoreCoverage:
    """Test class for improving elasticsearch_core coverage"""
    
    @pytest.fixture
    def es_core(self):
        """Create an ElasticSearchCore instance for testing."""
        return ElasticSearchCore(
            host="http://localhost:9200",
            api_key="test_api_key",
            verify_certs=False,
            ssl_show_warn=False
        )
    
    def test_force_refresh_with_retry_success(self, es_core):
        """Test _force_refresh_with_retry successful refresh"""
        es_core.client = MagicMock()
        es_core.client.indices.refresh.return_value = {"_shards": {"total": 1, "successful": 1}}
        
        result = es_core._force_refresh_with_retry("test_index")
        assert result is True
        es_core.client.indices.refresh.assert_called_once_with(index="test_index")
    
    def test_force_refresh_with_retry_failure_retry(self, es_core):
        """Test _force_refresh_with_retry with retries"""
        es_core.client = MagicMock()
        es_core.client.indices.refresh.side_effect = [
            Exception("Connection error"),
            Exception("Still failing"),
            {"_shards": {"total": 1, "successful": 1}}
        ]
        
        with patch('time.sleep'):  # Mock sleep to speed up test
            result = es_core._force_refresh_with_retry("test_index", max_retries=3)
            assert result is True
            assert es_core.client.indices.refresh.call_count == 3
    
    def test_force_refresh_with_retry_max_retries_exceeded(self, es_core):
        """Test _force_refresh_with_retry when max retries exceeded"""
        es_core.client = MagicMock()
        es_core.client.indices.refresh.side_effect = Exception("Persistent error")
        
        with patch('time.sleep'):  # Mock sleep to speed up test
            result = es_core._force_refresh_with_retry("test_index", max_retries=2)
            assert result is False
            assert es_core.client.indices.refresh.call_count == 2
    
    def test_ensure_index_ready_success(self, es_core):
        """Test _ensure_index_ready successful case"""
        es_core.client = MagicMock()
        es_core.client.cluster.health.return_value = {"status": "green"}
        es_core.client.search.return_value = {"hits": {"total": {"value": 0}}}
        
        result = es_core._ensure_index_ready("test_index")
        assert result is True
    
    def test_ensure_index_ready_yellow_status(self, es_core):
        """Test _ensure_index_ready with yellow status"""
        es_core.client = MagicMock()
        es_core.client.cluster.health.return_value = {"status": "yellow"}
        es_core.client.search.return_value = {"hits": {"total": {"value": 0}}}
        
        result = es_core._ensure_index_ready("test_index")
        assert result is True
    
    def test_ensure_index_ready_timeout(self, es_core):
        """Test _ensure_index_ready timeout scenario"""
        es_core.client = MagicMock()
        es_core.client.cluster.health.return_value = {"status": "red"}
        
        with patch('time.sleep'):  # Mock sleep to speed up test
            result = es_core._ensure_index_ready("test_index", timeout=1)
            assert result is False
    
    def test_ensure_index_ready_exception(self, es_core):
        """Test _ensure_index_ready with exception"""
        es_core.client = MagicMock()
        es_core.client.cluster.health.side_effect = Exception("Connection error")
        
        with patch('time.sleep'):  # Mock sleep to speed up test
            result = es_core._ensure_index_ready("test_index", timeout=1)
            assert result is False
    
    def test_apply_bulk_settings_success(self, es_core):
        """Test _apply_bulk_settings successful case"""
        es_core.client = MagicMock()
        es_core.client.indices.put_settings.return_value = {"acknowledged": True}
        
        es_core._apply_bulk_settings("test_index")
        es_core.client.indices.put_settings.assert_called_once()
    
    def test_apply_bulk_settings_failure(self, es_core):
        """Test _apply_bulk_settings with exception"""
        es_core.client = MagicMock()
        es_core.client.indices.put_settings.side_effect = Exception("Settings error")
        
        # Should not raise exception, just log warning
        es_core._apply_bulk_settings("test_index")
        es_core.client.indices.put_settings.assert_called_once()
    
    def test_restore_normal_settings_success(self, es_core):
        """Test _restore_normal_settings successful case"""
        es_core.client = MagicMock()
        es_core.client.indices.put_settings.return_value = {"acknowledged": True}
        es_core._force_refresh_with_retry = MagicMock(return_value=True)
        
        es_core._restore_normal_settings("test_index")
        es_core.client.indices.put_settings.assert_called_once()
        es_core._force_refresh_with_retry.assert_called_once_with("test_index")
    
    def test_restore_normal_settings_failure(self, es_core):
        """Test _restore_normal_settings with exception"""
        es_core.client = MagicMock()
        es_core.client.indices.put_settings.side_effect = Exception("Settings error")
        
        # Should not raise exception, just log warning
        es_core._restore_normal_settings("test_index")
        es_core.client.indices.put_settings.assert_called_once()
    
    def test_delete_index_success(self, es_core):
        """Test delete_index successful case"""
        es_core.client = MagicMock()
        es_core.client.indices.delete.return_value = {"acknowledged": True}
        
        result = es_core.delete_index("test_index")
        assert result is True
        es_core.client.indices.delete.assert_called_once_with(index="test_index")
    
    def test_delete_index_not_found(self, es_core):
        """Test delete_index when index not found"""
        es_core.client = MagicMock()
        # Create a proper NotFoundError with required parameters
        not_found_error = exceptions.NotFoundError(404, "Index not found", {"error": {"type": "index_not_found_exception"}})
        es_core.client.indices.delete.side_effect = not_found_error
        
        result = es_core.delete_index("test_index")
        assert result is False
        es_core.client.indices.delete.assert_called_once_with(index="test_index")
    
    def test_delete_index_general_exception(self, es_core):
        """Test delete_index with general exception"""
        es_core.client = MagicMock()
        es_core.client.indices.delete.side_effect = Exception("General error")
        
        result = es_core.delete_index("test_index")
        assert result is False
        es_core.client.indices.delete.assert_called_once_with(index="test_index")
    
    def test_handle_bulk_errors_no_errors(self, es_core):
        """Test _handle_bulk_errors when no errors in response"""
        response = {"errors": False, "items": []}
        es_core._handle_bulk_errors(response)
        # Should not raise any exceptions
    
    def test_handle_bulk_errors_with_version_conflict(self, es_core):
        """Test _handle_bulk_errors with version conflict (should be ignored)"""
        response = {
            "errors": True,
            "items": [
                {
                    "index": {
                        "error": {
                            "type": "version_conflict_engine_exception",
                            "reason": "Document already exists",
                            "caused_by": {
                                "type": "version_conflict",
                                "reason": "Document version conflict"
                            }
                        }
                    }
                }
            ]
        }
        es_core._handle_bulk_errors(response)
        # Should not raise any exceptions for version conflicts
    
    def test_handle_bulk_errors_with_fatal_error(self, es_core):
        """Test _handle_bulk_errors with fatal error"""
        response = {
            "errors": True,
            "items": [
                {
                    "index": {
                        "error": {
                            "type": "mapper_parsing_exception",
                            "reason": "Failed to parse field",
                            "caused_by": {
                                "type": "json_parse_exception",
                                "reason": "Unexpected character"
                            }
                        }
                    }
                }
            ]
        }
        es_core._handle_bulk_errors(response)
        # Should log error but not raise exception
    
    def test_handle_bulk_errors_with_caused_by(self, es_core):
        """Test _handle_bulk_errors with caused_by information"""
        response = {
            "errors": True,
            "items": [
                {
                    "index": {
                        "error": {
                            "type": "illegal_argument_exception",
                            "reason": "Invalid argument",
                            "caused_by": {
                                "type": "json_parse_exception",
                                "reason": "JSON parsing failed"
                            }
                        }
                    }
                }
            ]
        }
        es_core._handle_bulk_errors(response)
        # Should log both main error and caused_by error
    
    def test_delete_documents_by_path_or_url_success(self, es_core):
        """Test delete_documents_by_path_or_url successful case"""
        es_core.client = MagicMock()
        es_core.client.delete_by_query.return_value = {"deleted": 5}
        
        result = es_core.delete_documents_by_path_or_url("test_index", "/path/to/file.pdf")
        assert result == 5
        es_core.client.delete_by_query.assert_called_once()
    
    def test_delete_documents_by_path_or_url_exception(self, es_core):
        """Test delete_documents_by_path_or_url with exception"""
        es_core.client = MagicMock()
        es_core.client.delete_by_query.side_effect = Exception("Delete error")
        
        result = es_core.delete_documents_by_path_or_url("test_index", "/path/to/file.pdf")
        assert result == 0
        es_core.client.delete_by_query.assert_called_once()
    
    def test_get_index_mapping_success(self, es_core):
        """Test get_index_mapping successful case"""
        es_core.client = MagicMock()
        es_core.client.indices.get_mapping.return_value = {
            "test_index": {
                "mappings": {
                    "properties": {
                        "title": {"type": "text"},
                        "content": {"type": "text"}
                    }
                }
            }
        }
        
        result = es_core.get_index_mapping(["test_index"])
        assert "test_index" in result
        assert "title" in result["test_index"]
        assert "content" in result["test_index"]
    
    def test_get_index_mapping_exception(self, es_core):
        """Test get_index_mapping with exception"""
        es_core.client = MagicMock()
        es_core.client.indices.get_mapping.side_effect = Exception("Mapping error")
        
        result = es_core.get_index_mapping(["test_index"])
        # The function returns empty list for failed indices, not empty dict
        assert "test_index" in result
        assert result["test_index"] == []
    
    def test_get_index_stats_success(self, es_core):
        """Test get_index_stats successful case"""
        es_core.client = MagicMock()
        es_core.client.indices.stats.return_value = {
            "indices": {
                "test_index": {
                    "primaries": {
                        "docs": {"count": 100},
                        "store": {"size_in_bytes": 1024},
                        "search": {"query_total": 50},
                        "request_cache": {"hit_count": 25}
                    }
                }
            }
        }
        es_core.client.indices.get_settings.return_value = {
            "test_index": {
                "settings": {
                    "index": {
                        "number_of_shards": "1",
                        "number_of_replicas": "0",
                        "creation_date": "1640995200000"
                    }
                }
            }
        }
        es_core.client.search.return_value = {
            "aggregations": {
                "unique_path_or_url_count": {"value": 10},
                "process_sources": {"buckets": [{"key": "test_source"}]},
                "embedding_models": {"buckets": [{"key": "test_model"}]}
            }
        }
        
        result = es_core.get_index_stats(["test_index"])
        assert "test_index" in result
        assert "base_info" in result["test_index"]
        assert "search_performance" in result["test_index"]
    
    def test_get_index_stats_exception(self, es_core):
        """Test get_index_stats with exception"""
        es_core.client = MagicMock()
        es_core.client.indices.stats.side_effect = Exception("Stats error")
        
        result = es_core.get_index_stats(["test_index"])
        # The function returns error info for failed indices, not empty dict
        assert "test_index" in result
        assert "error" in result["test_index"]
    
    def test_get_index_stats_with_embedding_dim(self, es_core):
        """Test get_index_stats with embedding dimension"""
        es_core.client = MagicMock()
        es_core.client.indices.stats.return_value = {
            "indices": {
                "test_index": {
                    "primaries": {
                        "docs": {"count": 100},
                        "store": {"size_in_bytes": 1024},
                        "search": {"query_total": 50},
                        "request_cache": {"hit_count": 25}
                    }
                }
            }
        }
        es_core.client.indices.get_settings.return_value = {
            "test_index": {
                "settings": {
                    "index": {
                        "number_of_shards": "1",
                        "number_of_replicas": "0",
                        "creation_date": "1640995200000"
                    }
                }
            }
        }
        es_core.client.search.return_value = {
            "aggregations": {
                "unique_path_or_url_count": {"value": 10},
                "process_sources": {"buckets": [{"key": "test_source"}]},
                "embedding_models": {"buckets": [{"key": "test_model"}]}
            }
        }
        
        result = es_core.get_index_stats(["test_index"], embedding_dim=512)
        assert "test_index" in result
        assert "base_info" in result["test_index"]
        assert "search_performance" in result["test_index"]
        assert result["test_index"]["base_info"]["embedding_dim"] == 512
    
    def test_bulk_operation_context_success(self, es_core):
        """Test bulk_operation_context successful case"""
        es_core._bulk_operations = {}
        es_core._operation_counter = 0
        es_core._settings_lock = MagicMock()
        es_core._apply_bulk_settings = MagicMock()
        es_core._restore_normal_settings = MagicMock()
        
        with es_core.bulk_operation_context("test_index") as operation_id:
            assert operation_id is not None
            assert "test_index" in es_core._bulk_operations
            es_core._apply_bulk_settings.assert_called_once_with("test_index")
        
        # After context exit, should restore settings
        es_core._restore_normal_settings.assert_called_once_with("test_index")
    
    def test_bulk_operation_context_multiple_operations(self, es_core):
        """Test bulk_operation_context with multiple operations"""
        es_core._bulk_operations = {}
        es_core._operation_counter = 0
        es_core._settings_lock = MagicMock()
        es_core._apply_bulk_settings = MagicMock()
        es_core._restore_normal_settings = MagicMock()
        
        # First operation
        with es_core.bulk_operation_context("test_index") as op1:
            assert op1 is not None
            es_core._apply_bulk_settings.assert_called_once()
        
        # After first operation exits, settings should be restored
        es_core._restore_normal_settings.assert_called_once_with("test_index")
        
        # Second operation - will apply settings again since first operation is done
        with es_core.bulk_operation_context("test_index") as op2:
            assert op2 is not None
            # Should call apply_bulk_settings again since first operation is done
            assert es_core._apply_bulk_settings.call_count == 2
        
        # After second operation exits, should restore settings again
        assert es_core._restore_normal_settings.call_count == 2
    
    def test_small_batch_insert_success(self, es_core):
        """Test _small_batch_insert successful case"""
        es_core.client = MagicMock()
        es_core.client.bulk.return_value = {"items": [], "errors": False}
        es_core._preprocess_documents = MagicMock(return_value=[
            {"content": "test content", "title": "test"}
        ])
        es_core._handle_bulk_errors = MagicMock()
        
        mock_embedding_model = MagicMock()
        mock_embedding_model.get_embeddings.return_value = [[0.1, 0.2, 0.3]]
        mock_embedding_model.embedding_model_name = "test_model"
        
        documents = [{"content": "test content", "title": "test"}]
        
        result = es_core._small_batch_insert("test_index", documents, "content", mock_embedding_model)
        assert result == 1
        es_core.client.bulk.assert_called_once()
    
    def test_small_batch_insert_exception(self, es_core):
        """Test _small_batch_insert with exception"""
        es_core._preprocess_documents = MagicMock(side_effect=Exception("Preprocess error"))
        
        mock_embedding_model = MagicMock()
        documents = [{"content": "test content", "title": "test"}]
        
        result = es_core._small_batch_insert("test_index", documents, "content", mock_embedding_model)
        assert result == 0
    
    def test_large_batch_insert_success(self, es_core):
        """Test _large_batch_insert successful case"""
        es_core.client = MagicMock()
        es_core.client.bulk.return_value = {"items": [], "errors": False}
        es_core._preprocess_documents = MagicMock(return_value=[
            {"content": "test content", "title": "test"}
        ])
        es_core._handle_bulk_errors = MagicMock()
        
        mock_embedding_model = MagicMock()
        mock_embedding_model.get_embeddings.return_value = [[0.1, 0.2, 0.3]]
        mock_embedding_model.embedding_model_name = "test_model"
        
        documents = [{"content": "test content", "title": "test"}]
        
        result = es_core._large_batch_insert("test_index", documents, 10, "content", mock_embedding_model)
        assert result == 1
        es_core.client.bulk.assert_called_once()
    
    def test_large_batch_insert_embedding_error(self, es_core):
        """Test _large_batch_insert with embedding API error"""
        es_core.client = MagicMock()
        es_core._preprocess_documents = MagicMock(return_value=[
            {"content": "test content", "title": "test"}
        ])
        
        mock_embedding_model = MagicMock()
        mock_embedding_model.get_embeddings.side_effect = Exception("Embedding API error")
        
        documents = [{"content": "test content", "title": "test"}]
        
        result = es_core._large_batch_insert("test_index", documents, 10, "content", mock_embedding_model)
        assert result == 0  # No documents indexed due to embedding error
    
    def test_large_batch_insert_no_embeddings(self, es_core):
        """Test _large_batch_insert with no successful embeddings"""
        es_core.client = MagicMock()
        es_core._preprocess_documents = MagicMock(return_value=[
            {"content": "test content", "title": "test"}
        ])
        
        mock_embedding_model = MagicMock()
        mock_embedding_model.get_embeddings.side_effect = Exception("Embedding API error")
        
        documents = [{"content": "test content", "title": "test"}]
        
        result = es_core._large_batch_insert("test_index", documents, 10, "content", mock_embedding_model)
        assert result == 0  # No documents indexed
