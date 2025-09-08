# AI Agent Development Overview

Nexent provides a comprehensive framework for developing and deploying AI agents with advanced capabilities including tool integration, reasoning, and multi-modal interactions.

## 🏗️ Agent Architecture

### Core Components

#### NexentAgent - Enterprise Agent Framework
The core of Nexent's agent system, providing complete intelligent agent solutions:

- **Multi-model Support**: Supports OpenAI, vision language models, long-context models, etc.
- **MCP Integration**: Seamless integration with Model Context Protocol tool ecosystem
- **Dynamic Tool Loading**: Supports dynamic creation and management of local and MCP tools
- **Distributed Execution**: High-performance execution engine based on thread pools and async architecture
- **State Management**: Complete task state tracking and error recovery mechanisms

#### CoreAgent - Code Execution Engine
Inherits and enhances SmolAgents' `CodeAgent`, providing the following key capabilities:

- **Python Code Execution**: Supports parsing and executing Python code for dynamic task processing
- **Multi-language Support**: Built-in Chinese and English prompt templates, switchable as needed
- **Streaming Output**: Real-time streaming display of model output through MessageObserver
- **Step Tracking**: Records and displays each step of Agent execution for debugging and monitoring
- **Interrupt Control**: Supports task interruption and graceful stop mechanisms
- **Error Handling**: Complete error handling mechanisms to improve stability
- **State Management**: Maintains and passes execution state, supports continuous processing of complex tasks

CoreAgent implements the ReAct framework's think-act-observe loop:
1. **Think**: Use large language models to generate solution code
2. **Act**: Execute the generated Python code
3. **Observe**: Collect execution results and logs
4. **Repeat**: Continue thinking and executing based on observation results until task completion

### 📡 MessageObserver - Streaming Message Processing
Core implementation of the message observer pattern for handling Agent's streaming output:

- **Streaming Output Capture**: Real-time capture of model-generated tokens
- **Process Type Distinction**: Format output based on different processing stages (model output, code parsing, execution logs, etc.)
- **Multi-language Support**: Supports Chinese and English output formats
- **Unified Interface**: Provides unified processing for messages from different sources

ProcessType enumeration defines the following processing stages:
- `STEP_COUNT`: Current execution step
- `MODEL_OUTPUT_THINKING`: Model thinking process output
- `MODEL_OUTPUT_CODE`: Model code generation output
- `PARSE`: Code parsing results
- `EXECUTION_LOGS`: Code execution results
- `AGENT_NEW_RUN`: Agent basic information
- `FINAL_ANSWER`: Final summary results
- `SEARCH_CONTENT`: Search result content
- `PICTURE_WEB`: Web image processing results

## 🤖 Agent Development

### Creating Basic Agents

```python
from nexent.core.utils.observer import MessageObserver
from nexent.core.agents.core_agent import CoreAgent
from nexent.core.models.openai_llm import OpenAIModel
from nexent.core.tools import ExaSearchTool, KnowledgeBaseSearchTool

# Create message observer
observer = MessageObserver()

# Create model (model and Agent must use the same observer)
model = OpenAIModel(
    observer=observer,
    model_id="your-model-id",
    api_key="your-api-key",
    api_base="your-api-base"
)

# Create tools
search_tool = ExaSearchTool(exa_api_key="your-exa-key", observer=observer, max_results=5)
kb_tool = KnowledgeBaseSearchTool(top_k=5, observer=observer)

# Create Agent
agent = CoreAgent(
    observer=observer,
    tools=[search_tool, kb_tool],
    model=model,
    name="my_agent",
    max_steps=5
)

# Run Agent
agent.run("Your question")
```

> For a simpler way to consume "JSON streaming messages", see: **[Run agent with agent_run](./agent-run)**.

#### System Prompt Templates
System prompt templates are located in `backend/prompts/`:

