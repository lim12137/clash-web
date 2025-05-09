import asyncio
import json
import threading

from exa_py import Exa
from smolagents.tools import Tool
from pydantic import Field

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
    tool_sign = "b"  # 用于给总结区分不同的索引来源

    def __init__(self, exa_api_key:str=Field(description="key"),
                 observer: MessageObserver=Field(description="键", default=None, exclude=True),
                 max_results:int=Field(description="最大检索个数", default=5),
                 image_filter:bool=Field(description="是否开启图片过滤", default=False),
                 image_filter_model_path:str=Field(description="模型路径", default=""),
                 image_filter_threshold:float=Field(description="图片过滤阈值", default=0.4)):

        super().__init__()

        self.observer = observer
        self.exa = Exa(api_key=exa_api_key)
        self.max_results = max_results
        self.image_filter = image_filter
        self.image_filter_threshold = image_filter_threshold
        self.record_ops = 0  # Used to record sequence number
        self.running_prompt = "网络检索中..."

    def forward(self, query: str) -> str:
        # 发送工具运行消息
        if self.observer:
            self.observer.add_message("", ProcessType.TOOL, self.running_prompt)
            card_content = [{"icon": "search", "text": query}]
            self.observer.add_message("", ProcessType.CARD, json.dumps(card_content, ensure_ascii=False))

        exa_search_result = self.exa.search_and_contents(query, text={"max_characters": 2000}, livecrawl="always",
            extras={"links": 0, "image_links": 10}, num_results=self.max_results)

        if len(exa_search_result.results) == 0:
            raise Exception('No results found! Try a less restrictive/shorter query.')

        images_list_url = []
        search_results_json = []  # Format search results into a unified structure
        search_results_return = []  # Format for input to the large model
        for index, single_result in enumerate(exa_search_result.results):
            search_result_message = SearchResultTextMessage(title=single_result.title, url=single_result.url,
                text=single_result.text, published_date=single_result.published_date, source_type="url", filename="",
                score="", score_details={}, cite_index=self.record_ops + index, search_type=self.name,
                tool_sign=self.tool_sign)
            search_results_json.append(search_result_message.to_dict())
            search_results_return.append(search_result_message.to_model_dict())
            images_list_url.extend(single_result.extras["image_links"])

        self.record_ops += len(search_results_return)

        # Deduplicate and filter image list
        images_list_url = list(dict.fromkeys(images_list_url))
        if len(images_list_url) > 0:
            if self.image_filter:
                thread = threading.Thread(target=self._filter_images, args=(images_list_url, query))
                thread.daemon = True
                thread.start()
            else:
                if self.observer:
                    search_images_list_json = json.dumps({"images_url": images_list_url}, ensure_ascii=False)
                    self.observer.add_message("", ProcessType.PICTURE_WEB, search_images_list_json)

        # Record detailed content of this search
        if self.observer:
            search_results_data = json.dumps(search_results_json, ensure_ascii=False)
            self.observer.add_message("", ProcessType.SEARCH_CONTENT, search_results_data)
        return json.dumps(search_results_return, ensure_ascii=False)

    def _filter_images(self, images_list_url, query):
        """
        Execute image filtering operation in a separate thread
        :param images_list_url: List of image URLs to filter
        :param query: Search query, used to filter images related to the query
        """
        try:
            # Define asynchronous filtering process
            async def filter_process():
                try:
                    # Define label sets for image filtering
                    label_sets = [LabelSet(negative="logo or banner or background or advertisement or icon or avatar",
                        positive=query), ]

                    # Initialize image processor
                    try:
                        processor = AsyncImageProcessor(label_sets=label_sets, threshold=self.image_filter_threshold)
                    except Exception as e:
                        print(f"Init Image Processor Error: {str(e)}")

                    # Process images
                    try:
                        await processor.process_images(images_list_url)
                    except Exception as e:
                        print(f"Process_images error: {str(e)}")

                    # Get list of important image URLs
                    filtered_images = [img.url for img in processor.important_images]

                    # Notify results through observer after filtering
                    if self.observer and filtered_images:
                        filtered_images_json = json.dumps({"images_url": filtered_images}, ensure_ascii=False)
                        self.observer.add_message("", ProcessType.PICTURE_WEB, filtered_images_json)
                except Exception as e:
                    # Handle exceptions in async process
                    print(f"Image filter Async process error: {str(e)}")
                    if self.observer:
                        # Send unfiltered image_url
                        filtered_images_json = json.dumps({"images_url": images_list_url}, ensure_ascii=False)
                        self.observer.add_message("", ProcessType.PICTURE_WEB, filtered_images_json)

            # Run async function in current thread
            def run_async_filter():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(filter_process())
                finally:
                    loop.close()

            # Run async filter function directly, no longer creating new thread
            run_async_filter()

        except Exception as e:
            # Handle exceptions in filtering process, avoid affecting main thread, only print, don't send errors to frontend
            print(f"Picture Filter Thread creation error: {str(e)}")
