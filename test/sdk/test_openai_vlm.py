import os
import unittest
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from nexent.core.models import OpenAIVLModel
from nexent.core import MessageObserver

class TestOpenAIVLModel(unittest.TestCase):
    def setUp(self):
        # Create a mock observer
        self.observer = MessageObserver()
        
        # Path to test image
        self.test_image_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 
                                                            '../Nexent/data_process/example_docs/img/english-and-korean.png'))
        print("#"*20, self.test_image_path)
        # Mock environment variables or set them directly for testing
        self.api_key = os.environ.get("SILICON_FLOW_API_KEY", "sk-emfuatroheiygmeggkbkqgedbrupnnvtmjdbmrlgbzaowcgj")
        self.api_base = "https://api.siliconflow.cn/v1"
        
        # Initialize model with specified parameters
        self.model = OpenAIVLModel(
            observer=self.observer,
            model_id="Qwen/Qwen2.5-VL-72B-Instruct",
            api_base=self.api_base,
            api_key=self.api_key,
            temperature=0.7,
            top_p=0.7,
            frequency_penalty=0.5,
            max_tokens=512
        )

    def test_check_file_exists(self):
        # Verify that test image exists
        self.assertTrue(os.path.exists(self.test_image_path), 
                       f"Test image not found at {self.test_image_path}")
        print(f"Test image found at {self.test_image_path}")

    @patch('openai.OpenAI')
    def test_encode_image_call(self, mock_openai):
        """测试image编码函数调用是否成功"""
        try:
            self.model.encode_image(self.test_image_path)
            print("Image encoding function called successfully")
        except Exception as e:
            self.fail(f"encode_image function call failed: {e}")

    @patch('openai.OpenAI')
    def test_prepare_image_message_call(self, mock_openai):
        """测试prepare_image_message函数调用是否成功"""
        try:
            self.model.prepare_image_message(self.test_image_path)
            print("prepare_image_message function called successfully")
        except Exception as e:
            self.fail(f"prepare_image_message function call failed: {e}")

    @patch('openai.OpenAI')
    def test_analyze_image_call(self, mock_openai):
        """测试analyze_image函数调用是否成功"""
        # Create a simple mock for the client and response
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        # Configure a simple mock response
        mock_client.chat.completions.create.return_value = MagicMock()
        
        # Test with non-streaming mode to simplify the test
        try:
            with patch.object(self.model, '__call__', return_value=MagicMock()):
                self.model.analyze_image(
                    image_input=self.test_image_path,
                    stream=False
                )
            print("analyze_image function called successfully")
        except Exception as e:
            self.fail(f"analyze_image function call failed: {e}")

    @patch('openai.OpenAI')
    def test_check_connectivity_call(self, mock_openai):
        """测试connectivity检查函数调用是否成功"""
        # Create a simple mock
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        # Mock the response
        mock_client.chat.completions.create.return_value = MagicMock()
        
        try:
            self.model.check_connectivity()
            print("check_connectivity function called successfully")
        except Exception as e:
            self.fail(f"check_connectivity function call failed: {e}")

if __name__ == '__main__':
    unittest.main() 