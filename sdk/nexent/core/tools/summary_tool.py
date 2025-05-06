from typing import List

from smolagents.models import MessageRole
from smolagents.tools import Tool

from ..models import OpenAIModel

default_system_prompt = ("# 你是一个总结专家，你的任务是根据检索结果回答用户问题。\n"
                         "你需要按照以下要求进行总结：\n"
                         "1.使用Markdown格式格式化你的输出。\n"
                         "2.在回答的对应位置添加引用标记，格式为'[[index]]'，其中index为引用的序号。注意仅添加引用标记，不需要添加链接、参考文献等多余内容。\n"
                         "3.你的回答需要有标题和正文。\n"
                         "4.注意不要在这里引用变量，直接进行文字输出，这里不会用代码方式执行你输出的内容。")


class SummaryTool(Tool):
    name = "summary_search_content"
    description = "具有可靠的总结能力，可以生成令用户满意的回答。需要传入用户提问与检索工具的检索结果。返回内容可以直接作为final_answer的输入。"
    inputs = {"query": {"type": "string", "description": "输入用户提问"},
              "search_result": {"type": "array",
                                "description": "一个包含多个字符串的列表，每个字符串表示之前检索到的**原始信息**，直接给入检索之后的变量，不要擅自总结。"}}
    output_type = "string"

    def __init__(self, model: OpenAIModel, system_prompt: str = default_system_prompt):
        super().__init__()
        self.model = model
        self.system_prompt = system_prompt

    def forward(self, query: str, search_result: List[str]) -> str:
        search_result_concat = ""
        for search_str in search_result:
            search_result_concat += search_str + "\n"

        messages = [{"role": MessageRole.SYSTEM, "content": self.system_prompt},
            {"role": MessageRole.USER, "content": f"### 检索信息：{search_result_concat}\n### 用户提问：{query}\n"}]
        model_output_message = self.model(messages=messages)

        return model_output_message.content
