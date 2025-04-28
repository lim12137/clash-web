import requests
import json
import time
import unittest
import os

# Base URL for the API
BASE_URL = "http://localhost:8000"

# 是否打印详细结果
VERBOSE = True

def print_response(response, title="Response"):
    """打印响应内容"""
    if VERBOSE:
        print(f"\n=== {title} ===")
        print(f"Status Code: {response.status_code}")
        if hasattr(response, 'json'):
            try:
                data = response.json()
                print(json.dumps(data, indent=2, ensure_ascii=False))
            except:
                print(response.text)
        else:
            print(response)
        print("=" * (len(title) + 8))

class TestElasticsearchService(unittest.TestCase):
    """Test class for Elasticsearch Service API endpoints"""
    
    @classmethod
    def setUpClass(cls):
        """Setup test class - verify API is running and test knowledge base exists"""
        # Check health endpoint
        try:
            response = requests.get(f"{BASE_URL}/health")
            assert response.status_code == 200, "API is not healthy"
            
            # Get list of indices to verify test knowledge base exists
            response = requests.get(f"{BASE_URL}/indices")
            indices = response.json()["indices"]
            
            # If test knowledge base doesn't exist, create it by indexing a sample document
            if "sample_articles" not in indices:
                print("Test knowledge base 'sample_articles' not found, creating it...")
                # Create a sample document to index
                current_time = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
                sample_doc = {
                    "task_id": "test_setup",
                    "index_name": "sample_articles",
                    "results": [
                        {
                            "metadata": {
                                "filename": "sample.txt",
                                "title": "Sample Document",
                                "file_size": 1024,
                                "creation_date": current_time
                            },
                            "source": "https://example.com/sample.txt",
                            "source_type": "url",
                            "text": "This is a sample document for testing."
                        }
                    ]
                }
                
                # Index the document to automatically create the index
                response = requests.post(
                    f"{BASE_URL}/indices/sample_articles/documents",
                    json=sample_doc
                )
                print_response(response, "Index Creation Response")
                assert response.status_code == 200, "Failed to create test knowledge base"
                
                # Wait for index creation to complete
                time.sleep(2)
                
                # Check if it exists now
                response = requests.get(f"{BASE_URL}/indices")
                indices = response.json()["indices"]
                assert "sample_articles" in indices, "Failed to create test knowledge base"
                
            print(f"Found {len(indices)} indices: {', '.join(indices)}")
            cls.index_name = "sample_articles"
            
        except requests.exceptions.ConnectionError:
            raise unittest.SkipTest("API is not running. Please start the service first.")
    
    def test_01_health_endpoint(self):
        """Test the health endpoint"""
        response = requests.get(f"{BASE_URL}/health")
        print_response(response, "Health Endpoint")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["elasticsearch"], "connected")
        self.assertIsInstance(data["indices_count"], int)
    
    def test_02_list_indices(self):
        """Test listing indices"""
        response = requests.get(f"{BASE_URL}/indices")
        print_response(response, "List Indices")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("indices", data)
        self.assertIn("count", data)
        self.assertGreaterEqual(data["count"], 1)  # At least one index should exist
        self.assertIn(self.index_name, data["indices"])
        
        # Test with include_stats parameter
        response = requests.get(f"{BASE_URL}/indices?include_stats=true")
        print_response(response, "List Indices with Stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check response structure
        self.assertIn("indices", data)
        self.assertIn("count", data)
        self.assertIn("indices_info", data)
        
        # Check that all indices have stats
        found_index = False
        for index_info in data["indices_info"]:
            self.assertIn("name", index_info)
            self.assertIn("stats", index_info)
            if index_info["name"] == self.index_name:
                found_index = True
                self.assertIn("base_info", index_info["stats"])
                self.assertIn("search_performance", index_info["stats"])
                
        self.assertTrue(found_index, f"Expected to find index {self.index_name} in indices_info")
    
    def test_03_get_index_info(self):
        """Test getting consolidated index information"""
        response = requests.get(f"{BASE_URL}/indices/{self.index_name}/info")
        print_response(response, "Index Info")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check for all consolidated fields
        self.assertIn("base_info", data)
        self.assertIn("search_performance", data)
        self.assertIn("fields", data)
        self.assertIn("files", data)
        
        # Check basic information fields
        self.assertIn("doc_count", data["base_info"])
        self.assertGreater(data["base_info"]["doc_count"], 0)  # Should have documents
        
        # Validate field mapping
        expected_fields = ["id", "title", "content", "embedding", "path_or_url", "process_source"]
        for field in expected_fields:
            self.assertIn(field, data["fields"])
            
        # Check file list structure if available
        if data["files"]:
            file_info = data["files"][0]
            self.assertIn("path_or_url", file_info)
            self.assertIn("filename", file_info)
    
    def test_05_accurate_search(self):
        """Test accurate text search"""
        # Search for "sample" which should be in the sample articles
        response = requests.post(
            f"{BASE_URL}/indices/search/accurate",
            json={
                "index_names": [self.index_name],
                "query": "sample",
                "top_k": 2
            }
        )
        print_response(response, "Accurate Search")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("results", data)
        self.assertIn("total", data)
        self.assertIn("query_time_ms", data)
        self.assertGreater(data["total"], 0)  # Should find at least one result
        
        # Check first result structure
        result = data["results"][0]
        self.assertIn("id", result)
        self.assertIn("title", result)
        self.assertIn("content", result)
        self.assertIn("score", result)
        self.assertNotIn("embedding", result)  # Embedding vector shouldn't be returned
        
        # Check for new fields
        if "embedding_model_name" in result:
            self.assertIsNotNone(result["embedding_model_name"])
    
    def test_06_semantic_search(self):
        """Test semantic vector search"""
        # Search for a semantic query
        response = requests.post(
            f"{BASE_URL}/indices/search/semantic",
            json={
                "index_names": [self.index_name],
                "query": "document for testing",
                "top_k": 2
            }
        )
        print_response(response, "Semantic Search")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("results", data)
        self.assertIn("total", data)
        self.assertIn("query_time_ms", data)
        self.assertGreater(data["total"], 0)  # Should find at least one result
        
        # Check first result structure
        result = data["results"][0]
        self.assertIn("id", result)
        self.assertIn("title", result)
        self.assertIn("content", result)
        self.assertIn("score", result)
        
        # Check for new fields
        if "embedding_model_name" in result:
            self.assertIsNotNone(result["embedding_model_name"])
    
    def test_07_hybrid_search(self):
        """Test hybrid search"""
        # Search for a hybrid query
        response = requests.post(
            f"{BASE_URL}/indices/search/hybrid",
            json={
                "index_names": [self.index_name],
                "query": "document for testing",
                "top_k": 2,
                "weight_accurate": 0.3
            }
        )
        print_response(response, "Hybrid Search")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("results", data)
        self.assertIn("total", data)
        self.assertIn("query_time_ms", data)
        self.assertGreater(data["total"], 0)  # Should find at least one result
        
        # Check first result structure
        result = data["results"][0]
        self.assertIn("id", result)
        self.assertIn("title", result)
        self.assertIn("content", result)
        self.assertIn("score", result)
        self.assertIn("score_details", result)
        self.assertIn("accurate", result["score_details"])
        self.assertIn("semantic", result["score_details"])  
        
        # Check for new fields
        if "embedding_model_name" in result:
            self.assertIsNotNone(result["embedding_model_name"])

    def test_08_index_with_new_fields(self):
        """Test indexing documents with new fields"""
        # Create a temporary index name for this test
        temp_index = "test_new_fields"
        
        # Prepare test documents with new fields
        current_time = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
        test_docs = {
            "task_id": "test_new_fields",
            "index_name": temp_index,
            "results": [
                {
                    "metadata": {
                        "filename": "newfields1.txt",
                        "title": "Document with New Fields1",
                        "file_size": 2048,
                        "creation_date": current_time,
                        "languages": ["en"],
                        "author": "Test Author",
                        "date": "2023-01-01"
                    },
                    "source": "https://example.com/newfields1.txt",
                    "source_type": "url",
                    "text": "This document has explicit values for all new fields."
                },
                {
                    "metadata": {
                        "filename": "newfields2.txt",
                        "title": "Document with New Fields2"
                    },
                    "source": "https://example.com/newfields2.txt", 
                    "source_type": "url",
                    "text": "This document relies on default values for new fields."
                }
            ]
        }
        
        # Index the documents
        response = requests.post(
            f"{BASE_URL}/indices/{temp_index}/documents",
            json=test_docs,
            params={"embedding_model_name": "API Override Model"}
        )
        print_response(response, "Index with New Fields")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total_submitted"], 2)
        
        # Get index info to verify fields
        time.sleep(1)  # Allow time for indexing to complete
        response = requests.get(f"{BASE_URL}/indices/{temp_index}/info")
        print_response(response, "New Fields Index Info")
        self.assertEqual(response.status_code, 200)
        info = response.json()
        
        # Check file info
        if info["files"]:
            found_explicit = False
            for file in info["files"]:
                if file["path_or_url"] == "https://example.com/newfields1.txt":
                    found_explicit = True
                    if "file_size" in file:
                        print(file["file_size"])
                        self.assertEqual(file["file_size"], 2048) # TODO: 文件大小逻辑有问题
            self.assertTrue(found_explicit, "Could not find document with explicit field values")
        
        # Clean up - delete the index
        response = requests.delete(f"{BASE_URL}/indices/{temp_index}")
        self.assertEqual(response.status_code, 200)
    
    def test_09_index_documents(self):
        """Test indexing documents with auto-creation of index"""
        # Create a temporary index name for this test
        temp_index = "test_index_documents"
        
        # Prepare test documents
        current_time = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
        test_docs = {
            "task_id": "test_index_docs",
            "index_name": temp_index,
            "results": [
                {
                    "metadata": {
                        "filename": "test1.txt",
                        "title": "Test Document 1",
                        "file_size": 1024,
                        "creation_date": current_time,
                        "languages": ["en"],
                        "author": "Test Author",
                        "date": "2023-01-01"
                    },
                    "source": "https://example.com/test1.txt",
                    "source_type": "url",
                    "text": "This is a test document for indexing."
                },
                {
                    "metadata": {
                        "filename": "test2.txt",
                        "title": "Test Document 2"
                    },
                    "source": "https://example.com/test2.txt",
                    "source_type": "url",
                    "text": "This is another test document for indexing."
                }
            ]
        }
        
        # Index the documents (should auto-create the index)
        response = requests.post(
            f"{BASE_URL}/indices/{temp_index}/documents",
            json=test_docs
        )
        print_response(response, "Index Documents")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total_submitted"], 2)
        
        # Verify the documents were indexed
        time.sleep(1)  # Allow time for indexing to complete
        response = requests.get(f"{BASE_URL}/indices/{temp_index}/info")
        self.assertEqual(response.status_code, 200)
        info = response.json()
        self.assertEqual(info["base_info"]["doc_count"], 2)
        
        # Search for the documents
        response = requests.post(
            f"{BASE_URL}/indices/search/accurate",
            json={
                "index_names": [temp_index],
                "query": "test document",
                "top_k": 2
            }
        )
        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertEqual(results["total"], 2)
        
        # Clean up - delete the documents
        response = requests.delete(
            f"{BASE_URL}/indices/{temp_index}/documents",
            params={"path_or_url": "https://example.com/test1.txt"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["deleted_count"], 1)
        
        # Clean up - delete the index
        response = requests.delete(f"{BASE_URL}/indices/{temp_index}")
        self.assertEqual(response.status_code, 200)
    
    def test_10_index_creation_and_deletion(self):
        """Test auto-creation via document indexing and deletion of an index"""
        # Create a new index by indexing a document
        test_index = "test_index_creation"
        
        # Prepare a test document
        current_time = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
        test_doc = {
            "task_id": "test_index_creation",
            "index_name": test_index,
            "results": [
                {
                    "metadata": {
                        "filename": "auto_create.txt",
                        "title": "Auto Create Index Test",
                        "file_size": 512,
                        "creation_date": current_time
                    },
                    "source": "https://example.com/auto_create.txt",
                    "text": "This document should trigger auto-creation of an index."
                }
            ]
        }
        
        # Index the document with a custom embedding dimension
        response = requests.post(
            f"{BASE_URL}/indices/{test_index}/documents",
            json=test_doc,
            params={"embedding_dim": 512}
        )
        print_response(response, "Index Creation")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        
        # Verify it exists
        response = requests.get(f"{BASE_URL}/indices")
        self.assertIn(test_index, response.json()["indices"])
        
        # Delete the index
        response = requests.delete(f"{BASE_URL}/indices/{test_index}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        
        # Verify it's gone
        response = requests.get(f"{BASE_URL}/indices")
        self.assertNotIn(test_index, response.json()["indices"])
    
    def test_11_error_handling(self):
        """Test error handling for non-existent resources"""
        # Non-existent index
        response = requests.get(f"{BASE_URL}/indices/non_existent_index/info")
        print_response(response, "Non-existent Index Error")
        self.assertEqual(response.status_code, 404)
        
        # Invalid search query (empty)
        response = requests.post(
            f"{BASE_URL}/indices/search/accurate",
            json={
                "index_names": [self.index_name],
                "query": "",
                "top_k": 2
            }
        )
        print_response(response, "Empty Query Error")
        self.assertNotEqual(response.status_code, 200)
        
        # Invalid search query (no index names)
        response = requests.post(
            f"{BASE_URL}/indices/search/accurate",
            json={
                "index_names": [],
                "query": "test",
                "top_k": 2
            }
        )
        print_response(response, "No Index Names Error")
        self.assertNotEqual(response.status_code, 200)
    
    def test_12_duplicate_index_creation(self):
        """Test that reusing an existing index name works properly"""
        # Create a temporary index for this test
        temp_index = "test_duplicate_index"
        
        # 先尝试删除现有的索引，避免之前测试残留
        try:
            requests.delete(f"{BASE_URL}/indices/{temp_index}")
            time.sleep(1)  # 等待删除完成
        except:
            pass
            
        # First document batch to create the index
        current_time = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
        first_docs = {
            "task_id": "test_duplicate_1",
            "index_name": temp_index,
            "results": [
                {
                    "metadata": {
                        "filename": "dup1.txt",
                        "title": "First Document",
                        "file_size": 128,
                        "creation_date": current_time
                    },
                    "source": "https://example.com/dup1.txt",
                    "text": "This is the first document that creates the index."
                }
            ]
        }
        
        # Index the first document to create the index
        response = requests.post(
            f"{BASE_URL}/indices/{temp_index}/documents",
            json=first_docs
        )
        print_response(response, "First Document Indexing")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        
        # Verify the index was created
        time.sleep(1)  # Allow time for indexing to complete
        response = requests.get(f"{BASE_URL}/indices")
        self.assertIn(temp_index, response.json()["indices"])
        
        # Second document batch to test inserting into existing index
        second_docs = {
            "task_id": "test_duplicate_2",
            "index_name": temp_index,
            "results": [
                {
                    "metadata": {
                        "filename": "dup2.txt",
                        "title": "Second Document",
                        "file_size": 256,
                        "creation_date": current_time
                    },
                    "source": "https://example.com/dup2.txt",
                    "text": "This is the second document going into the same index."
                }
            ]
        }
        
        # Index the second document to the same index
        response = requests.post(
            f"{BASE_URL}/indices/{temp_index}/documents",
            json=second_docs
        )
        print_response(response, "Second Document Indexing")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        
        # Verify both documents are in the index
        time.sleep(1)  # Allow time for indexing to complete
        response = requests.get(f"{BASE_URL}/indices/{temp_index}/info")
        print_response(response, "Index Info After Multiple Documents")
        self.assertEqual(response.status_code, 200)
        info = response.json()
        
        # Check file details
        file_urls = [file["path_or_url"] for file in info["files"]]
        self.assertIn("https://example.com/dup1.txt", file_urls)
        self.assertIn("https://example.com/dup2.txt", file_urls)
        
        # Clean up - delete the index
        response = requests.delete(f"{BASE_URL}/indices/{temp_index}")
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    print("Testing the Elasticsearch Vector Database API...")
    print(f"Base URL: {BASE_URL}")
    print("Make sure the API server is running before executing these tests.")
    
    # Check for environment variable to control verbosity
    VERBOSE = os.getenv("VERBOSE_TESTS", "True").lower() in ("true", "1", "yes")
    if VERBOSE:
        print("Running tests with verbose output...")
    else:
        print("Running tests...")
        
    unittest.main(verbosity=2) 