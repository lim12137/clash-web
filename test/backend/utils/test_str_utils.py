import unittest
from unittest.mock import MagicMock

# Mock logger
logger_mock = MagicMock()


class TestStrUtils:
    """Test str_utils module functions"""

    def setup_method(self):
        """Setup before each test method"""
        # Import the functions under test
        from backend.utils.str_utils import remove_think_tags, add_no_think_token
        self.remove_think_tags = remove_think_tags
        self.add_no_think_token = add_no_think_token

    def test_remove_think_tags_no_tags(self):
        """Test remove_think_tags with text containing no think tags"""
        text = "This is a normal text without any think tags."
        result = self.remove_think_tags(text)
        assert result == text

    def test_remove_think_tags_with_opening_tag(self):
        """Test remove_think_tags with text containing only opening think tag"""
        text = "This text has <think>some thinking content"
        result = self.remove_think_tags(text)
        expected = "This text has some thinking content"
        assert result == expected

    def test_remove_think_tags_with_closing_tag(self):
        """Test remove_think_tags with text containing only closing think tag"""
        text = "This text has some thinking content</think>"
        result = self.remove_think_tags(text)
        expected = "This text has some thinking content"
        assert result == expected

    def test_remove_think_tags_with_both_tags(self):
        """Test remove_think_tags with text containing both opening and closing think tags"""
        text = "This text has <think>some thinking content</think> in it."
        result = self.remove_think_tags(text)
        expected = "This text has some thinking content in it."
        assert result == expected

    def test_remove_think_tags_multiple_tags(self):
        """Test remove_think_tags with multiple think tags"""
        text = "<think>First thought</think> Normal text <think>Second thought</think>"
        result = self.remove_think_tags(text)
        expected = "First thought Normal text Second thought"
        assert result == expected

    def test_remove_think_tags_nested_tags(self):
        """Test remove_think_tags with nested think tags"""
        text = "<think>Outer <think>Inner</think> Outer</think>"
        result = self.remove_think_tags(text)
        expected = "Outer Inner Outer"
        assert result == expected

    def test_remove_think_tags_empty_string(self):
        """Test remove_think_tags with empty string"""
        text = ""
        result = self.remove_think_tags(text)
        assert result == ""

    def test_remove_think_tags_only_tags(self):
        """Test remove_think_tags with text containing only think tags"""
        text = "<think></think>"
        result = self.remove_think_tags(text)
        assert result == ""

    def test_remove_think_tags_partial_tags(self):
        """Test remove_think_tags with partial tag names"""
        text = "Text with <thin>partial tag</thin>"
        result = self.remove_think_tags(text)
        assert result == text  # Should not be modified

    def test_remove_think_tags_case_sensitive(self):
        """Test remove_think_tags is case sensitive"""
        text = "Text with <THINK>uppercase</THINK> tags"
        result = self.remove_think_tags(text)
        assert result == text  # Should not be modified

    def test_add_no_think_token_user_message(self):
        """Test add_no_think_token with user message"""
        messages = [
            {"role": "assistant", "content": "Hello"},
            {"role": "user", "content": "How are you?"}
        ]
        
        self.add_no_think_token(messages)
        
        # Check that /no_think was added to the last user message
        assert messages[-1]["content"] == "How are you? /no_think"

    def test_add_no_think_token_assistant_message(self):
        """Test add_no_think_token with assistant as last message (should not modify)"""
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ]
        
        original_content = messages[-1]["content"]
        self.add_no_think_token(messages)
        
        # Check that content was not modified
        assert messages[-1]["content"] == original_content

    def test_add_no_think_token_empty_messages(self):
        """Test add_no_think_token with empty messages list"""
        messages = []
        
        # Should not raise an exception
        self.add_no_think_token(messages)
        
        # Messages should remain empty
        assert messages == []

    def test_add_no_think_token_single_user_message(self):
        """Test add_no_think_token with single user message"""
        messages = [{"role": "user", "content": "Hello"}]
        
        self.add_no_think_token(messages)
        
        assert messages[0]["content"] == "Hello /no_think"

    def test_add_no_think_token_user_message_with_existing_no_think(self):
        """Test add_no_think_token with user message that already has /no_think"""
        messages = [
            {"role": "assistant", "content": "Hello"},
            {"role": "user", "content": "How are you? /no_think"}
        ]
        
        self.add_no_think_token(messages)
        
        # Should not add another /no_think
        assert messages[-1]["content"] == "How are you? /no_think"

    def test_add_no_think_token_user_message_with_whitespace(self):
        """Test add_no_think_token with user message that has trailing whitespace"""
        messages = [
            {"role": "assistant", "content": "Hello"},
            {"role": "user", "content": "How are you? "}
        ]
        
        self.add_no_think_token(messages)
        
        # Should add /no_think after existing whitespace
        assert messages[-1]["content"] == "How are you?  /no_think"

    def test_add_no_think_token_mixed_message_types(self):
        """Test add_no_think_token with various message types"""
        messages = [
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": "First question"},
            {"role": "assistant", "content": "First answer"},
            {"role": "user", "content": "Second question"},
            {"role": "assistant", "content": "Second answer"},
            {"role": "user", "content": "Final question"}
        ]
        
        self.add_no_think_token(messages)
        
        # Only the last user message should be modified
        assert messages[1]["content"] == "First question"
        assert messages[3]["content"] == "Second question"
        assert messages[5]["content"] == "Final question /no_think"

    def test_add_no_think_token_messages_without_role(self):
        """Test add_no_think_token with messages missing role field"""
        messages = [
            {"content": "Message without role"},
            {"role": "user", "content": "User message"}
        ]
        
        # Should not raise an exception and should process the last message correctly
        self.add_no_think_token(messages)
        
        assert messages[-1]["content"] == "User message /no_think"

    def test_add_no_think_token_messages_without_content(self):
        """Test add_no_think_token with messages missing content field"""
        messages = [
            {"role": "user", "content": "User message"},
            {"role": "assistant"}  # Missing content
        ]
        
        # Should not raise an exception
        self.add_no_think_token(messages)
        
        # The assistant message should remain unchanged
        assert "content" not in messages[-1]


if __name__ == "__main__":
    unittest.main() 