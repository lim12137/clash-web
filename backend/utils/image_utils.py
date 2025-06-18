import logging
from typing import Union, BinaryIO

from utils.config_utils import tenant_config_manager, get_model_name_from_config

from nexent.core.models.openai_vlm import OpenAIVLModel
from nexent.core import MessageObserver

def convert_image_to_text(query: str, image_input: Union[str, BinaryIO], tenant_id:str):
    
    vlm_model_config = tenant_config_manager.get_model_config(key="VLM_ID", tenant_id=tenant_id)

    logging.info("%s %s", vlm_model_config.get("model_name"), vlm_model_config.get("base_url"))

    image_to_text_model = OpenAIVLModel(
        observer=MessageObserver(),
        model_id=get_model_name_from_config(vlm_model_config) if vlm_model_config else "",
        api_base=vlm_model_config["base_url"] if vlm_model_config else "",
        api_key=vlm_model_config["api_key"] if vlm_model_config else "",
        temperature=0.7,
        top_p=0.7,
        frequency_penalty=0.5,
        max_tokens=512
        )
    prompt = f"用户提出了一个问题：{query}，请从回答这个问题的角度精简、仔细描述一下这个图片，200字以内。"
    
    return image_to_text_model.analyze_image(image_input=image_input, system_prompt=prompt).content
