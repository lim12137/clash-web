import unittest
import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))

from backend.utils.model_name_utils import split_repo_name, add_repo_to_name, split_display_name

class TestModelNameUtils(unittest.TestCase):
    """Test cases for model_name_utils.py"""

    def test_split_repo_name(self):
        """Test the split_repo_name function"""
        self.assertEqual(split_repo_name("THUDM/chatglm3-6b"), ("THUDM", "chatglm3-6b"))
        self.assertEqual(split_repo_name("Pro/THUDM/GLM-4.1V-9B-Thinking"), ("Pro/THUDM", "GLM-4.1V-9B-Thinking"))
        self.assertEqual(split_repo_name("chatglm3-6b"), ("", "chatglm3-6b"))
        self.assertEqual(split_repo_name(""), ("", ""))

    def test_add_repo_to_name(self):
        """Test the add_repo_to_name function"""
        self.assertEqual(add_repo_to_name("THUDM", "chatglm3-6b"), "THUDM/chatglm3-6b")
        self.assertEqual(add_repo_to_name("", "chatglm3-6b"), "chatglm3-6b")
        # Test case where model_name already contains a slash, should return model_name
        with self.assertLogs(level='WARNING') as cm:
            result = add_repo_to_name("THUDM", "THUDM/chatglm3-6b")
            self.assertEqual(result, "THUDM/chatglm3-6b")
            self.assertIn("already contains repository information", cm.output[0])

    def test_split_display_name(self):
        """Test the split_display_name function"""
        self.assertEqual(split_display_name("chatglm3-6b"), "chatglm3-6b")
        self.assertEqual(split_display_name("THUDM/chatglm3-6b"), "chatglm3-6b")
        self.assertEqual(split_display_name("Pro/THUDM/GLM-4.1V-9B-Thinking"), "Pro/GLM-4.1V-9B-Thinking")
        self.assertEqual(split_display_name("Pro/moonshotai/Kimi-K2-Instruct"), "Pro/Kimi-K2-Instruct")
        self.assertEqual(split_display_name("Pro/Qwen/Qwen2-7B-Instruct"), "Pro/Qwen2-7B-Instruct")
        self.assertEqual(split_display_name("A/B/C/D"), "A/D")
        self.assertEqual(split_display_name(""), "")

if __name__ == '__main__':
    unittest.main()
