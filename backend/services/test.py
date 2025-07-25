from smolagents.agents import CodeAgent
from smolagents.models import OpenAIServerModel
from langchain_core.tools import tool
from smolagents.tools import Tool


@tool
def multiply(a: int, b: int) -> int:
    """计算两个整数的乘积。"""
    return a * b


test_tool = Tool.from_langchain(multiply)
model = OpenAIServerModel(model_id="Qwen/Qwen2.5-32B-Instruct",
                          api_key="sk-rtlhqzuzvbkkzvssnckndluufknscdvbkybvmmxuugwuzrsq",
                          api_base="https://api.siliconflow.cn/v1")

agent = CodeAgent(tools=[test_tool], model=model)
agent.run(task="111*111等于多少")

