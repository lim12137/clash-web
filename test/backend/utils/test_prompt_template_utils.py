import pytest
import yaml
from unittest.mock import patch, mock_open

from utils.prompt_template_utils import get_agent_prompt_template, get_prompt_generate_prompt_template


class TestPromptTemplateUtils:
    """Test cases for prompt_template_utils module"""

    @patch('builtins.open', new_callable=mock_open, read_data='{"test": "data"}')
    @patch('yaml.safe_load')
    def test_get_agent_prompt_template_manager_zh(self, mock_yaml_load, mock_file):
        """Test get_agent_prompt_template for manager mode in Chinese"""
        mock_yaml_load.return_value = {"test": "data"}
        result = get_agent_prompt_template(is_manager=True, language='zh')
        
        # Verify the function was called with correct parameters
        mock_file.assert_called_with('backend/prompts/manager_system_prompt_template.yaml', 'r', encoding='utf-8')
        mock_yaml_load.assert_called_once()
        assert result == {"test": "data"}

    @patch('builtins.open', new_callable=mock_open, read_data='{"test": "data"}')
    @patch('yaml.safe_load')
    def test_get_agent_prompt_template_manager_en(self, mock_yaml_load, mock_file):
        """Test get_agent_prompt_template for manager mode in English"""
        mock_yaml_load.return_value = {"test": "data"}
        result = get_agent_prompt_template(is_manager=True, language='en')
        
        # Verify the function was called with correct parameters
        mock_file.assert_called_with('backend/prompts/manager_system_prompt_template_en.yaml', 'r', encoding='utf-8')
        mock_yaml_load.assert_called_once()
        assert result == {"test": "data"}

    @patch('builtins.open', new_callable=mock_open, read_data='{"test": "data"}')
    @patch('yaml.safe_load')
    def test_get_agent_prompt_template_managed_zh(self, mock_yaml_load, mock_file):
        """Test get_agent_prompt_template for managed mode in Chinese"""
        mock_yaml_load.return_value = {"test": "data"}
        result = get_agent_prompt_template(is_manager=False, language='zh')
        
        # Verify the function was called with correct parameters
        mock_file.assert_called_with('backend/prompts/managed_system_prompt_template.yaml', 'r', encoding='utf-8')
        mock_yaml_load.assert_called_once()
        assert result == {"test": "data"}

    @patch('builtins.open', new_callable=mock_open, read_data='{"test": "data"}')
    @patch('yaml.safe_load')
    def test_get_agent_prompt_template_managed_en(self, mock_yaml_load, mock_file):
        """Test get_agent_prompt_template for managed mode in English"""
        mock_yaml_load.return_value = {"test": "data"}
        result = get_agent_prompt_template(is_manager=False, language='en')
        
        # Verify the function was called with correct parameters
        mock_file.assert_called_with('backend/prompts/managed_system_prompt_template_en.yaml', 'r', encoding='utf-8')
        mock_yaml_load.assert_called_once()
        assert result == {"test": "data"}

    @patch('builtins.open', new_callable=mock_open, read_data='{"test": "data"}')
    @patch('yaml.safe_load')
    def test_get_prompt_generate_prompt_template_zh(self, mock_yaml_load, mock_file):
        """Test get_prompt_generate_prompt_template for Chinese"""
        mock_yaml_load.return_value = {"test": "data"}
        result = get_prompt_generate_prompt_template(language='zh')
        
        # Verify the function was called with correct parameters
        mock_file.assert_called_with('backend/prompts/utils/prompt_generate.yaml', 'r', encoding='utf-8')
        mock_yaml_load.assert_called_once()
        assert result == {"test": "data"}

    @patch('builtins.open', new_callable=mock_open, read_data='{"test": "data"}')
    @patch('yaml.safe_load')
    def test_get_prompt_generate_prompt_template_en(self, mock_yaml_load, mock_file):
        """Test get_prompt_generate_prompt_template for English"""
        mock_yaml_load.return_value = {"test": "data"}
        result = get_prompt_generate_prompt_template(language='en')
        
        # Verify the function was called with correct parameters
        mock_file.assert_called_with('backend/prompts/utils/prompt_generate_en.yaml', 'r', encoding='utf-8')
        mock_yaml_load.assert_called_once()
        assert result == {"test": "data"}

    @patch('builtins.open', new_callable=mock_open, read_data='{"test": "data"}')
    @patch('yaml.safe_load')
    def test_get_prompt_generate_prompt_template_default_language(self, mock_yaml_load, mock_file):
        """Test get_prompt_generate_prompt_template with default language (should be Chinese)"""
        mock_yaml_load.return_value = {"test": "data"}
        result = get_prompt_generate_prompt_template()
        
        # Verify the function was called with correct parameters
        mock_file.assert_called_with('backend/prompts/utils/prompt_generate.yaml', 'r', encoding='utf-8')
        mock_yaml_load.assert_called_once()
        assert result == {"test": "data"}


if __name__ == '__main__':
    pytest.main()
