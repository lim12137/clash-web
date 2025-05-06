import base64
import os
from typing import List, Dict, Any, Union, BinaryIO

from smolagents.models import ChatMessage

from ..models import OpenAIModel
from ..utils.observer import MessageObserver


class OpenAIVLModel(OpenAIModel):
    def __init__(self, observer: MessageObserver, temperature=0.7, top_p=0.7, frequency_penalty=0.5, max_tokens=512,
            *args, **kwargs):
        super().__init__(observer=observer, *args, **kwargs)
        self.temperature = temperature
        self.top_p = top_p
        self.frequency_penalty = frequency_penalty
        self.max_tokens = max_tokens
        self._current_request = None  # 用于存储当前请求

    def check_connectivity(self) -> bool:
        """
        检查VLM模型的连通性。

        Returns:
            bool: 如果模型可以正常响应则返回True，否则返回False
        """
        try:
            # 直接复用父类的check_connectivity方法
            return super().check_connectivity()
        except Exception as e:
            import logging
            logging.error(f"VLM connectivity check failed: {str(e)}")
            return False

    def encode_image(self, image_input: Union[str, BinaryIO]) -> str:
        """
        将图像文件或文件流编码为base64字符串

        Args:
            image_input: 图像文件路径或文件流对象

        Returns:
            str: base64编码后的图像数据
        """
        if isinstance(image_input, str):
            with open(image_input, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode('utf-8')
        else:
            # 对于文件流对象，直接读取
            return base64.b64encode(image_input.read()).decode('utf-8')

    def prepare_image_message(self, image_input: Union[str, BinaryIO], system_prompt: str = "Describe this picture.") -> \
    List[Dict[str, Any]]:
        """
        准备包含图像的消息格式

        Args:
            image_input: 图像文件路径或文件流对象
            system_prompt: 系统提示词

        Returns:
            List[Dict[str, Any]]: 准备好的消息列表
        """
        base64_image = self.encode_image(image_input)

        # 检测图像格式
        image_format = "jpeg"  # 默认格式
        if isinstance(image_input, str) and os.path.exists(image_input):
            _, ext = os.path.splitext(image_input)
            if ext.lower() in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
                image_format = ext.lower()[1:]  # 移除点号
                if image_format == 'jpg':
                    image_format = 'jpeg'

        messages = [{"role": "system", "content": [{"text": system_prompt, "type": "text"}]}, {"role": "user",
            "content": [{"type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{base64_image}", "detail": "auto"}}]}]

        return messages

    def analyze_image(self, image_input: Union[str, BinaryIO],
            system_prompt: str = "请精简、仔细描述一下这个图片，200字以内。", stream: bool = True,
            **kwargs) -> ChatMessage:
        """
        分析图像内容

        Args:
            image_input: 图像文件路径或文件流对象
            system_prompt: 系统提示词
            stream: 是否流式输出
            **kwargs: 其他参数

        Returns:
            ChatMessage: 模型返回的消息
        """
        messages = self.prepare_image_message(image_input, system_prompt)
        return self(messages=messages, **kwargs)
