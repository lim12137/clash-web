import os
from typing import Dict, Generator
from openai import OpenAI

import yaml
from dotenv import load_dotenv


def load_knowledge_prompts() -> Dict[str, str]:
    """
    The prompt words for loading the knowledge base summary

    Returns:
        Dict[str, str]: A dictionary containing the prompt words "system" and "user"
    """
    prompt_file = 'backend/prompts/knowledge_summary_agent.yaml'

    with open(prompt_file, 'r', encoding='utf-8') as f:
        prompts = yaml.safe_load(f)

    return prompts


def generate_knowledge_summary_stream(keywords: str) -> Generator:
    """
    Generate a knowledge base summary based on keywords

    Args:
        keywords: Keywords that frequently appear in the knowledge base content

    Returns:
        str:  Generate a knowledge base summary
    """
    # todo
    keywords = "医疗"
    # Load environment variables
    load_dotenv()

    # Load prompt words
    prompts = load_knowledge_prompts()

    # Build messages
    messages = [{"role": "system", "content": prompts['system_prompt']},
        {"role": "user", "content": prompts['user_prompt'].format(content=keywords)}]

    # 初始化 OpenAI 客户端
    client = OpenAI(api_key=os.getenv('LLM_SECONDARY_API_KEY'),
                    base_url=os.getenv('LLM_SECONDARY_MODEL_URL'))

    try:
        # 创建流式聊天完成请求
        stream = client.chat.completions.create(
            model=os.getenv('LLM_SECONDARY_MODEL_NAME'),  # 可以根据需要更换模型
            messages=messages,
            stream=True  # 启用流式输出
        )

        # 迭代处理流式响应
        for chunk in stream:
            new_token = chunk.choices[0].delta.content
            if new_token is not None:
                yield new_token
        yield "END"

    except Exception as e:
        print(f"发生错误: {str(e)}")
        yield f"错误: {str(e)}"
