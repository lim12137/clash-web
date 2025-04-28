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
                 "content": "Please generate a concise and accurate title (no more than 12 characters) for the following conversation, highlighting the core theme or key information. The title should be natural and fluent, avoiding forced keyword stacking.\n\n**Title Generation Requirements:**\n1. If the conversation involves specific questions, the title should summarize the essence of the question (e.g., 'How to solve XX issue?');\n2. If the conversation is about knowledge sharing, the title should highlight the core knowledge point (e.g., 'Key Steps of Photosynthesis');\n3. Avoid using generic terms like 'Q&A' or 'Consultation', prioritize domain specificity;\n4. The title language should match the conversation language.\n\n**Examples:**\n- Conversation: User asking about multiple methods for Python list deduplication → Title: Python List Deduplication Techniques\n- Conversation: Discussion about factors affecting new energy vehicle battery life → Title: Factors Affecting EV Battery Life\n- Conversation: 你好 → Title: 你好\n\nPlease output only the generated title without additional explanation."},
        {"role": "user", "content": f"Please generate a concise title (no more than 12 characters) based on the following conversation:\n{content}\n\nTitle："}]

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
