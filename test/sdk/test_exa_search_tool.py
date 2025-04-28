import unittest
from unittest.mock import Mock, patch

from nexent.core.tools import EXASearchTool
from nexent.core.utils import MessageObserver


class TestEXASearchTool(unittest.TestCase):
    def setUp(self):
        """测试前的设置"""
        self.api_key = ""
        self.observer = MessageObserver()
        self.tool = EXASearchTool(
            exa_api_key=self.api_key,
            observer=self.observer,
            max_results=3,
            is_model_summary=False,
            lang='zh'
        )

    def test_initialization(self):
        """测试工具初始化"""
        self.assertEqual(self.tool.name, "exa_web_search")
        self.assertEqual(self.tool.max_results, 3)
        self.assertEqual(self.tool.lang, 'zh')
        self.assertFalse(self.tool.is_model_summary)
        self.assertFalse(self.tool.image_filter)

    def test_invalid_language(self):
        """测试不支持的语言设置"""
        with self.assertRaises(ValueError):
            EXASearchTool(
                exa_api_key=self.api_key,
                lang='invalid_lang'
            )

    @patch('exa_py.Exa.search_and_contents')
    def test_basic_search(self, mock_search):
        """测试基本搜索功能"""
        # 模拟搜索结果
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
        """测试空结果情况"""
        mock_result = Mock()
        mock_result.results = []
        mock_search.return_value = mock_result

        with self.assertRaises(Exception) as context:
            self.tool.forward("测试查询")
        
        self.assertIn("未找到结果", str(context.exception))

    @patch('exa_py.Exa.search_and_contents')
    def test_model_summary_search(self, mock_search):
        """测试带模型总结的搜索"""
        tool_with_summary = EXASearchTool(
            exa_api_key=self.api_key,
            is_model_summary=True,
            lang='zh'
        )

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

        result = tool_with_summary.forward("测试查询")
        
        # 验证调用时包含summary参数
        mock_search.assert_called_once()
        call_kwargs = mock_search.call_args[1]
        self.assertIn('summary', call_kwargs)

    def test_real_search(self):
        """测试真实的搜索调用（不验证结果）"""
        try:
            # 创建一个真实的搜索工具实例
            real_tool = EXASearchTool(
                exa_api_key=self.api_key,
                max_results=1,
                is_model_summary=False,
                lang='zh',
            )
            
            # 执行搜索
            result = real_tool.forward("测试查询")
            
            # 只验证搜索是否成功执行（不检查具体结果）
            self.assertIsNotNone(result)
            self.assertIsInstance(result, str)
            
        except Exception as e:
            self.fail(f"搜索执行失败: {str(e)}")

if __name__ == '__main__':
    unittest.main() 