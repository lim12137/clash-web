import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Union

import requests


class BaseEmbedding(ABC):
    """
    嵌入模型的抽象基类，定义了所有嵌入模型应该实现的方法。
    """

    @abstractmethod
    def __init__(self, model_name: str = None, base_url: str = None, api_key: str = None):
        """
        初始化嵌入模型。

        Args:
            model_name: Embedding模型的名称
            base_url: Embedding API的基础URL
            api_key: Embedding API的密钥
        """
        pass

    @abstractmethod
    def get_embeddings(self, inputs: list, with_metadata: bool = False) -> Union[List[List[float]], Dict[str, Any]]:
        """
        获取输入列表的嵌入向量。
        
        Args:
            inputs: 希望执行嵌入的对象
            with_metadata: 是否返回包含元数据的完整响应
            
        Returns:
            如果with_metadata为False，返回嵌入向量列表；否则，返回包含嵌入和元数据的字典
        """
        pass

    @abstractmethod
    def check_connectivity(self, timeout: float = 5.0) -> bool:
        """
        测试与嵌入API的连接是否正常，支持超时检测。
        
        Args:
            timeout: 超时时间，单位为秒
            
        Returns:
            bool: 连接成功返回True，失败或超时返回False
        """
        pass


class JinaEmbedding(BaseEmbedding):
    def __init__(self, api_key: str):
        """Initialize JinaEmbedding with configuration from environment variables."""
        self.api_key = api_key
        self.api_url = "https://api.jina.ai/v1/embeddings"
        self.model = "jina-clip-v2"
        self.embedding_dim = 1024

        self.headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}

    def _prepare_input(self, inputs: List[Dict[str, str]]) -> Dict[str, Any]:
        """Prepare the input data for the API request."""
        return {"model": self.model, "input": inputs}

    def _make_request(self, data: Dict[str, Any], timeout: float = None) -> Dict[str, Any]:
        """
        Make the API request and return the response.
        
        Args:
            data: 请求数据
            timeout: 超时时间，单位为秒
            
        Returns:
            Dict[str, Any]: API响应
        """
        response = requests.post(self.api_url, headers=self.headers, json=data, timeout=timeout)
        response.raise_for_status()
        return response.json()

    def get_embeddings(self, inputs: List[Dict[str, str]], with_metadata: bool = False, timeout: float = None) -> Union[
        List[List[float]], Dict[str, Any]]:
        """
        Get embeddings for a list of inputs (text or image URLs).
        
        Args:
            inputs: List of dictionaries containing either 'text' or 'image' keys
            with_metadata: Whether to return the full response with metadata or just a list of embedding vectors
            timeout: 请求超时时间，单位为秒
            
        Returns:
            List of embedding vectors
            
        Example:
            >>> jina = JinaEmbedding()
            >>> inputs = [
            ...     {"text": "A beautiful sunset over the beach"},
            ...     {"image": "https://example.com/image.jpg"}
            ... ]
            >>> embeddings = jina.get_embeddings(inputs)
        """
        data = self._prepare_input(inputs)
        response = self._make_request(data, timeout=timeout)

        if with_metadata:
            return response

        # Extract embeddings from response
        embeddings = [item["embedding"] for item in response["data"]]
        return embeddings

    def check_connectivity(self, timeout: float = 5.0) -> bool:
        """
        测试与远程Jina Embedding API的连接是否正常，支持超时检测
        
        Args:
            timeout: 超时时间，单位为秒，默认为5秒
            
        Returns:
            bool: 连接成功返回True，失败或超时返回False
        """
        try:
            # 创建一个简单的测试输入
            test_input = [{"text": "hw"}]

            # 尝试获取嵌入向量，设置超时时间
            embeddings = self.get_embeddings(test_input, timeout=timeout)

            # 如果成功获取嵌入向量，则连接正常
            return len(embeddings) > 0

        except requests.exceptions.Timeout:
            logging.error(f"Embedding API 连接测试超时（{timeout}秒）")
            return False
        except requests.exceptions.ConnectionError:
            logging.error("Embedding API 连接错误，无法建立连接")
            return False
        except Exception as e:
            logging.error(f"Embedding API 连接测试失败: {str(e)}")
            return False


class OpenAIBaseEmbedding(BaseEmbedding):
    def __init__(self, model_name: str, base_url: str, api_key: str):
        """Initialize OpenAIBaseEmbedding with configuration from environment variables or provided parameters."""
        self.api_key = api_key
        self.api_url = base_url
        self.model_name = model_name

        self.headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}

    def _prepare_input(self, inputs: List[str]) -> Dict[str, Any]:
        """Prepare the input data for the API request."""
        return {"model": self.model_name, "input": inputs}

    def _make_request(self, data: Dict[str, Any], timeout: float = None) -> Dict[str, Any]:
        """
        Make the API request and return the response.
        
        Args:
            data: 请求数据
            timeout: 超时时间，单位为秒
            
        Returns:
            Dict[str, Any]: API响应
        """
        response = requests.post(self.api_url, headers=self.headers, json=data, timeout=timeout)
        response.raise_for_status()
        return response.json()

    def get_embeddings(self, inputs: List[str], with_metadata: bool = False, timeout: float = None) -> Union[
        List[List[float]], Dict[str, Any]]:
        """
        Get embeddings for a list of inputs (text).
        
        Args:
            inputs: List of text strings
            with_metadata: Whether to return the full response with metadata or just a list of embedding vectors
            timeout: 请求超时时间，单位为秒
            
        Returns:
            List of embedding vectors
        """
        data = self._prepare_input(inputs)
        response = self._make_request(data, timeout=timeout)

        if with_metadata:
            return response

        # Extract embeddings from response
        embeddings = [item["embedding"] for item in response["data"]]
        return embeddings

    def check_connectivity(self, timeout: float = 5.0) -> bool:
        """
        测试与远程OpenAI API的连接是否正常，支持超时检测
        
        Args:
            timeout: 超时时间，单位为秒，默认为5秒
            
        Returns:
            bool: 连接成功返回True，失败或超时返回False
        """
        try:
            test_input = ["hw"]

            # 尝试获取嵌入向量，设置超时时间
            embeddings = self.get_embeddings(test_input, timeout=timeout)

            # 如果成功获取嵌入向量，则连接正常
            return len(embeddings) > 0

        except requests.exceptions.Timeout:
            logging.error(f"OpenAI API 连接测试超时（{timeout}秒）")
            return False
        except requests.exceptions.ConnectionError:
            logging.error("OpenAI API 连接错误，无法建立连接")
            return False
        except Exception as e:
            logging.error(f"OpenAI API 连接测试失败: {str(e)}")
            return False
