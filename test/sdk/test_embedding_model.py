import os
import unittest
import sys
import requests
import logging
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from nexent.core.models.embedding_model import JinaEmbedding, OpenAICompatibleEmbedding

# Configure logging to suppress error messages during tests
logging.getLogger().setLevel(logging.CRITICAL)


class TestJinaEmbedding(unittest.TestCase):
    def setUp(self):
        # Mock API key
        self.api_key = "test_api_key"
        self.base_url = "https://api.jina.ai/v1/embeddings"
        self.model_name = "jina-clip-v2"
        self.embedding_dim = 1024
        
        # Initialize model
        self.model = JinaEmbedding(
            api_key=self.api_key,
            base_url=self.base_url,
            model_name=self.model_name,
            embedding_dim=self.embedding_dim
        )
        
        # Test inputs
        self.text_input = [{"text": "Hello, nexent!"}]
        self.image_input = [{"image": "https://example.com/image.jpg"}]
        self.mixed_input = [
            {"text": "A description"},
            {"image": "https://example.com/image.jpg"}
        ]
    
    def test_initialization(self):
        """Test model initialization"""
        self.assertEqual(self.model.api_key, self.api_key)
        self.assertEqual(self.model.api_url, self.base_url)
        self.assertEqual(self.model.model, self.model_name)
        self.assertEqual(self.model.embedding_dim, self.embedding_dim)
        self.assertEqual(self.model.headers, {
            "Content-Type": "application/json", 
            "Authorization": f"Bearer {self.api_key}"
        })

    def test_prepare_input(self):
        """Test input preparation method"""
        prepared = self.model._prepare_input(self.text_input)
        expected = {
            "model": self.model_name,
            "input": self.text_input
        }
        self.assertEqual(prepared, expected)

    @patch('requests.post')
    def test_make_request(self, mock_post):
        """Test API request method"""
        # Mock the response
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": [{"embedding": [0.1, 0.2, 0.3]}]}
        mock_post.return_value = mock_response
        
        # Test the method
        data = {"model": self.model_name, "input": self.text_input}
        response = self.model._make_request(data)
        
        # Assert request was made with correct parameters
        mock_post.assert_called_once_with(
            self.base_url,
            headers=self.model.headers,
            json=data,
            timeout=None
        )
        
        # Assert response processing
        self.assertEqual(response, {"data": [{"embedding": [0.1, 0.2, 0.3]}]})

    @patch('requests.post')
    def test_get_embeddings_text(self, mock_post):
        """Test getting embeddings for text input"""
        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [{"embedding": [0.1, 0.2, 0.3]}]
        }
        mock_post.return_value = mock_response
        
        # Test without metadata
        embeddings = self.model.get_embeddings(self.text_input)
        self.assertEqual(embeddings, [[0.1, 0.2, 0.3]])
        
        # Test with metadata
        full_response = self.model.get_embeddings(self.text_input, with_metadata=True)
        self.assertEqual(full_response, {"data": [{"embedding": [0.1, 0.2, 0.3]}]})

    @patch('requests.post')
    def test_get_embeddings_image(self, mock_post):
        """Test getting embeddings for image input"""
        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [{"embedding": [0.4, 0.5, 0.6]}]
        }
        mock_post.return_value = mock_response
        
        embeddings = self.model.get_embeddings(self.image_input)
        self.assertEqual(embeddings, [[0.4, 0.5, 0.6]])

    @patch('requests.post')
    def test_get_embeddings_mixed(self, mock_post):
        """Test getting embeddings for mixed input"""
        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {"embedding": [0.1, 0.2, 0.3]},
                {"embedding": [0.4, 0.5, 0.6]}
            ]
        }
        mock_post.return_value = mock_response
        
        embeddings = self.model.get_embeddings(self.mixed_input)
        self.assertEqual(embeddings, [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])

    @patch('requests.post')
    def test_check_connectivity_success(self, mock_post):
        """Test connectivity check success"""
        # Mock successful response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [{"embedding": [0.1, 0.2, 0.3]}]
        }
        mock_post.return_value = mock_response
        
        self.assertTrue(self.model.check_connectivity())

    @patch('requests.post')
    def test_check_connectivity_timeout(self, mock_post):
        """Test connectivity check with timeout"""
        # Mock timeout
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = requests.exceptions.Timeout("Connection timed out")
        mock_post.return_value = mock_response
        
        self.assertFalse(self.model.check_connectivity())

    @patch('requests.post')
    def test_check_connectivity_connection_error(self, mock_post):
        """Test connectivity check with connection error"""
        # Mock connection error
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = requests.exceptions.ConnectionError("Connection failed")
        mock_post.return_value = mock_response
        
        self.assertFalse(self.model.check_connectivity())

    @patch('requests.post')
    def test_check_connectivity_other_error(self, mock_post):
        """Test connectivity check with other error"""
        # Mock other error
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("Unknown error")
        mock_post.return_value = mock_response
        
        self.assertFalse(self.model.check_connectivity())


