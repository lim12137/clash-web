import json
from typing import List

import requests
from smolagents.tools import Tool

from ..utils import MessageObserver, ProcessType
from ..utils.tools_common_message import SearchResultTextMessage


class KnowledgeBaseSearchTool(Tool):
    """支持中英文的知识库检索工具。
    """
    name = "knowledge_base_search"
    description = "Performs a local knowledge base search based on your query then returns the top search results. " \
                  "A tool for retrieving internal company documents, policies, processes and proprietary information. Use this tool when users ask questions related to internal company matters, product details, organizational structure, internal processes, or confidential information. " \
                  "Prioritize for company-specific queries. " \
                  "Use for proprietary knowledge or restricted information" \
                  "Avoid for publicly available general knowledge"

    inputs = {"query": {"type": "string", "description": "The search query to perform."}}
    output_type = "string"

    messages = {'en': {'search_failed': 'Search request failed: {}',
        'no_results': 'No results found! Try a less restrictive/shorter query.',
        'search_success': 'Knowledge Base Search Results'},
        'zh': {'search_failed': '搜索请求失败：{}', 'no_results': '未找到结果！请尝试使用更宽泛或更短的搜索词。',
            'search_success': '知识库搜索结果'}}

    tool_sign = "a"  # 用于给总结区分不同的索引来源

    def __init__(self, index_names: List[str],
                 base_url: str,
                 top_k: int = 5,
                 observer: MessageObserver = None):
        """Initialize the KBSearchTool.
        
        Args:
            index_names (list[str]): Name list of the search index
            base_url (str, optional): Base URL of the search service. Defaults to "http://localhost:8000".
            top_k (int, optional): Number of results to return. Defaults to 5.
            observer (MessageObserver, optional): Message observer instance. Defaults to None.
            lang (str, optional): Language code ('zh' or 'en'). Defaults to 'en'.
        
        Raises:
            ValueError: If language is not supported
        """
        super().__init__()
        self.index_names = index_names
        self.top_k = top_k
        self.observer = observer
        self.base_url = base_url
        self.lang = 'zh'
        self.record_ops = 0  # 用于记录序号

    def forward(self, query: str) -> str:
        kb_search_response = requests.post(f"{self.base_url}/indices/search/hybrid",
            json={"index_names": self.index_names, "query": query, "top_k": self.top_k})

        if kb_search_response.status_code != 200:
            raise Exception(self.messages[self.lang]['search_failed'].format(kb_search_response.text))

        kb_search_data = kb_search_response.json()
        kb_search_results = kb_search_data["results"]

        if not kb_search_results:
            raise Exception(self.messages[self.lang]['no_results'])

        search_results_json = []  # 将检索结果整理成统一格式
        search_results_return = []  # 输入给大模型的格式
        for index, single_search_result in enumerate(kb_search_results):
            search_result_message = SearchResultTextMessage(title=single_search_result.get("title", ""),
                text=single_search_result.get("content", ""), source_type=single_search_result.get("source_type", ""),
                url=single_search_result.get("path_or_url", ""), filename=single_search_result.get("filename", ""),
                published_date=single_search_result.get("create_time", ""), score=single_search_result.get("score", 0),
                score_details=single_search_result.get("score_details", {}), cite_index=self.record_ops + index,
                search_type=self.name, tool_sign=self.tool_sign)

            search_results_json.append(search_result_message.to_dict())
            search_results_return.append(search_result_message.to_model_dict())

        self.record_ops += len(search_results_return)

        # 记录本次检索的详细内容
        if self.observer:
            search_results_data = json.dumps(search_results_json, ensure_ascii=False)
            self.observer.add_message("", ProcessType.SEARCH_CONTENT, search_results_data)
        return json.dumps(search_results_return, ensure_ascii=False)


if __name__ == "__main__":
    try:
        tool = KnowledgeBaseSearchTool(index_names=["medical"], base_url="http://localhost:8000", top_k=3)

        question = "乳腺癌的风险"
        result1 = tool.forward(question)
        print(result1)
    except Exception as e:
        print(e)
