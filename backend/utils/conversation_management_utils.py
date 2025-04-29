import os
from typing import List, Dict

from fastapi import HTTPException
from smolagents import OpenAIServerModel

from database.conversation_db import rename_conversation


def extract_user_messages(history: List[Dict[str, str]]) -> str:
    """
    Extract user message content from conversation history

    Args:
        history: List of conversation history records

    Returns:
        str: Concatenated user message content
    """
    content = ""
    for message in history:
        if message.get("role") == "user" and message.get("content"):
            content += f"\n### User Question：\n{message['content']}\n"
        if message.get("role") == "assistant" and message.get("content"):
            content += f"\n### Response Content：\n{message['content']}\n"
    return content


def call_llm_for_title(content: str) -> str:
    """
    Call LLM to generate a title

    Args:
        content: Conversation content

    Returns:
        str: Generated title
    """
    # Create OpenAIServerModel instance
    llm = OpenAIServerModel(model_id=os.getenv('LLM_MODEL_NAME'), api_base=os.getenv('LLM_MODEL_URL'),
        api_key=os.getenv('LLM_API_KEY'), temperature=0.7, top_p=0.95)

    # Build messages
    messages = [{"role": "system",
                 "content": "请为以下对话生成一个简洁、准确的标题（不超过12字），要求突出对话的核心主题或关键信息。注意标题应自然流畅，避免生硬的关键词堆砌。\n\n**标题生成要求：**\n1. 如果对话涉及具体问题，标题需概括问题本质（如：'如何解决XX故障？'）；\n2. 若对话为知识科普，标题应点明核心知识点（如：'光合作用的关键步骤'）；\n3. 避免使用泛泛词汇如'问答''咨询'，优先体现领域特异性；\n4.标题语言与对话语言保持一致。\n\n**示例：**\n- 对话：用户询问Python列表去重的多种方法 → 标题：Python列表去重技巧\n- 对话：讨论新能源汽车电池寿命影响因素 → 标题：影响电动车电池寿命的因素- 对话：你好 → 标题：你好\n\n请直接输出生成的标题，无需额外解释。"},
        {"role": "user", "content": f"请根据以下对话内容生成一个简洁的标题，不超过12个字：\n{content}\n\n标题："}]

    # Call the model
    response = llm(messages, max_tokens=10)

    return response.content.strip()


def update_conversation_title(conversation_id: int, title: str, user_id: str = None) -> bool:
    """
    Update conversation title

    Args:
        conversation_id: Conversation ID
        title: New title
        user_id: Reserved parameter, user ID
    Returns:
        bool: Whether the update was successful
    """
    success = rename_conversation(conversation_id, title)
    if not success:
        raise HTTPException(status_code=404, detail=f"Conversation {conversation_id} does not exist or has been deleted")
    return success
