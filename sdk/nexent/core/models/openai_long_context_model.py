from typing import List, Dict, Any, Union, BinaryIO
from pathlib import Path

from smolagents.models import ChatMessage

from ..models import OpenAIModel
from ..utils.observer import MessageObserver


class OpenAILongContextModel(OpenAIModel):
    """
    长上下文模型类，用于处理大型文本文件
    支持自动截断超出上下文限制的内容
    """
    
    def __init__(self, observer: MessageObserver, temperature=0.5, top_p=0.95,
                 max_context_tokens=128000, truncation_strategy="start", *args, **kwargs):
        """
        初始化长上下文模型
        
        Args:
            observer: 消息观察器
            temperature: 温度参数
            top_p: top_p参数
            max_context_tokens: 最大上下文token数，默认128k
            truncation_strategy: 截断策略
                - "start": 仅保留开头部分
                - "middle": 保留开头和结尾部分
                - "end": 仅保留末尾部分
            *args, **kwargs: 其他参数
        """
        super().__init__(observer=observer, temperature=temperature, top_p=top_p, *args, **kwargs)
        self.max_context_tokens = max_context_tokens
        if truncation_strategy not in ["start", "middle", "end"]:
            raise ValueError("truncation_strategy必须是'start'、'middle'或'end'")
        self.truncation_strategy = truncation_strategy
        self._tokenizer = None
    
    def _get_tokenizer(self):
        """获取tokenizer，用于计算token数量"""
        if self._tokenizer is None:
            try:
                import tiktoken
                self._tokenizer = tiktoken.get_encoding("cl100k_base")
            except ImportError:
                # 如果没有tiktoken，使用简单的字符计数估算
                self._tokenizer = None
        return self._tokenizer
    
    def count_tokens(self, text: str) -> int:
        """
        计算文本的token数量
        
        Args:
            text: 要计算的文本
            
        Returns:
            int: token数量
        """
        tokenizer = self._get_tokenizer()
        if tokenizer:
            return len(tokenizer.encode(text))
        else:
            # 简单的字符计数估算（大约4个字符=1个token）
            return len(text) // 4
    
    def count_messages_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """
        计算消息列表的总token数量
        
        Args:
            messages: 消息列表
            
        Returns:
            int: 总token数量
        """
        total_tokens = 0
        for message in messages:
            content = message.get("content", "")
            if isinstance(content, list):
                # 处理多模态内容
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        total_tokens += self.count_tokens(item.get("text", ""))
            else:
                total_tokens += self.count_tokens(str(content))
        return total_tokens
    
    def truncate_text(self, text: str, max_tokens: int) -> str:
        """
        截断文本到指定的token数量
        
        Args:
            text: 要截断的文本
            max_tokens: 最大token数量
            
        Returns:
            str: 截断后的文本
        """
        if self.count_tokens(text) <= max_tokens:
            return text

        print(f"触发截断，长度：{max_tokens}")
        tokenizer = self._get_tokenizer()
        if tokenizer:
            # 使用tiktoken进行精确截断
            tokens = tokenizer.encode(text)
            if len(tokens) <= max_tokens:
                return text
            
            if self.truncation_strategy == "start":
                # 仅保留开头部分
                truncated_tokens = tokens[:max_tokens]
                return tokenizer.decode(truncated_tokens)
            elif self.truncation_strategy == "middle":
                # 保留开头和结尾，截断中间部分
                half_tokens = max_tokens // 2
                start_tokens = tokens[:half_tokens]
                end_tokens = tokens[-(max_tokens - half_tokens):]
                truncated_tokens = start_tokens + end_tokens
                return tokenizer.decode(truncated_tokens)
            else:  # end
                # 保留末尾部分
                truncated_tokens = tokens[-max_tokens:]
                return tokenizer.decode(truncated_tokens)
        else:
            # 使用字符计数进行估算截断
            estimated_chars = max_tokens * 4
            if len(text) <= estimated_chars:
                return text
            
            if self.truncation_strategy == "start":
                # 仅保留开头部分
                return text[:estimated_chars]
            elif self.truncation_strategy == "middle":
                # 保留开头和结尾
                half_chars = estimated_chars // 2
                start_text = text[:half_chars]
                end_text = text[-(estimated_chars - half_chars):]
                return start_text + "\n\n[内容已截断...]\n\n" + end_text
            else:  # end
                # 保留末尾部分
                return text[-estimated_chars:]
    
    def read_text_file(self, file_input: Union[str, BinaryIO]) -> str:
        """
        读取文本文件内容
        
        Args:
            file_input: 文件路径或文件流对象
            
        Returns:
            str: 文件内容
        """
        if isinstance(file_input, str):
            file_path = Path(file_input)
            if not file_path.exists():
                raise FileNotFoundError(f"文件不存在: {file_input}")
            
            # 检查文件大小，避免读取过大的文件
            file_size = file_path.stat().st_size
            if file_size > 100 * 1024 * 1024:  # 100MB限制
                raise ValueError(f"文件过大: {file_size / 1024 / 1024:.2f}MB，最大支持100MB")
            
            # 尝试不同的编码格式
            encodings = ['utf-8', 'gbk', 'gb2312', 'latin-1']
            for encoding in encodings:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        return f.read()
                except UnicodeDecodeError:
                    continue
            
            raise UnicodeDecodeError(f"无法解码文件: {file_input}")
        else:
            # 对于文件流对象，直接读取
            return file_input.read().decode('utf-8')
    
    def prepare_long_text_message(self, text_content: str, system_prompt: str, user_prompt: str):
        """
        准备包含长文本的消息格式，自动处理截断
        
        Args:
            text_content: 文本内容
            system_prompt: 系统提示词
            user_prompt: 用户提示词
            
        Returns:
            List[Dict[str, Any]]: 准备好的消息列表
        """
        # 计算系统提示词和用户提示词的token数量
        system_tokens = self.count_tokens(system_prompt)
        user_prompt_tokens = self.count_tokens(user_prompt)
        
        # 为文本内容预留的token数量
        available_tokens = self.max_context_tokens - system_tokens - user_prompt_tokens - 100  # 预留100个token作为缓冲
        
        # 截断文本内容
        truncated_text = self.truncate_text(text_content, available_tokens)
        
        # 构建消息
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"{user_prompt}\n\n{truncated_text}"}
        ]
        
        return messages
    
    def analyze_text_file(self, query: str, file_input: Union[str, BinaryIO]) -> ChatMessage:
        """
        分析文本文件内容
        
        Args:
            query: 用户问题
            file_input: 文本文件路径或文件流对象
            
        Returns:
            ChatMessage: 模型返回的消息
        """
        # 读取文件内容
        text_content = self.read_text_file(file_input)
        system_prompt = f"用户提出了一个问题：{query}，请从回答这个问题的角度精简、仔细描述一下这段文本，200字以内。"
        user_prompt = "请仔细阅读并分析这段文本："
        messages = self.analyze_long_text(text_content, system_prompt, user_prompt)
        return messages
    
    def analyze_long_text(self, text_content: str, system_prompt: str, user_prompt: str) -> ChatMessage:
        """
        分析长文本内容
        
        Args:
            text_content: 文本内容
            system_prompt: 系统提示词
            user_prompt: 用户提示词
            
        Returns:
            ChatMessage: 模型返回的消息
        """
        messages = self.prepare_long_text_message(text_content, system_prompt, user_prompt)
        return self(messages=messages)
    
    def get_context_usage_info(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        获取上下文使用情况信息
        
        Args:
            messages: 消息列表
            
        Returns:
            Dict[str, Any]: 包含token使用情况的信息
        """
        total_tokens = self.count_messages_tokens(messages)
        usage_percentage = (total_tokens / self.max_context_tokens) * 100
        
        return {
            "total_tokens": total_tokens,
            "max_context_tokens": self.max_context_tokens,
            "usage_percentage": usage_percentage,
            "remaining_tokens": self.max_context_tokens - total_tokens,
            "is_truncated": total_tokens > self.max_context_tokens
        }


def example_analyze_text_file():
    """示例：分析文本文件"""
    print("=== 文本文件分析示例 ===")

    # 创建示例文件
    sample_file = "C:/Users/18070/Desktop/斗罗大陆.txt"

    try:
        # 初始化观察器和模型
        observer = MessageObserver()
        model = OpenAILongContextModel(
            observer=observer,
            model_id="deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
            api_base="https://api.siliconflow.cn/v1",
            api_key="sk-pmhfdhethzxyxzfbhtfausnbzmcujasjdnkdijtllhuoqzpe",
            max_context_tokens=1000,  # 设置最大上下文token数
            truncation_strategy="start"  # 截断策略：仅保留开头部分
        )

        # 分析文本文件
        print("开始分析文本文件...")
        response = model.analyze_text_file(
            query="这段内容有多少个字",
            file_input=sample_file
        )
        print(f"\n分析完成！")
        print(f"模型响应: {response.content}")

    except Exception as e:
        print(f"分析过程中出现错误: {e}")

