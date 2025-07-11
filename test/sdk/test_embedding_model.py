import os
import sys
import unittest
import requests
import logging
from unittest.mock import patch, MagicMock

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from nexent.core.models.embedding_model import JinaEmbedding, OpenAICompatibleEmbedding

# Suppress logging during tests for cleaner output
logging.getLogger().setLevel(logging.CRITICAL)


class TestJinaEmbedding(unittest.TestCase):
    """Test suite for the JinaEmbedding class."""
    
    def setUp(self):
        """Set up common resources for tests."""
        self.api_key = "test_jina_api_key"
        self.base_url = "https://api.jina.ai/v1/embeddings"
        self.model_name = "jina-clip-v2"
        self.embedding_dim = 1024
        
        self.model = JinaEmbedding(
            api_key=self.api_key,
            base_url=self.base_url,
            model_name=self.model_name,
            embedding_dim=self.embedding_dim
        )
        
        # Define various input types for testing
        self.text_input_str = "A single text input."
        self.text_input_list = ["First text.", "Second text."]
        self.multimodal_text_input = [{"text": "Hello, nexent!"}]
        self.multimodal_image_input = [{"image": "https://example.com/image.jpg"}]
        self.multimodal_mixed_input = [
            {"text": "A description"},
            {"image": "https://example.com/image.jpg"}
        ]
        self.mock_embedding_1 = [0.1, 0.2, 0.3]
        self.mock_embedding_2 = [0.4, 0.5, 0.6]

    def test_initialization(self):
        """Verify that the model initializes with the correct attributes."""
        self.assertEqual(self.model.api_key, self.api_key)
        self.assertEqual(self.model.api_url, self.base_url)
        self.assertEqual(self.model.model, self.model_name)
        self.assertEqual(self.model.embedding_dim, self.embedding_dim)
        expected_headers = {
            "Content-Type": "application/json", 
            "Authorization": f"Bearer {self.api_key}"
        }
        self.assertEqual(self.model.headers, expected_headers)

    def test_prepare_multimodal_input(self):
        """Test the preparation of multimodal input data."""
        prepared = self.model._prepare_multimodal_input(self.multimodal_text_input)
        expected = {
            "model": self.model_name,
            "input": self.multimodal_text_input
        }
        self.assertEqual(prepared, expected)

    @patch('nexent.core.models.embedding_model.JinaEmbedding.get_multimodal_embeddings')
    def test_get_embeddings(self, mock_get_multimodal_embeddings):
        """Test getting embeddings for standard text inputs (str and List[str])."""
        # Mock API response
        mock_get_multimodal_embeddings.return_value = [self.mock_embedding_1]

        # Test with a single string input
        embeddings = self.model.get_embeddings(self.text_input_str)
        self.assertEqual(embeddings, [self.mock_embedding_1])
        
        # Verify the underlying multimodal call format
        mock_get_multimodal_embeddings.assert_called_with(
            [{"text": self.text_input_str}], with_metadata=False, timeout=None
        )

    @patch.object(JinaEmbedding, 'get_multimodal_embeddings')
    def test_get_embeddings_delegation(self, mock_get_multimodal):
        """Test that get_embeddings correctly delegates to get_multimodal_embeddings."""
        # Test with a single string
        self.model.get_embeddings(self.text_input_str)
        mock_get_multimodal.assert_called_with(
            [{"text": self.text_input_str}], with_metadata=False, timeout=None
        )

        # Test with a list of strings
        self.model.get_embeddings(self.text_input_list)
        mock_get_multimodal.assert_called_with(
            [{"text": text} for text in self.text_input_list], with_metadata=False, timeout=None
        )

    @patch('requests.post')
    def test_get_multimodal_embeddings(self, mock_post):
        """Test getting embeddings for multimodal inputs."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {"embedding": self.mock_embedding_1},
                {"embedding": self.mock_embedding_2}
            ]
        }
        mock_post.return_value = mock_response

        # Test with mixed input
        embeddings = self.model.get_multimodal_embeddings(self.multimodal_mixed_input)
        self.assertEqual(embeddings, [self.mock_embedding_1, self.mock_embedding_2])

        # Test with metadata
        full_response = self.model.get_multimodal_embeddings(self.multimodal_mixed_input, with_metadata=True)
        self.assertEqual(full_response, mock_response.json.return_value)

    @patch('requests.post')
    def test_check_connectivity_success(self, mock_post):
        """Test the connectivity check for a successful connection."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": [{"embedding": self.mock_embedding_1}]}
        mock_post.return_value = mock_response
        self.assertTrue(self.model.check_connectivity())
        # check_connectivity calls get_embeddings, which calls get_multimodal_embeddings
        # get_multimodal_embeddings prepares multimodal input
        expected_data = self.model._prepare_multimodal_input([{"text": "Hello, nexent!"}])
        mock_post.assert_called_once_with(
            self.base_url, headers=self.model.headers, json=expected_data, timeout=5.0
        )

    @patch('requests.post', side_effect=requests.exceptions.Timeout)
    def test_check_connectivity_timeout(self, mock_post):
        """Test the connectivity check for a timeout error."""
        self.assertFalse(self.model.check_connectivity())

    @patch('requests.post', side_effect=requests.exceptions.ConnectionError)
    def test_check_connectivity_connection_error(self, mock_post):
        """Test the connectivity check for a connection error."""
        self.assertFalse(self.model.check_connectivity())


