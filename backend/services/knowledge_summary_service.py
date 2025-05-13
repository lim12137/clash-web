import os
from typing import List, Dict

import yaml
from dotenv import load_dotenv
from smolagents.models import OpenAIServerModel


def load_knowledge_prompts() -> Dict[str, str]:
    """
    The prompt words for loading the knowledge base summary

    Returns:
        Dict[str, str]: A dictionary containing the prompt words "system" and "user"
    """
    prompt_file = 'backend/prompts/knowledge_summery_agent.yaml'

    with open(prompt_file, 'r', encoding='utf-8') as f:
        prompts = yaml.safe_load(f)

    return prompts


def generate_knowledge_summery(keywords: str) -> str:
    """
    Generate a knowledge base summary based on keywords

    Args:
        keywords: Keywords that frequently appear in the knowledge base content

    Returns:
        str:  Generate a knowledge base summary
    """

    # Load environment variables
    load_dotenv()

    # Load prompt words
    prompts = load_knowledge_prompts()

    # Create OpenAIServerModel instance
    llm = OpenAIServerModel(model_id=os.getenv('LLM_SECONDARY_MODEL_NAME'),
        api_base=os.getenv('LLM_SECONDARY_MODEL_URL'), api_key=os.getenv('LLM_SECONDARY_API_KEY'), temperature=0.3,
        top_p=0.95)

    # Build messages
    messages = [{"role": "system", "content": prompts['system_prompt']},
        {"role": "user", "content": prompts['user_prompt'].format(content=keywords)}]

    # Call the model
    response = llm(messages)

    return response.content.strip()