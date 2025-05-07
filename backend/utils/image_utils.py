import logging
from typing import Union, BinaryIO

from utils.config_utils import config_manager

from nexent.core.models.openai_vlm import OpenAIVLModel
from nexent.core import MessageObserver

def convert_image_to_text(query: str, image_input: Union[str, BinaryIO]):
    
    logging.info("%s %s", config_manager.get_config("VLM_MODEL_NAME"), config_manager.get_config("VLM_MODEL_URL"))
    
    image_to_text_model = OpenAIVLModel(
        observer=MessageObserver(),
        model_id=config_manager.get_config("VLM_MODEL_NAME"),
        api_base=config_manager.get_config("VLM_MODEL_URL"),
        api_key=config_manager.get_config("VLM_API_KEY"),
        temperature=0.7,
        top_p=0.7,
        frequency_penalty=0.5,
        max_tokens=512
        )
    prompt = f"用户提出了一个问题：{query}，请从回答这个问题的角度精简、仔细描述一下这个图片，200字以内。"
    
    return image_to_text_model.analyze_image(image_input=image_input, system_prompt=prompt).content
