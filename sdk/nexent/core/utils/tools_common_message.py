from dataclasses import dataclass
from typing import Optional, Dict, Any


@dataclass
class SearchResultTextMessage:
    """
    统一的搜索结果消息类，包含EXA搜索和FinalAnswerFormat工具的所有字段
    """

    def __init__(self, title: str, url: str, text: str, published_date: Optional[str] = None,
                 source_type: Optional[str] = None, filename: Optional[str] = None, score: Optional[str] = None,
                 score_details: Optional[Dict[str, Any]] = None, cite_index: Optional[int] = None,
                 search_type: Optional[str] = None, tool_sign: Optional[str] = None):
        self.title = title
        self.url = url
        self.text = text
        self.published_date = published_date
        self.source_type = source_type
        self.filename = filename
        self.score = score
        self.score_details = score_details
        self.cite_index = cite_index
        self.search_type = search_type
        self.tool_sign = tool_sign

    def to_dict(self) -> Dict[str, Any]:
        """将SearchResult对象转换为字典格式，用于保存所有数据"""
        return {"title": self.title, "url": self.url, "text": self.text, "published_date": self.published_date,
            "source_type": self.source_type, "filename": self.filename, "score": self.score,
            "score_details": self.score_details, "cite_index": self.cite_index, "search_type": self.search_type,
            "tool_sign": self.tool_sign}

    def to_model_dict(self) -> Dict[str, Any]:
        """输入给大模型总结的格式"""
        return {"title": self.title, "text": self.text, "index": f"{self.tool_sign}{self.cite_index}"}
