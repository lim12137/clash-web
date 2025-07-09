from dataclasses import dataclass
from typing import Optional, Dict, Any


@dataclass
class SearchResultTextMessage:
    """
    Unified search result message class, containing all fields for search and FinalAnswerFormat tools.
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
        """Convert SearchResult object to dictionary format to save all data."""
        return {"title": self.title, "url": self.url, "text": self.text, "published_date": self.published_date,
            "source_type": self.source_type, "filename": self.filename, "score": self.score,
            "score_details": self.score_details, "cite_index": self.cite_index, "search_type": self.search_type,
            "tool_sign": self.tool_sign}

    def to_model_dict(self) -> Dict[str, Any]:
        """Format for input to the large model summary."""
        return {"title": self.title, "text": self.text, "index": f"{self.tool_sign}{self.cite_index}"}
