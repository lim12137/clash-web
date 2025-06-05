import logging
import threading
from typing import List, Optional, Dict, Any

from openai.types.chat.chat_completion_message import ChatCompletionMessage
from smolagents import Tool
from smolagents.models import OpenAIServerModel, ChatMessage

from ..utils.observer import MessageObserver, ProcessType


class OpenAIModel(OpenAIServerModel):
    def __init__(self, observer: MessageObserver, temperature=0.2, top_p=0.95, *args, **kwargs):
        self.observer = observer
        self.temperature = temperature
        self.top_p = top_p
        self.stop_event = threading.Event()
        super().__init__(*args, **kwargs)


    def __call__(self, messages: List[Dict[str, Any]], stop_sequences: Optional[List[str]] = None,
            grammar: Optional[str] = None, tools_to_call_from: Optional[List[Tool]] = None, **kwargs, ) -> ChatMessage:
        try:
            completion_kwargs = self._prepare_completion_kwargs(messages=messages, stop_sequences=stop_sequences,
                grammar=grammar, tools_to_call_from=tools_to_call_from, model=self.model_id,
                custom_role_conversions=self.custom_role_conversions, convert_images_to_image_urls=True,
                temperature=self.temperature, top_p=self.top_p, **kwargs, )

            current_request = self.client.chat.completions.create(stream=True, **completion_kwargs)
            chunk_list = []
            token_join = []
            role = None

            # 重置输出模式
            self.observer.current_mode = ProcessType.MODEL_OUTPUT_THINKING
            for chunk in current_request:
                new_token = chunk.choices[0].delta.content
                if new_token is not None:
                    print(new_token, end="")
                    self.observer.add_model_new_token(new_token)
                    token_join.append(new_token)
                    role = chunk.choices[0].delta.role
                chunk_list.append(chunk)
                if self.stop_event.is_set():
                    raise RuntimeError("Model is interrupted by stop event")

            # 发送结束标记
            self.observer.flush_remaining_tokens()
            model_output = "".join(token_join)

            if chunk_list[-1].usage is not None:
                self.last_input_token_count = chunk_list[-1].usage.prompt_tokens
                self.last_output_token_count = chunk_list[-1].usage.total_tokens
            else:
                self.last_input_token_count = 0
                self.last_output_token_count = 0

            message = ChatMessage.from_dict(
                ChatCompletionMessage(role=role if role else "assistant",  # 如果没有明确角色，默认使用 "assistant"
                    content=model_output).model_dump(include={"role", "content", "tool_calls"}))

            message.raw = current_request
            return self.postprocess_message(message, tools_to_call_from)

        except Exception as e:
            if "context_length_exceeded" in str(e):
                raise ValueError(f"Token limit exceeded: {str(e)}")
            raise e

    def check_connectivity(self) -> bool:
        """
        测试与远程OpenAI大模型服务的连接是否正常
        
        Returns:
            bool: 连接成功返回True，失败返回False
        """
        try:
            # 构建一个简单的测试消息
            test_message = [{"role": "user", "content": "Hello"}]

            # 直接发送一个简短的聊天请求来测试连接
            completion_kwargs = self._prepare_completion_kwargs(messages=test_message, model=self.model_id,
                max_tokens=5)

            # 发送请求但不使用流式传输，减少开销
            response = self.client.chat.completions.create(stream=False, **completion_kwargs)

            # 如果没有引发异常，则连接成功
            return True
        except Exception as e:
            logging.error(f"连接测试失败: {str(e)}")
            return False
