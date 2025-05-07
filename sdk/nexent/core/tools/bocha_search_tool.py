import json

import requests
from smolagents.tools import Tool


class BoChaSearchTool(Tool):
    name = "bocha_web_search"
    description = "Performs a bocha web search based on your query (think a Google search) then returns the top search results."
    inputs = {"query": {"type": "string", "description": "The search query to perform."}}
    output_type = "string"

    def __init__(self, api_key:str, max_results:int=5):
        super().__init__()

        self.api_key = api_key
        self.max_results = max_results

    def search_content(self, query):
        url = 'https://api.bochaai.com/v1/web-search'
        headers = {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}
        data = {"query": query, "summary": True, "count": self.max_results}

        # 发送POST请求
        response = requests.post(url, headers=headers, json=data)
        if response.status_code != 200:
            error_message = response.content.decode('utf-8')
            raise Exception(f"Request Error in bocha_web_search! Error Code {response.status_code}. " \
                            f"Error Message: {json.loads(error_message).get('message')}")
        response = response.json()
        messages = response["data"]["webPages"]["value"]
        return messages

    def forward(self, query: str) -> str:

        exa_search_result = self.search_content(query)

        if len(exa_search_result.results) == 0:
            raise Exception("No results found! Try a less restrictive/shorter query.")

        processed_results = [f"[{result.title}]\n{result.text}" for result in exa_search_result.results]

        return "## Search Results\n\n" + "\n\n".join(processed_results)