- **knowledge_summary_agent.yaml**: Knowledge base summary agent
- **manager_system_prompt_template.yaml**: Manager system prompt template
- **utils/**: Prompt utilities

- If you do not provide `system_prompt`, the SmolAgents default prompt will be used.
- To customize, it is recommended to render from `manager_system_prompt_template.yaml` and pass it in.

##### Load and override system_prompt (recommended)

```python
from pathlib import Path
import yaml
from jinja2 import Environment, BaseLoader

from nexent.core.agents.core_agent import CoreAgent
from nexent.core.models.openai_llm import OpenAIModel

# 1) Load YAML template text
prompt_yaml_path = Path("backend/prompts/manager_system_prompt_template.yaml")
yaml_text = prompt_yaml_path.read_text(encoding="utf-8")
yaml_data = yaml.safe_load(yaml_text)

# 2) Render Jinja template in 'system_prompt' key
system_prompt_template = yaml_data["system_prompt"]
jinja_env = Environment(loader=BaseLoader())
rendered_system_prompt = jinja_env.from_string(system_prompt_template).render(
    APP_NAME="Nexent Agent",
    APP_DESCRIPTION="Enterprise-grade AI agent",
    duty="Answer user questions and use tools when needed",
    tools={},                  # Provide tools summary if needed
    managed_agents={},         # Provide managed agents summary if needed
    knowledge_base_summary=None,
    constraint="Follow organization policies and ensure data/access security",
    authorized_imports=["requests", "pandas"],
    few_shots="",
    memory_list=[],
)

# Option A: Pass only rendered string
observer = MessageObserver()
model = OpenAIModel(observer=observer, model_id="your-model-id", api_key="your-api-key", api_base="your-api-base")
agent = CoreAgent(
    observer=observer,
    model=model,
    tools=[search_tool, kb_tool],
    system_prompt=rendered_system_prompt,
    name="my_agent",
)

# Option B: Replace the 'system_prompt' in the loaded YAML and pass the dict (advanced)
yaml_data["system_prompt"] = rendered_system_prompt
agent_yaml_prompt = CoreAgent(
    observer=observer,
    model=model,
    tools=[search_tool, kb_tool],
    system_prompt=yaml_data,
    name="my_agent",
)
```

> Note: `manager_system_prompt_template.yaml` also includes other template blocks such as `managed_agent`, `planning`, and `final_answer`. Typically, only `system_prompt` is needed; load additional blocks as required for advanced multi-agent scenarios.

#### Agent Implementation Steps

1. **Create Agent Instance**:
   ```python
   from nexent.core.agents.core_agent import CoreAgent
   from nexent.core.models.openai_llm import OpenAIModel

   model = OpenAIModel(
       model_id="your-model-id",
       api_key="your-api-key",
       api_base="your-api-base"
   )
   agent = CoreAgent(
       model=model,
       tools=[your_tools],
       system_prompt="Your system prompt"
   )
   ```

2. **Configure Agent Behavior**:
   - Add custom tools through the `tools` parameter
   - Set behavior through `system_prompt`
   - Configure parameters like `max_steps`

3. **Advanced Configuration**:
   ```python
   agent = CoreAgent(
       model=model,
       tools=custom_tools,
       system_prompt=custom_prompt,
       max_steps=10,
       verbose=True,
       additional_authorized_imports=["requests", "pandas"]
   )
   ```

## 🛠️ Tool Integration

### Custom Tool Development

Nexent implements tool systems based on [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/python-sdk).

#### Developing New Tools:
1. Implement logic in `backend/mcp_service/local_mcp_service.py`
2. Register with `@mcp.tool()` decorator
3. Restart MCP service

#### Example:
```python
@mcp.tool(name="my_tool", description="My custom tool")
def my_tool(param1: str, param2: int) -> str:
    # Implement tool logic
    return f"Processed result: {param1} {param2}"
```

## 🎯 Agent Execution Patterns

### ReAct Pattern
Standard execution pattern for problem-solving agents:
1. **Reasoning**: Analyze problems and develop methods
2. **Action**: Execute tools or generate code
3. **Observation**: Check results and outputs
4. **Iteration**: Continue until task completion

### Multi-Agent Collaboration
- **Hierarchical Agents**: Management agents coordinate working agents
- **Specialized Agents**: Domain-specific agents for specific tasks
- **Communication Protocols**: Standardized message passing between agents

### Error Handling and Recovery
- **Graceful Degradation**: Fallback strategies when tools fail
- **State Persistence**: Save agent state for recovery
- **Retry Mechanisms**: Automatic retry with backoff strategies

## ⚡ Performance Optimization

### Execution Efficiency
- **Parallel Tool Execution**: Concurrent execution of independent tools
- **Caching Strategies**: Cache model responses and tool results
- **Resource Management**: Efficient memory and computation usage

### Monitoring and Debugging
- **Execution Tracking**: Detailed logs of agent decisions
- **Performance Metrics**: Time and resource usage tracking
- **Debug Mode**: Detailed output during development

## 📋 Best Practices

### Agent Design
1. **Clear Objectives**: Define specific, measurable agent goals
2. **Appropriate Tools**: Choose tools that match agent capabilities
3. **Strong Prompts**: Create comprehensive system prompts
4. **Error Handling**: Implement comprehensive error recovery

### Development Workflow
1. **Iterative Development**: Incremental building and testing
2. **Prompt Engineering**: Optimize prompts based on test results
3. **Tool Testing**: Validate individual tools before integration
4. **Performance Testing**: Monitor and optimize execution speed

### Production Deployment
1. **Resource Allocation**: Ensure adequate computational resources
2. **Monitoring Setup**: Implement comprehensive logging and alerting
3. **Scaling Strategy**: Plan for increased load and usage
4. **Security Considerations**: Validate inputs and protect API access

For detailed implementation examples and advanced patterns, please refer to [Development Guide](../../getting-started/development-guide).