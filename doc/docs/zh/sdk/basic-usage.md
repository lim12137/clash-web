# 💡 基本使用

本指南提供使用 Nexent SDK 构建智能体的全面介绍。

## 🚀 安装方式

### 用户安装
如果您想使用 Nexent：

```bash
# 推荐：从源码安装
git clone https://github.com/ModelEngine-Group/nexent.git
cd nexent/sdk
uv pip install -e .

# 或使用 uv 安装
uv add nexent
```

### 开发环境设置
如果您是第三方 SDK 开发者：

```bash
# 安装完整开发环境（包括 Nexent）
cd nexent/sdk
uv pip install -e ".[dev]"  # 包含所有开发工具（测试、代码质量检查等）
```

开发环境包含以下额外功能：
- 代码质量检查工具 (ruff)
- 测试框架 (pytest)
- 数据处理依赖 (unstructured)
- 其他开发依赖

## ⚡ 快速开始

### 💡 基本导入

```python
from nexent.core.utils.observer import MessageObserver, ProcessType
from nexent.core.agents.core_agent import CoreAgent
from nexent.core.agents.nexent_agent import NexentAgent
from nexent.core.models.openai_llm import OpenAIModel
from nexent.core.tools import ExaSearchTool, KnowledgeBaseSearchTool
```

## 🤖 创建你的第一个智能体

### 🔧 设置环境

```python
# 创建消息观察者用于流式输出
observer = MessageObserver()

# 创建模型（模型和智能体必须使用同一个观察者）
model = OpenAIModel(
    observer=observer,
    model_id="your-model-id",
    api_key="your-api-key",
    api_base="your-api-base"
)
```

### 🛠️ 添加工具

```python
# 创建搜索工具
search_tool = ExaSearchTool(
    exa_api_key="your-exa-key", 
    observer=observer, 
    max_results=5
)

# 创建知识库工具
kb_tool = KnowledgeBaseSearchTool(
    top_k=5, 
    observer=observer
)
```

### 🤖 构建智能体

```python
# 使用工具和模型创建智能体
agent = CoreAgent(
    observer=observer,
    tools=[search_tool, kb_tool],
    model=model,
    name="my_agent",
    max_steps=5
)
```

### 🚀 运行智能体

```python
# 用你的问题运行智能体
agent.run("你的问题")

```

## 📡 使用 agent_run（推荐的流式运行方式）

当你需要在服务端或前端以“事件流”方式消费消息时，推荐使用 `agent_run`。它会在后台线程执行智能体，并持续产出 JSON 格式的消息，便于 UI 展示与日志采集。

参考文档： [使用 agent_run 运行智能体](./core/agent-run)

最小示例：

```python
import json
import asyncio
from threading import Event

from nexent.core.agents.run_agent import agent_run
from nexent.core.agents.agent_model import AgentRunInfo, AgentConfig, ModelConfig
from nexent.core.utils.observer import MessageObserver

async def main():
    observer = MessageObserver(lang="zh")
    stop_event = Event()

    model_config = ModelConfig(
        cite_name="gpt-4",
        api_key="<YOUR_API_KEY>",
        model_name="Qwen/Qwen2.5-32B-Instruct",
        url="https://api.siliconflow.cn/v1",
    )

    agent_config = AgentConfig(
        name="example_agent",
        description="An example agent",
        tools=[],
        max_steps=5,
        model_name="gpt-4",
    )

    agent_run_info = AgentRunInfo(
        query="strrawberry中出现了多少个字母r",
        model_config_list=[model_config],
        observer=observer,
        agent_config=agent_config,
        stop_event=stop_event
    )

    async for message in agent_run(agent_run_info):
        message_data = json.loads(message)
        print(message_data)

asyncio.run(main())
```

## 🔧 配置选项

### ⚙️ 智能体配置

```python
agent = CoreAgent(
    observer=observer,
    tools=[search_tool, kb_tool],
    model=model,
    name="my_agent",
    max_steps=10,  # 最大执行步骤
)
```

### 🔧 工具配置

```python
# 使用特定参数配置搜索工具
search_tool = ExaSearchTool(
    exa_api_key="your-exa-key",
    observer=observer,
    max_results=10,  # 搜索结果数量
)
```

## 📚 更多资源

- **[使用 agent_run 运行智能体](./core/agent-run)**
- **[工具开发指南](./core/tools)**
- **[模型架构指南](./core/models)**
- **[智能体模块](./core/agents)** 