import asyncio
import json
import threading
import time
from typing import Optional

from exa_py import Exa
from smolagents.tools import Tool

from ..utils import MessageObserver, ProcessType
from ..utils.image_filter import AsyncImageProcessor, LabelSet
from ..utils.tools_common_message import SearchResultTextMessage


class EXASearchTool(Tool):
    name = "exa_web_search"
    description = "Performs a EXA web search based on your query (think a Google search) then returns the top search results. " \
                  "A tool for retrieving publicly available information, news, general knowledge, or non-proprietary data from the internet. Use this for real-time updates, broad topics, or when the query falls outside the company's internal knowledge base." \
                  "Use for open-domain, real-time, or general knowledge queries"

    inputs = {"query": {"type": "string", "description": "The search query to perform."}}
    output_type = "string"

    messages = {'en': {
        'summary_prompt': 'Please summarize the main content of the following webpage, extract key information, and answer the user\'s question. Ensure the summary is concise and covers the core points, data, and conclusions. If the webpage content involves multiple topics, please summarize each topic separately. The user\'s question is: [{query}]. Please provide an accurate answer based on the webpage content, and note the information source (if applicable).',
        'search_failed': 'Search request failed: {}',
        'no_results': 'No results found! Try a less restrictive/shorter query.',
        'search_success': 'EXA Search Results'}, 'zh': {
        'summary_prompt': '请总结以下网页的主要内容，提取关键信息，并回答用户的问题。确保总结简洁明了，涵盖核心观点、数据和结论。如果网页内容涉及多个主题，请分别概述每个主题的重点。用户的问题是：[{query}]。请根据网页内容提供准确的回答，并注明信息来源（如适用）。',
        'search_failed': '搜索请求失败：{}', 'no_results': '未找到结果！请尝试使用更简短或更宽泛的搜索词。',
        'search_success': 'EXA搜索结果'}}

    tool_sign = "b"  # 用于给总结区分不同的索引来源

    def __init__(self, exa_api_key:str,
                 observer: MessageObserver = None,
                 max_results:int=5,
                 is_model_summary:bool=False,
                 image_filter:bool=False,
                 image_filter_model_path:str="",
                 image_filter_threshold:float=0.4):
        super().__init__()

        self.observer = observer
        self.exa = Exa(api_key=exa_api_key)
        self.max_results = max_results
        self.is_model_summary = is_model_summary
        self.lang = 'zh'
        self.image_filter = image_filter
        self.image_filter_model_Path = image_filter_model_path
        self.image_filter_threshold = image_filter_threshold

        self.record_ops = 0  # 用于记录序号

    def forward(self, query: str) -> str:
        if self.is_model_summary:
            # 使用LLM总结功能会导致搜索速度变慢
            summary_prompt = self.messages[self.lang]['summary_prompt'].format(query=query)
            exa_search_result = self.exa.search_and_contents(query, text=True, extras={"links": 0, "image_links": 10},
                livecrawl="always", num_results=self.max_results, summary={"query": summary_prompt})
        else:
            exa_search_result = self.exa.search_and_contents(query, text={"max_characters": 2000}, livecrawl="always",
                extras={"links": 0, "image_links": 10}, num_results=self.max_results)

        if len(exa_search_result.results) == 0:
            raise Exception(self.messages[self.lang]['no_results'])

        images_list_url = []
        search_results_json = []  # 将检索结果整理成统一格式
        search_results_return = []  # 输入给大模型的格式
        for index, single_result in enumerate(exa_search_result.results):
            search_result_message = SearchResultTextMessage(title=single_result.title, url=single_result.url,
                text=single_result.text, published_date=single_result.published_date, source_type="url", filename="",
                score="", score_details={}, cite_index=self.record_ops + index, search_type=self.name,
                tool_sign=self.tool_sign)
            search_results_json.append(search_result_message.to_dict())
            search_results_return.append(search_result_message.to_model_dict())
            images_list_url.extend(single_result.extras["image_links"])

        self.record_ops += len(search_results_return)

        # 对图片列表进行去重与图片内容过滤
        images_list_url = list(dict.fromkeys(images_list_url))
        if len(images_list_url) > 0:
            if self.image_filter:
                thread = threading.Thread(target=self._filter_images,
                                          args=(images_list_url, query, self.image_filter_model_Path))
                thread.daemon = True
                thread.start()
            else:
                if self.observer:
                    search_images_list_json = json.dumps({"images_url": images_list_url}, ensure_ascii=False)
                    self.observer.add_message("", ProcessType.PICTURE_WEB, search_images_list_json)

        # 记录本次检索的详细内容
        if self.observer:
            search_results_data = json.dumps(search_results_json, ensure_ascii=False)
            self.observer.add_message("", ProcessType.SEARCH_CONTENT, search_results_data)
        return json.dumps(search_results_return, ensure_ascii=False)

    def _filter_images(self, images_list_url, query, modle_path_clip):
        """
        在单独线程中执行图片过滤操作
        :param images_list_url: 需要过滤的图片URL列表
        :param query: 搜索查询，用于过滤与查询相关的图片
        :param modle_path_clip: CLIP模型路径
        """
        try:
            # 定义异步过滤过程
            async def filter_process():
                try:
                    # 定义标签集，用于图片过滤
                    label_sets = [LabelSet(negative="logo or banner or background or advertisement or icon or avatar",
                        positive=query), ]

                    # 初始化图片处理器
                    try:
                        processor = AsyncImageProcessor(label_sets=label_sets, model_path=modle_path_clip,
                                                        threshold=self.image_filter_threshold)
                    except Exception as e:
                        print(f"Init Image Processor Error: {str(e)}")

                    # 处理图片
                    try:
                        await processor.process_images(images_list_url)
                    except Exception as e:
                        print(f"Process_images error: {str(e)}")

                    # 获取重要图片的URL列表
                    filtered_images = [img.url for img in processor.important_images]

                    # 过滤完成后，通过observer通知结果
                    if self.observer and filtered_images:
                        filtered_images_json = json.dumps({"images_url": filtered_images}, ensure_ascii=False)
                        self.observer.add_message("", ProcessType.PICTURE_WEB, filtered_images_json)
                except Exception as e:
                    # 处理异步过程中的异常
                    print(f"Image filter Async process error: {str(e)}")
                    if self.observer:
                        # 发送未过滤的image_url
                        filtered_images_json = json.dumps({"images_url": images_list_url}, ensure_ascii=False)
                        self.observer.add_message("", ProcessType.PICTURE_WEB, filtered_images_json)

            # 在当前线程中运行异步函数
            def run_async_filter():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(filter_process())
                finally:
                    loop.close()

            # 直接运行异步过滤函数，不再创建新线程
            run_async_filter()

        except Exception as e:
            # 处理过滤过程中的异常，避免影响主线程，只打印，不向前端发送错误
            print(f"Picture Filter Thread creation error: {str(e)}")


if __name__ == "__main__":
    try:
        o1 = MessageObserver()
        tool = EXASearchTool(exa_api_key="", observer=o1, max_results=5, is_model_summary=False, lang='zh',
                             image_filter=True, image_filter_model_path=r"D:/clip-vit-base-patch32")

        query = "问界M9"
        result1 = tool.forward(query)

        # 主线程停止200s
        time.sleep(200)

        message = o1.get_cached_message()

        # 将每个字符串解析为JSON对象
        parsed_messages = [json.loads(msg) for msg in message]

        # 将解析后的JSON对象列表写入文件
        output_file = "./search_results.json"
        with open(output_file, 'w', encoding='utf-8') as f1:
            json.dump(parsed_messages, f1, ensure_ascii=False, indent=4)
        print(f"搜索结果已保存到文件：{output_file}")

        # 打印消息内容
        for msg in message:
            print(msg)

    except Exception as e:
        print(e)
