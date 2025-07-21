from smolagents.models import ChatMessage
import tiktoken

from ..models import OpenAIModel
from ..utils.observer import MessageObserver


class OpenAILongContextModel(OpenAIModel):
    """
    Long context model class, used to process large text files
    Support automatic truncation of content exceeding context limits
    """
    
    def __init__(self, observer: MessageObserver, temperature=0.5, top_p=0.95,
                 max_context_tokens=128000, truncation_strategy="start", *args, **kwargs):
        """
        Initialize the long context model
        
        Args:
            observer: Message observer
            temperature: Temperature parameter
            top_p: top_p parameter
            max_context_tokens: Maximum context token number, default is 128k
            truncation_strategy: Truncation strategy
                - "start": Only keep the beginning part
                - "middle": Keep the beginning and end parts
                - "end": Only keep the end part
            *args, **kwargs: Other parameters
        """
        super().__init__(observer=observer, temperature=temperature, top_p=top_p, *args, **kwargs)
        self.max_context_tokens = max_context_tokens
        if truncation_strategy not in ["start", "middle", "end"]:
            raise ValueError("truncation_strategy must be 'start', 'middle' or 'end'")
        self.truncation_strategy = truncation_strategy
        self._tokenizer = None
    
    def _get_tokenizer(self):
        """Get tokenizer, used to calculate token number"""
        if self._tokenizer is None:
            try:
                self._tokenizer = tiktoken.get_encoding("cl100k_base")
            except ImportError:
                # If there is no tiktoken, use simple character count estimation
                self._tokenizer = None
        return self._tokenizer
    
    def count_tokens(self, text: str) -> int:
        """
        Calculate the token number of the text
        
        Args:
            text: The text to calculate
            
        Returns:
            int: token number
        """
        tokenizer = self._get_tokenizer()
        if tokenizer:
            return len(tokenizer.encode(text))
        else:
            # Simple character count estimation (approximately 4 characters = 1 token)
            return len(text) // 4
    
    def truncate_text(self, text: str, max_tokens: int) -> str:
        """
        Truncate the text to the specified token number
        
        Args:
            text: The text to truncate
            max_tokens: Maximum token number
            
        Returns:
            str: Truncated text
        """
        if self.count_tokens(text) <= max_tokens:
            return text

        tokenizer = self._get_tokenizer()
        if tokenizer:
            # Use tiktoken for precise truncation
            tokens = tokenizer.encode(text)
            if len(tokens) <= max_tokens:
                return text
            
            if self.truncation_strategy == "start":
                # Only keep the beginning part
                truncated_tokens = tokens[:max_tokens]
                return tokenizer.decode(truncated_tokens)
            elif self.truncation_strategy == "middle":
                # Keep the beginning and end,
                half_tokens = max_tokens // 2
                start_tokens = tokens[:half_tokens]
                end_tokens = tokens[-(max_tokens - half_tokens):]
                truncated_tokens = start_tokens + end_tokens
                return tokenizer.decode(truncated_tokens)
            else:
                # Only keep the end part
                truncated_tokens = tokens[-max_tokens:]
                return tokenizer.decode(truncated_tokens)
        else:
            # Use character count for estimation truncation
            estimated_chars = max_tokens * 4
            if len(text) <= estimated_chars:
                return text
            
            if self.truncation_strategy == "start":
                # Only keep the beginning part
                return text[:estimated_chars]
            elif self.truncation_strategy == "middle":
                # Keep the beginning and end
                half_chars = estimated_chars // 2
                start_text = text[:half_chars]
                end_text = text[-(estimated_chars - half_chars):]
                return start_text + "\n\n[Content truncated...]\n\n" + end_text
            else:  # end
                # Only keep the end part
                return text[-estimated_chars:]
    
    def prepare_long_text_message(self, text_content: str, system_prompt: str, user_prompt: str):
        """
        Prepare the message format containing long text, automatically handle truncation
        
        Args:
            text_content: Text content
            system_prompt: System prompt
            user_prompt: User prompt
            
        Returns:
            List[Dict[str, Any]]: Prepared message list
        """
        # Calculate the token number of the system prompt and user prompt
        system_tokens = self.count_tokens(system_prompt)
        user_prompt_tokens = self.count_tokens(user_prompt)
        
        # Reserve tokens for text content
        available_tokens = self.max_context_tokens - system_tokens - user_prompt_tokens - 100  # Reserve 100 tokens as buffer
        
        # Truncate the text content
        truncated_text = self.truncate_text(text_content, available_tokens)
        
        # Build messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"{user_prompt}\n\n{truncated_text}"}
        ]
        
        return messages

    def analyze_long_text(self, text_content: str, system_prompt: str, user_prompt: str) -> ChatMessage:
        """
        Analyze the long text content

        Args:
            text_content: Text content
            system_prompt: System prompt
            user_prompt: User prompt

        Returns:
            ChatMessage: Model returned message
        """
        messages = self.prepare_long_text_message(text_content, system_prompt, user_prompt)
        return self(messages=messages)
