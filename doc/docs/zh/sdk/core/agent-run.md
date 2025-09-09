# 使用 agent_run 运行智能体（流式）

`agent_run` 提供了一种更简洁且线程友好的方式来运行智能体，并通过 `MessageObserver` 提供实时流式输出。该接口适合需要前端流式展示、服务端推送以及需要结合 MCP 工具集的场景。

## 快速开始

```python
import json
import asyncio
import logging
from threading import Event

from nexent.core.agents.run_agent import agent_run
from nexent.core.agents.agent_model import (
    AgentRunInfo,
    AgentConfig,
    ModelConfig
)
from nexent.core.utils.observer import MessageObserver


async def main():
    # 1) 创建消息观察者（负责接收流式消息）
    observer = MessageObserver(lang="zh")

    # 2) 外部停止开关（可用于在 UI 上中断执行）
    stop_event = Event()

    # 3) 配置模型
    model_config = ModelConfig(
        cite_name="gpt-4",                # 模型别名（自定义，在 AgentConfig 中引用）
        api_key="<YOUR_API_KEY>",
        model_name="Qwen/Qwen2.5-32B-Instruct",
        url="https://api.siliconflow.cn/v1",
        temperature=0.3,
        top_p=0.9
    )

    # 4) 配置 Agent
    agent_config = AgentConfig(
        name="example_agent",
        description="An example agent that can execute Python code and search the web",
        prompt_templates=None,
        tools=[],
        max_steps=5,
        model_name="gpt-4",               # 与上面 model_config.cite_name 对应
        provide_run_summary=False,
        managed_agents=[]
    )

    # 5) 组装运行信息
    agent_run_info = AgentRunInfo(
        query="strrawberry中出现了多少个字母r",  # 示例问题
        model_config_list=[model_config],
        observer=observer,
        agent_config=agent_config,
        mcp_host=None,                      # 可选：MCP 服务地址列表
        history=None,                       # 可选：历史对话
        stop_event=stop_event
    )

    # 6) 流式运行，并消费消息
    async for message in agent_run(agent_run_info):
        message_data = json.loads(message)
        message_type = message_data.get("type", "unknown")
        content = message_data.get("content", "")
        print(f"[{message_type}] {content}")

    # 7) 读取最终答案（如有）
    final_answer = observer.get_final_answer()
    if final_answer:
        print(f"\nFinal Answer: {final_answer}")


if __name__ == "__main__":
    logging.disable(logging.CRITICAL)
    asyncio.run(main())
```

提示：请将 `api_key` 等敏感配置放入环境变量或安全管理服务中，避免硬编码到代码库。

## 消息流格式与处理

`agent_run` 内部通过一个后台线程执行智能体，并将 `MessageObserver` 中缓存的消息以 JSON 字符串形式不断产出。你可以解析其中的字段进行分类展示或记录日志。

- 重要字段
  - `type`: 消息类型（对应 `ProcessType`）
  - `content`: 文本内容
  - `agent_name`: 可选，当前产出该消息的智能体名称

常见 `type`（来自 `ProcessType`）：
- `AGENT_NEW_RUN`: 新的任务开始
- `STEP_COUNT`: 步数更新
- `MODEL_OUTPUT_THINKING` / `MODEL_OUTPUT_CODE`: 模型思考/代码片段
- `PARSE`: 代码解析结果
- `EXECUTION_LOGS`: Python 执行日志
- `FINAL_ANSWER`: 最终答案
- `ERROR`: 错误信息

## 配置项说明

### ModelConfig

- `cite_name`：模型别名（用于在 `AgentConfig.model_name` 中引用）
- `api_key`：模型服务 API Key
- `model_name`：模型调用名
- `url`：模型服务的 Base URL
- `temperature` / `top_p`：采样参数

### AgentConfig

- `name`：智能体名称
- `description`：智能体描述
- `prompt_templates`：可选，Jinja 模板字典
- `tools`：工具配置列表（见下方 ToolConfig）
- `max_steps`：最大步数
- `model_name`：模型别名（对应 `ModelConfig.cite_name`）
- `provide_run_summary`：是否在子智能体返回总结
- `managed_agents`：子智能体配置列表

### 传入历史对话（可选）

你可以通过 `AgentRunInfo.history` 传入历史消息，Nexent 会将其写入内部记忆：

```python
from nexent.core.agents.agent_model import AgentHistory

history = [
    AgentHistory(role="user", content="你好"),
    AgentHistory(role="assistant", content="你好，我能帮你做什么？"),
]

agent_run_info = AgentRunInfo(
    # ... 其他字段省略
    history=history,
)
```

## MCP 工具集成（可选）

若你提供 `mcp_host`（MCP 服务地址列表），Nexent 会自动通过 `ToolCollection.from_mcp` 拉取远程工具集合，并注入到智能体中：

```python
agent_run_info = AgentRunInfo(
    # ... 其他字段省略
    mcp_host=["http://localhost:3000"],
)
```

连接失败时会自动产出友好错误信息（中/英）。

## 中断执行

执行过程中可通过 `stop_event.set()` 触发中断：

```python
stop_event.set()  # 智能体会在当前步完成后优雅停止
```

## 与 CoreAgent 的关系

- `agent_run` 是对 `NexentAgent` 与 `CoreAgent` 的一层包装，负责：
  - 构造 `CoreAgent`（包含模型与工具）
  - 将历史注入记忆
  - 驱动流式执行并转发 `MessageObserver` 的缓存消息
- 你也可以直接使用 `CoreAgent.run(stream=True)` 自行处理流（见 `core/agents.md`），`agent_run` 提供了更方便的线程化与 JSON 消息输出。 