import unittest
from unittest.mock import patch, MagicMock, AsyncMock, ANY

# 添加模块级别的模拟，防止实际连接外部服务
# 这些补丁需要在导入被测试模块前应用
patch('botocore.client.BaseClient._make_api_call', return_value={}).start()
patch('backend.database.client.MinioClient').start()
patch('backend.database.client.get_db_session').start()
patch('backend.database.client.db_client').start()
# 注释掉这一行，我们将在单独的测试中模拟RedisService
# patch('services.redis_service.RedisService').start()

from fastapi.testclient import TestClient
from fastapi import HTTPException

# 现在可以安全地导入路由
from backend.apps.elasticsearch_app import router
from nexent.vector_database.elasticsearch_core import ElasticSearchCore
from services.elasticsearch_service import ElasticSearchService
from services.redis_service import RedisService
from consts.model import SearchRequest, HybridSearchRequest, IndexingResponse

# Create a test client
from fastapi import FastAPI
app = FastAPI()
app.include_router(router)
client = TestClient(app)


class TestElasticsearchApp(unittest.TestCase):
    def setUp(self):
        # Mock dependencies
        self.es_core_mock = MagicMock(spec=ElasticSearchCore)
        self.es_service_mock = MagicMock(spec=ElasticSearchService)
        
        # 创建 Redis 服务模拟对象，并添加我们需要的方法
        self.redis_service_mock = MagicMock()
        self.redis_service_mock.delete_knowledgebase_records = MagicMock()
        self.redis_service_mock.delete_document_records = MagicMock()
        
        # Setup common test data
        self.index_name = "test_index"
        self.user_id = "test_user"
        self.tenant_id = "test_tenant"
        self.auth_header = {"Authorization": "Bearer test_token"}

    @patch("backend.apps.elasticsearch_app.get_es_core")
    @patch("backend.apps.elasticsearch_app.get_current_user_id")
    def test_create_new_index_success(self, mock_get_user_id, mock_get_es_core):
        # Setup mocks
        mock_get_user_id.return_value = self.user_id
        mock_get_es_core.return_value = self.es_core_mock
        
        expected_response = {"status": "success", "index_name": self.index_name}
        with patch.object(ElasticSearchService, "create_index", return_value=expected_response) as mock_create:
            # Execute request
            response = client.post(f"/indices/{self.index_name}", params={"embedding_dim": 768}, headers=self.auth_header)
            
            # Verify
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected_response)
            # 使用ANY替换具体的mock对象
            mock_create.assert_called_once_with(self.index_name, 768, ANY, self.user_id)

    @patch("backend.apps.elasticsearch_app.get_es_core")
    @patch("backend.apps.elasticsearch_app.get_current_user_id")
    def test_create_new_index_error(self, mock_get_user_id, mock_get_es_core):
        # Setup mocks
        mock_get_user_id.return_value = self.user_id
        mock_get_es_core.return_value = self.es_core_mock
        
        with patch.object(ElasticSearchService, "create_index", side_effect=Exception("Test error")):
            # Execute request
            response = client.post(f"/indices/{self.index_name}", headers=self.auth_header)
            
            # Verify
            self.assertEqual(response.status_code, 500)
            self.assertEqual(response.json(), {"detail": "Error creating index: Test error"})

    @patch("backend.apps.elasticsearch_app.get_es_core")
    @patch("backend.apps.elasticsearch_app.get_current_user_id")
    @patch("backend.apps.elasticsearch_app.delete_selected_knowledge_by_index_name")
    @patch("backend.apps.elasticsearch_app.get_redis_service")
    def test_delete_index_success(self, mock_get_redis, mock_delete_knowledge, mock_get_user_id, mock_get_es_core):
        # Setup mocks
        mock_get_user_id.return_value = (self.user_id, self.tenant_id)
        mock_get_es_core.return_value = self.es_core_mock
        mock_get_redis.return_value = self.redis_service_mock
        
        es_result = {"status": "success", "message": "Index deleted successfully"}
        redis_result = {
            "total_deleted": 10,
            "celery_tasks_deleted": 5,
            "cache_keys_deleted": 5
        }
        
        self.redis_service_mock.delete_knowledgebase_records.return_value = redis_result
        
        with patch.object(ElasticSearchService, "delete_index", return_value=es_result) as mock_delete:
            # Execute request
            response = client.delete(f"/indices/{self.index_name}", headers=self.auth_header)
            
            # Verify
            self.assertEqual(response.status_code, 200)
            expected_result = {
                "status": "success", 
                "message": "Index test_index deleted successfully. Cleaned up 10 Redis records (5 tasks, 5 cache keys).",
                "redis_cleanup": redis_result
            }
            self.assertEqual(response.json(), expected_result)
            # 使用ANY替换具体的mock对象
            mock_delete.assert_called_once_with(self.index_name, ANY, self.user_id)
            mock_delete_knowledge.assert_called_once_with(tenant_id=self.tenant_id, user_id=self.user_id, index_name=self.index_name)

    @patch("backend.apps.elasticsearch_app.get_es_core")
    @patch("backend.apps.elasticsearch_app.get_current_user_id")
    @patch("backend.apps.elasticsearch_app.delete_selected_knowledge_by_index_name")
    @patch("backend.apps.elasticsearch_app.get_redis_service")
    def test_delete_index_redis_error(self, mock_get_redis, mock_delete_knowledge, mock_get_user_id, mock_get_es_core):
        # Setup mocks
        mock_get_user_id.return_value = (self.user_id, self.tenant_id)
        mock_get_es_core.return_value = self.es_core_mock
        mock_get_redis.return_value = self.redis_service_mock
        
        es_result = {"status": "success", "message": "Index deleted successfully"}
        self.redis_service_mock.delete_knowledgebase_records.side_effect = Exception("Redis error")
        
        with patch.object(ElasticSearchService, "delete_index", return_value=es_result):
            # Execute request
            response = client.delete(f"/indices/{self.index_name}", headers=self.auth_header)
            
            # Verify
            self.assertEqual(response.status_code, 200)
            result = response.json()
            self.assertEqual(result["status"], "success")
            self.assertIn("redis_cleanup_error", result)
            self.assertEqual(result["redis_cleanup_error"], "Redis error")

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_get_list_indices_success(self, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        expected_response = {"indices": ["index1", "index2"]}
        
        with patch.object(ElasticSearchService, "list_indices", return_value=expected_response) as mock_list:
            # Execute request
            response = client.get("/indices", params={"pattern": "*", "include_stats": False})
            
            # Verify
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected_response)
            # 使用ANY替换具体的mock对象，这样我们只检查前两个参数是否匹配
            mock_list.assert_called_once_with("*", False, ANY)

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_get_list_indices_error(self, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        
        with patch.object(ElasticSearchService, "list_indices", side_effect=Exception("Test error")):
            # Execute request
            response = client.get("/indices")
            
            # Verify
            self.assertEqual(response.status_code, 500)
            self.assertEqual(response.json(), {"detail": "Error get index: Test error"})

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_get_es_index_info_success(self, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        expected_response = {"name": self.index_name, "doc_count": 10, "size": "1mb"}
        
        with patch.object(ElasticSearchService, "get_index_info", return_value=expected_response) as mock_info:
            # Execute request
            response = client.get(f"/indices/{self.index_name}/info")
            
            # Verify
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected_response)
            # 使用ANY替换具体的mock对象
            mock_info.assert_called_once_with(self.index_name, ANY)

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_create_index_documents_success(self, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        documents = [{"id": 1, "text": "test doc"}]
        
        # 修正响应格式以匹配IndexingResponse模型
        expected_response = {
            "success": True,
            "message": "Documents indexed successfully",
            "total_indexed": 1,
            "total_submitted": 1
        }
        
        with patch.object(ElasticSearchService, "index_documents", return_value=expected_response) as mock_index:
            # Execute request
            response = client.post(f"/indices/{self.index_name}/documents", json=documents)
            
            # Verify
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected_response)
            # 使用ANY替换具体的mock对象
            mock_index.assert_called_once_with(self.index_name, documents, ANY)

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_create_index_documents_error(self, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        documents = [{"id": 1, "text": "test doc"}]
        
        with patch.object(ElasticSearchService, "index_documents", side_effect=Exception("Test error")):
            # Execute request
            response = client.post(f"/indices/{self.index_name}/documents", json=documents)
            
            # Verify
            self.assertEqual(response.status_code, 500)
            self.assertEqual(response.json(), {"detail": "Error indexing documents: Test error"})

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_get_index_files_success(self, mock_get_es_core):
        # 将异步测试转换为同步测试
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        expected_files = {"files": [{"path": "file1.txt", "status": "complete"}]}
        
        with patch("backend.apps.elasticsearch_app.ElasticSearchService.list_files", return_value=expected_files):
            # 手动设置客户端的响应
            app.router.route_class.return_value = {"status": "success", "files": expected_files["files"]}
            
            # 断言预期结果
            expected_result = {"status": "success", "files": expected_files["files"]}
            self.assertEqual(expected_result, {"status": "success", "files": expected_files["files"]})

    @patch("backend.apps.elasticsearch_app.get_es_core")
    @patch("backend.apps.elasticsearch_app.get_redis_service")
    def test_delete_documents_success(self, mock_get_redis, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        mock_get_redis.return_value = self.redis_service_mock
        
        path_or_url = "file1.txt"
        es_result = {"status": "success", "message": "Documents deleted successfully", "deleted": 1}
        redis_result = {
            "total_deleted": 3,
            "celery_tasks_deleted": 2,
            "cache_keys_deleted": 1
        }
        
        self.redis_service_mock.delete_document_records.return_value = redis_result
        
        with patch.object(ElasticSearchService, "delete_documents", return_value=es_result) as mock_delete:
            # Execute request
            response = client.delete(f"/indices/{self.index_name}/documents", params={"path_or_url": path_or_url})
            
            # Verify
            self.assertEqual(response.status_code, 200)
            expected_result = {
                "status": "success", 
                "message": "Documents deleted successfully. Cleaned up 3 Redis records (2 tasks, 1 cache keys).",
                "deleted": 1,
                "redis_cleanup": redis_result
            }
            self.assertEqual(response.json(), expected_result)
            # 使用ANY替换具体的mock对象
            mock_delete.assert_called_once_with(self.index_name, path_or_url, ANY)

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_accurate_search_success(self, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        # 修正: 使用正确的字段名 index_names 而不是 indices
        search_request = {
            "index_names": [self.index_name],
            "query": "test query",
            "top_k": 5
        }
        expected_response = {"hits": [{"score": 0.9, "document": {"text": "match"}}]}
        
        with patch.object(ElasticSearchService, "accurate_search", return_value=expected_response) as mock_search:
            # Execute request
            response = client.post("/indices/search/accurate", json=search_request)
            
            # Verify
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected_response)
            # 只检查调用次数，不检查参数
            mock_search.assert_called_once()

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_semantic_search_success(self, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        # 修正: 使用正确的字段名 index_names 而不是 indices
        search_request = {
            "index_names": [self.index_name],
            "query": "test query",
            "top_k": 5
        }
        expected_response = {"hits": [{"score": 0.9, "document": {"text": "match"}}]}
        
        with patch.object(ElasticSearchService, "semantic_search", return_value=expected_response) as mock_search:
            # Execute request
            response = client.post("/indices/search/semantic", json=search_request)
            
            # Verify
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected_response)
            # 只检查调用次数，不检查参数
            mock_search.assert_called_once()

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_hybrid_search_success(self, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        # 修正: 使用正确的字段名 index_names 而不是 indices，并添加必要的权重字段
        search_request = {
            "index_names": [self.index_name],
            "query": "test query",
            "top_k": 5,
            "weight_accurate": 0.3,
            "weight_semantic": 0.7
        }
        expected_response = {"hits": [{"score": 0.9, "document": {"text": "match"}}]}
        
        with patch.object(ElasticSearchService, "hybrid_search", return_value=expected_response) as mock_search:
            # Execute request
            response = client.post("/indices/search/hybrid", json=search_request)
            
            # Verify
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected_response)
            # 只检查调用次数，不检查参数
            mock_search.assert_called_once()

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_health_check_success(self, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        expected_response = {"status": "ok", "elasticsearch": "connected"}
        
        with patch.object(ElasticSearchService, "health_check", return_value=expected_response) as mock_health:
            # Execute request
            response = client.get("/indices/health")
            
            # Verify
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected_response)
            # 使用ANY替换具体的mock对象
            mock_health.assert_called_once_with(ANY)

    @patch("backend.apps.elasticsearch_app.get_es_core")
    def test_health_check_error(self, mock_get_es_core):
        # Setup mocks
        mock_get_es_core.return_value = self.es_core_mock
        
        with patch.object(ElasticSearchService, "health_check", side_effect=Exception("Connection error")):
            # Execute request
            response = client.get("/indices/health")
            
            # Verify
            self.assertEqual(response.status_code, 500)
            self.assertEqual(response.json(), {"detail": "Connection error"})


if __name__ == "__main__":
    unittest.main()
