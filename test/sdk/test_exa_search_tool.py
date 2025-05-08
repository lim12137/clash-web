import unittest
from unittest.mock import Mock, patch

from nexent.core.tools import EXASearchTool
from nexent.core.utils import MessageObserver


class TestEXASearchTool(unittest.TestCase):
    def setUp(self):
        """Setup before tests"""
        self.api_key = ""
        self.observer = MessageObserver()
        self.tool = EXASearchTool(
            exa_api_key=self.api_key,
            observer=self.observer,
            max_results=3,
        )

    def test_initialization(self):
        """Test tool initialization"""
        self.assertEqual(self.tool.name, "exa_web_search")
        self.assertEqual(self.tool.max_results, 3)
        self.assertFalse(self.tool.image_filter)

    @patch('exa_py.Exa.search_and_contents')
    def test_basic_search(self, mock_search):
        """Test basic search functionality"""
        mock_result = Mock()
        mock_result.results = [
            Mock(
                title="测试标题",
                url="http://test.com",
                text="测试内容",
                published_date="2024-03-20",
                extras={"image_links": ["http://test.com/image.jpg"]}
            )
        ]
        mock_search.return_value = mock_result

        result = self.tool.forward("测试查询")
        
        self.assertIn("测试标题", result)
        self.assertIn("测试内容", result)
        mock_search.assert_called_once()

    @patch('exa_py.Exa.search_and_contents')
    def test_empty_results(self, mock_search):
        """Test empty results scenario"""
        mock_result = Mock()
        mock_result.results = []
        mock_search.return_value = mock_result

        with self.assertRaises(Exception) as context:
            self.tool.forward("测试查询")
        
        self.assertIn("No results found", str(context.exception))

    def test_real_search(self):
        """Test real search call (without validating results)"""
        try:
            # Create a real search tool instance
            real_tool = EXASearchTool(
                exa_api_key=self.api_key,
                max_results=1)
            
            # Execute search
            result = real_tool.forward("测试查询")
            
            # Only verify that the search executed successfully (without checking specific results)
            self.assertIsNotNone(result)
            self.assertIsInstance(result, str)
            
        except Exception as e:
            self.fail(f"Search execution failed: {str(e)}")

if __name__ == '__main__':
    unittest.main() 