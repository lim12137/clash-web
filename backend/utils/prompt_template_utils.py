def get_prompt_template_path(is_manager: bool, language: str = 'zh') -> str:
    """
    Get the prompt template path based on the agent type and language
    
    Args:
        is_manager: Whether it is a manager mode
        language: Language code ('zh' or 'en')
        
    Returns:
        str: Prompt template file path
    """
    if language == 'en':
        if is_manager:
            return "backend/prompts/manager_system_prompt_template_en.yaml"
        else:
            return "backend/prompts/managed_system_prompt_template_en.yaml"
    else:  # Default to Chinese
        if is_manager:
            return "backend/prompts/manager_system_prompt_template.yaml"
        else:
            return "backend/prompts/managed_system_prompt_template.yaml"


def get_prompt_generate_config_path(language: str = 'zh') -> str:
    """
    Get the prompt generation configuration file path based on the language
    
    Args:
        language: Language code ('zh' or 'en')
        
    Returns:
        str: Prompt generation configuration file path
    """
    if language == 'en':
        return 'backend/prompts/utils/prompt_generate_en.yaml'
    else:  # Default to Chinese
        return 'backend/prompts/utils/prompt_generate.yaml'
