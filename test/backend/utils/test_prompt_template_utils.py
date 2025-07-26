import pytest

from utils.prompt_template_utils import get_prompt_template_path, get_prompt_generate_config_path


class TestPromptTemplateUtils:
    """Test cases for prompt_template_utils module"""

    def test_get_prompt_template_path_manager_zh(self):
        """Test get_prompt_template_path for manager mode in Chinese"""
        result = get_prompt_template_path(is_manager=True, language='zh')
        expected = "backend/prompts/manager_system_prompt_template.yaml"
        assert result == expected

    def test_get_prompt_template_path_manager_en(self):
        """Test get_prompt_template_path for manager mode in English"""
        result = get_prompt_template_path(is_manager=True, language='en')
        expected = "backend/prompts/manager_system_prompt_template_en.yaml"
        assert result == expected

    def test_get_prompt_template_path_managed_zh(self):
        """Test get_prompt_template_path for managed mode in Chinese"""
        result = get_prompt_template_path(is_manager=False, language='zh')
        expected = "backend/prompts/managed_system_prompt_template.yaml"
        assert result == expected

    def test_get_prompt_template_path_managed_en(self):
        """Test get_prompt_template_path for managed mode in English"""
        result = get_prompt_template_path(is_manager=False, language='en')
        expected = "backend/prompts/managed_system_prompt_template_en.yaml"
        assert result == expected

    def test_get_prompt_generate_config_path_zh(self):
        """Test get_prompt_generate_config_path for Chinese"""
        result = get_prompt_generate_config_path(language='zh')
        expected = 'backend/prompts/utils/prompt_generate.yaml'
        assert result == expected

    def test_get_prompt_generate_config_path_en(self):
        """Test get_prompt_generate_config_path for English"""
        result = get_prompt_generate_config_path(language='en')
        expected = 'backend/prompts/utils/prompt_generate_en.yaml'
        assert result == expected

    def test_get_prompt_generate_config_path_default_language(self):
        """Test get_prompt_generate_config_path with default language (should be Chinese)"""
        result = get_prompt_generate_config_path()
        expected = 'backend/prompts/utils/prompt_generate.yaml'
        assert result == expected


if __name__ == '__main__':
    pytest.main()
