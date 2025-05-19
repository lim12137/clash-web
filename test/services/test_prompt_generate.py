import unittest
import sys
import os

from services.prompt_service import generate_system_prompt_impl, fine_tune_prompt
from consts.model import GeneratePromptRequest, SubAgent, FineTunePromptRequest


class TestPromptGenerate(unittest.TestCase):
    
    def test_generate_manager_prompt(self):
        """ test generate duty prompt, verify the length of the returned result is greater than 0 """

        req = GeneratePromptRequest(
            task_description="我现在在做一个用于检索的agent，我希望优先去本地进行检索，如果本地检索不到则进行网络检索，检索完成之后，我希望你能够调用总结工具进行总结。",
            tool_list=["exa_web_search", "knowledge_base_search", "summary_content"],
            sub_agent_list=[SubAgent(name="mail_manager",
                                     description="管理邮件相关功能的助手，具有邮件阅读、发送的能力")])

        system_prompt = generate_system_prompt_impl(req)

        self.assertGreater(len(system_prompt), 0, "length of the returned result should be greater than 0")
        print(f"generated prompt: {system_prompt}")

    def test_generate_managed_prompt(self):
        """ test generate duty prompt, verify the length of the returned result is greater than 0 """

        req = GeneratePromptRequest(
            task_description="我现在在做一个用于检索的agent，我希望优先去本地进行检索，如果本地检索不到则进行网络检索，检索完成之后，我希望你能够调用总结工具进行总结。",
            tool_list=["exa_web_search", "knowledge_base_search", "summary_content"],
            sub_agent_list=[])

        system_prompt = generate_system_prompt_impl(req)
        
        self.assertGreater(len(system_prompt), 0, "length of the returned result should be greater than 0")
        print(f"generated prompt: \n{system_prompt}")

    def test_fine_tune_prompt(self):
        """ test fine tune prompt, verify the length of the returned result is greater than 0 """

        req = FineTunePromptRequest(
            system_prompt= ("你是一个智能搜索助手，专门负责回答用户的各种问题。你能够使用多种搜索工具，高效地获取信息，并提供全面、准确的回答。"
                    "你具备强大的信息获取和整合能力，能够根据问题类型选择最合适的工具，并生成连贯的答案，最后的答案语义连贯，信息清晰，可读性高。"),
            command="使用Markdown格式优化提示词",
        )

        system_prompt = fine_tune_prompt(req)

        self.assertGreater(len(system_prompt), 0, "length of the returned result should be greater than 0")
        print(f"fine tune prompt: \n{system_prompt}")


if __name__ == "__main__":
    unittest.main()
