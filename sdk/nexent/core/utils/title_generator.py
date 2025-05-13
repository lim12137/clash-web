import os
from typing import List, Dict

import yaml
from dotenv import load_dotenv
from smolagents.models import OpenAIServerModel


def extract_user_messages(history: List[Dict[str, str]]) -> str:
    """
    从历史记录中提取用户消息内容

    Args:
        history: 对话历史记录列表

    Returns:
        str: 拼接后的用户消息内容
    """
    content = ""
    for message in history:
        if message.get("role") == "user" and message.get("content"):
            content += message["content"] + "\n"
    return content


def load_prompts() -> Dict[str, str]:
    """
    加载标题生成的提示词

    Returns:
        Dict[str, str]: 包含system和user提示词的字典
    """
    current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    prompt_path = os.path.join(current_dir, "prompts", "title_generator.yaml")

    with open(prompt_path, 'r', encoding='utf-8') as f:
        prompts = yaml.safe_load(f)

    return prompts['title_generation']


def generate_title(history: List[Dict[str, str]]) -> str:
    """
    根据对话历史生成标题

    Args:
        history: 对话历史记录列表，每个记录包含role和content字段

    Returns:
        str: 生成的标题
    """
    # 提取用户消息
    content = extract_user_messages(history)

    # 加载环境变量
    load_dotenv()

    # 加载提示词
    prompts = load_prompts()

    # 创建OpenAIServerModel实例
    llm = OpenAIServerModel(model_id=os.getenv('LLM_SECONDARY_MODEL_NAME'),
        api_base=os.getenv('LLM_SECONDARY_MODEL_URL'), api_key=os.getenv('LLM_SECONDARY_API_KEY'), temperature=0.3,
        top_p=0.95)

    # 构建消息
    messages = [{"role": "system", "content": prompts['system']},
        {"role": "user", "content": prompts['user'].format(content=content)}]

    # 调用模型
    response = llm(messages)

    return response.content.strip()