class TestOpenAICompatibleEmbedding(unittest.TestCase):
    """Test suite for the OpenAICompatibleEmbedding class."""
    
    def setUp(self):
        """Set up common resources for tests."""
        self.api_key = "test_openai_api_key"
        self.base_url = "https://api.openai.com/v1/embeddings"
        self.model_name = "text-embedding-ada-002"
        self.embedding_dim = 1536
        
        self.model = OpenAICompatibleEmbedding(
            api_key=self.api_key,
            base_url=self.base_url,
            model_name=self.model_name,
            embedding_dim=self.embedding_dim
        )
        
        self.single_input = "Hello, nexent!"
        self.multiple_input = ["Hello, nexent!", "Testing embeddings"]
        self.mock_embedding_1 = [0.1, 0.2, 0.3]
        self.mock_embedding_2 = [0.4, 0.5, 0.6]

    def test_initialization(self):
        """Verify that the model initializes with the correct attributes."""
        self.assertEqual(self.model.api_key, self.api_key)
        self.assertEqual(self.model.api_url, self.base_url)
        self.assertEqual(self.model.model_name, self.model_name)
        self.assertEqual(self.model.embedding_dim, self.embedding_dim)
        expected_headers = {
            "Content-Type": "application/json", 
            "Authorization": f"Bearer {self.api_key}"
        }
        self.assertEqual(self.model.headers, expected_headers)

    def test_prepare_input(self):
        """Test the preparation of input data."""
        # Single string input
        prepared_single = self.model._prepare_input(self.single_input)
        self.assertEqual(prepared_single['input'], [self.single_input])
        
        # List of strings input
        prepared_multiple = self.model._prepare_input(self.multiple_input)
        self.assertEqual(prepared_multiple['input'], self.multiple_input)

    @patch('requests.post')
    def test_get_embeddings(self, mock_post):
        """Test getting embeddings for single and multiple text inputs."""
        # Mock for single input
        mock_response_single = MagicMock()
        mock_response_single.json.return_value = {"data": [{"embedding": self.mock_embedding_1}]}
        
        # Mock for multiple inputs
        mock_response_multiple = MagicMock()
        mock_response_multiple.json.return_value = {
            "data": [
                {"embedding": self.mock_embedding_1},
                {"embedding": self.mock_embedding_2}
            ]
        }

        # Test single input
        mock_post.return_value = mock_response_single
        embeddings_single = self.model.get_embeddings(self.single_input)
        self.assertEqual(embeddings_single, [self.mock_embedding_1])
        
        # Test multiple inputs
        mock_post.return_value = mock_response_multiple
        embeddings_multiple = self.model.get_embeddings(self.multiple_input)
        self.assertEqual(embeddings_multiple, [self.mock_embedding_1, self.mock_embedding_2])

        # Test with metadata
        full_response = self.model.get_embeddings(self.multiple_input, with_metadata=True)
        self.assertEqual(full_response, mock_response_multiple.json.return_value)

    @patch('requests.post')
    def test_check_connectivity_success(self, mock_post):
        """Test the connectivity check for a successful connection."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": [{"embedding": self.mock_embedding_1}]}
        mock_post.return_value = mock_response
        self.assertTrue(self.model.check_connectivity())
        
    @patch('requests.post', side_effect=requests.exceptions.Timeout)
    def test_check_connectivity_timeout(self, mock_post):
        """Test the connectivity check for a timeout error."""
        self.assertFalse(self.model.check_connectivity())

    @patch('requests.post', side_effect=requests.exceptions.ConnectionError)
    def test_check_connectivity_connection_error(self, mock_post):
        """Test the connectivity check for a connection error."""
        self.assertFalse(self.model.check_connectivity())


if __name__ == '__main__':
    unittest.main() 