class TestOpenAICompatibleEmbedding(unittest.TestCase):
    def setUp(self):
        # Mock API key
        self.api_key = "test_api_key"
        self.base_url = "https://api.openai.com/v1/embeddings"
        self.model_name = "text-embedding-ada-002"
        self.embedding_dim = 1536
        
        # Initialize model
        self.model = OpenAICompatibleEmbedding(
            api_key=self.api_key,
            base_url=self.base_url,
            model_name=self.model_name,
            embedding_dim=self.embedding_dim
        )
        
        # Test inputs
        self.single_input = "Hello, nexent!"
        self.multiple_input = ["Hello, nexent!", "Testing embeddings"]
    
    def test_initialization(self):
        """Test model initialization"""
        self.assertEqual(self.model.api_key, self.api_key)
        self.assertEqual(self.model.api_url, self.base_url)
        self.assertEqual(self.model.model_name, self.model_name)
        self.assertEqual(self.model.embedding_dim, self.embedding_dim)
        self.assertEqual(self.model.headers, {
            "Content-Type": "application/json", 
            "Authorization": f"Bearer {self.api_key}"
        })

    def test_prepare_input_single(self):
        """Test input preparation with single string"""
        prepared = self.model._prepare_input(self.single_input)
        expected = {
            "model": self.model_name,
            "input": [self.single_input]
        }
        self.assertEqual(prepared, expected)

    def test_prepare_input_multiple(self):
        """Test input preparation with list of strings"""
        prepared = self.model._prepare_input(self.multiple_input)
        expected = {
            "model": self.model_name,
            "input": self.multiple_input
        }
        self.assertEqual(prepared, expected)

    @patch('requests.post')
    def test_make_request(self, mock_post):
        """Test API request method"""
        # Mock the response
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": [{"embedding": [0.1, 0.2, 0.3]}]}
        mock_post.return_value = mock_response
        
        # Test the method
        data = {"model": self.model_name, "input": [self.single_input]}
        response = self.model._make_request(data)
        
        # Assert request was made with correct parameters
        mock_post.assert_called_once_with(
            self.base_url,
            headers=self.model.headers,
            json=data,
            timeout=None
        )
        
        # Assert response processing
        self.assertEqual(response, {"data": [{"embedding": [0.1, 0.2, 0.3]}]})

    @patch('requests.post')
    def test_get_embeddings_single(self, mock_post):
        """Test getting embeddings for single text input"""
        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [{"embedding": [0.1, 0.2, 0.3]}]
        }
        mock_post.return_value = mock_response
        
        # Test without metadata
        embeddings = self.model.get_embeddings(self.single_input)
        self.assertEqual(embeddings, [[0.1, 0.2, 0.3]])
        
        # Test with metadata
        full_response = self.model.get_embeddings(self.single_input, with_metadata=True)
        self.assertEqual(full_response, {"data": [{"embedding": [0.1, 0.2, 0.3]}]})

    @patch('requests.post')
    def test_get_embeddings_multiple(self, mock_post):
        """Test getting embeddings for multiple text inputs"""
        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {"embedding": [0.1, 0.2, 0.3]},
                {"embedding": [0.4, 0.5, 0.6]}
            ]
        }
        mock_post.return_value = mock_response
        
        embeddings = self.model.get_embeddings(self.multiple_input)
        self.assertEqual(embeddings, [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])

    @patch('requests.post')
    def test_check_connectivity_success(self, mock_post):
        """Test connectivity check success"""
        # Mock successful response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [{"embedding": [0.1, 0.2, 0.3]}]
        }
        mock_post.return_value = mock_response
        
        self.assertTrue(self.model.check_connectivity())

    @patch('requests.post')
    def test_check_connectivity_timeout(self, mock_post):
        """Test connectivity check with timeout"""
        # Mock timeout
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = requests.exceptions.Timeout("Connection timed out")
        mock_post.return_value = mock_response
        
        self.assertFalse(self.model.check_connectivity())

    @patch('requests.post')
    def test_check_connectivity_connection_error(self, mock_post):
        """Test connectivity check with connection error"""
        # Mock connection error
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = requests.exceptions.ConnectionError("Connection failed")
        mock_post.return_value = mock_response
        
        self.assertFalse(self.model.check_connectivity())

    @patch('requests.post')
    def test_check_connectivity_other_error(self, mock_post):
        """Test connectivity check with other error"""
        # Mock other error
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("Unknown error")
        mock_post.return_value = mock_response
        
        self.assertFalse(self.model.check_connectivity())


if __name__ == '__main__':
    unittest.main() 