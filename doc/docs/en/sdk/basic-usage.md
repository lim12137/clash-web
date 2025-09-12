# 💡 Basic Usage

This guide provides a comprehensive introduction to using the Nexent SDK for building intelligent agents.

## 🚀 Installation

### User Installation
If you want to use Nexent:

```bash
# Recommended: Install from source
git clone https://github.com/ModelEngine-Group/nexent.git
cd nexent/sdk
uv pip install -e .

# Or install using uv
uv add nexent
```

### Development Environment Setup
If you are a third-party SDK developer:

```bash
# Install complete development environment (including Nexent)
cd nexent/sdk
uv pip install -e ".[dev]"  # Includes all development tools (testing, code quality checks, etc.)
```

The development environment includes the following additional features:
- Code quality checking tools (ruff)
- Testing framework (pytest)
- Data processing dependencies (unstructured)
- Other development dependencies

## ⚡ Quick Start

### Basic Import

```python
from nexent.core.utils.observer import MessageObserver, ProcessType
from nexent.core.agents.core_agent import CoreAgent
from nexent.core.agents.nexent_agent import NexentAgent
from nexent.core.models.openai_llm import OpenAIModel
from nexent.core.tools import ExaSearchTool, KnowledgeBaseSearchTool
```

## 🤖 Creating Your First Agent

### 🔧 Setting Up the Environment

```python
# Create message observer for streaming output
observer = MessageObserver()

# Create model (model and Agent must use the same observer)
model = OpenAIModel(
    observer=observer,
    model_id="your-model-id",
    api_key="your-api-key",
    api_base="your-api-base"
)
```

### 🛠️ Adding Tools

```python
# Create search tool
search_tool = ExaSearchTool(
    exa_api_key="your-exa-key", 
    observer=observer, 
    max_results=5
)

# Create knowledge base tool
kb_tool = KnowledgeBaseSearchTool(
    top_k=5, 
    observer=observer
)
```

### 🤖 Building the Agent

```python
# Create Agent with tools and model
agent = CoreAgent(
    observer=observer,
    tools=[search_tool, kb_tool],
    model=model,
    name="my_agent",
    max_steps=5
)
```

### 🚀 Running the Agent

```python
# Run Agent with your question
agent.run("Your question here")
```

## 📡 Using agent_run (recommended for streaming)

When you need to consume messages as an "event stream" on server or client, use `agent_run`. It executes the agent in a background thread and continuously yields JSON messages, making it easy to render in UIs and collect logs.

Reference: [Run agent with agent_run](./core/agent-run)

Minimal example:

```python
import json
import asyncio
from threading import Event

from nexent.core.agents.run_agent import agent_run
from nexent.core.agents.agent_model import AgentRunInfo, AgentConfig, ModelConfig
from nexent.core.utils.observer import MessageObserver

async def main():
    observer = MessageObserver(lang="en")
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
        query="How many letter r are in strrawberry?",
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

## 🔧 Configuration Options

### ⚙️ Agent Configuration

```python
agent = CoreAgent(
    observer=observer,
    tools=[search_tool, kb_tool],
    model=model,
    name="my_agent",
    max_steps=10,  # Maximum execution steps
)
```

### 🔧 Tool Configuration

```python
# Configure search tool with specific parameters
search_tool = ExaSearchTool(
    exa_api_key="your-exa-key",
    observer=observer,
    max_results=10,  # Number of search results
)
```

## 📚 More Resources

- **[Run agent with agent_run](./core/agent-run)**
- **[Tool Development Guide](./core/tools)**
- **[Model Architecture Guide](./core/models)**
- **[Agents](./core/agents)** 