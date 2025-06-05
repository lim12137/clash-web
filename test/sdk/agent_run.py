import asyncio

from sdk.nexent.core.agents.agent_model import (
    AgentRunInfo, 
    AgentConfig, 
    ModelConfig, 
    ToolConfig, 
    AgentHistory
)
from sdk.nexent.core.utils.observer import MessageObserver
import threading
import yaml
from sdk.nexent.core.agents.run_agent import agent_run


def create_mock_agent_run_info() -> AgentRunInfo:
    """创建一个AgentRunInfo的mock数据"""
    
    # 创建模型配置mock数据
    model_config_1 = ModelConfig(
        cite_name="main_model",
        api_key="sk-",
        model_name="Qwen/Qwen2.5-32B-Instruct",
        url="https://api.siliconflow.cn/v1",
        temperature=0.1,
        top_p=0.95
    )
    
    model_config_2 = ModelConfig(
        cite_name="sub_model",
        api_key="sk-",
        model_name="Qwen/Qwen2.5-32B-Instruct",
        url="https://api.siliconflow.cn/v1",
        temperature=0.1,
        top_p=0.95
    )
    
    # 创建工具配置mock数据
    tool_config_1 = ToolConfig(
        class_name="EXASearchTool",
        params={"exa_api_key": "",
                "max_results": 5,
                "image_filter": False},
        source="local"
    )

    tool_config_2 = ToolConfig(
        class_name="KnowledgeBaseSearchTool",
        params={"top_k": 5},
        source="local",
        metadata={"index_names": ['圣泉集团知识库']}
    )
    
    tool_config_3 = ToolConfig(
        class_name="email_send",
        params={},
        source="mcp"
    )
    
    # 创建子Agent配置
    with open("test/sdk/test_sub_prompt.yaml", "r", encoding="utf-8") as f:
        prompt_templates1 = yaml.safe_load(f)
    sub_agent_config = AgentConfig(
        name="search_agent",
        description="通过使用搜索获取信息",
        prompt_templates=prompt_templates1,
        tools=[tool_config_1, tool_config_2],
        max_steps=3,
        model_name="sub_model",
        provide_run_summary=False,
        managed_agents=[]
    )
    
    # 创建主Agent配置
    with open("test/sdk/test_prompt.yaml", "r", encoding="utf-8") as f:
        prompt_templates2 = yaml.safe_load(f)
    agent_config = AgentConfig(
        name="main_agent",
        description="能够处理多种任务的通用AI助手",
        prompt_templates=prompt_templates2,
        tools=[tool_config_3],
        max_steps=5,
        model_name="main_model",
        provide_run_summary=False,
        managed_agents=[sub_agent_config]
    )
    
    # 创建MessageObserver
    observer = MessageObserver(lang="zh")
    
    # 创建历史对话记录
    history = [
        AgentHistory(
            role="user",
            content="你好"
        ),
        AgentHistory(
            role="assistant",
            content="你好！有什么我可以帮助你的吗？"
        )
    ]
    
    # 创建AgentRunInfo实例
    agent_run_info = AgentRunInfo(
        query="介绍东方明珠，并将对应内容发送至863238635@qq.com",
        model_config_list=[model_config_1, model_config_2],
        observer=observer,
        agent_config=agent_config,
        mcp_host="http://localhost:5011/sse",
        history=history,
        stop_event=threading.Event()
    )
    
    return agent_run_info


async def main():
    mock_data = create_mock_agent_run_info()

    count = 0
    async for msg in agent_run(mock_data):
        count+=1

        if count==40:
            mock_data.stop_event.set()


if __name__ == "__main__":
    asyncio.run(main())
