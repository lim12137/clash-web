# Run agent with agent_run (Streaming)

`agent_run` provides a concise and thread-friendly way to run an agent while exposing real-time streaming output via `MessageObserver`. It is ideal for server-side or frontend event stream rendering, as well as MCP tool integration scenarios.

## Quick Start

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
    # 1) Create message observer (for receiving streaming messages)
    observer = MessageObserver(lang="en")

    # 2) External stop flag (useful to interrupt from UI)
    stop_event = Event()

    # 3) Configure model
    model_config = ModelConfig(
        cite_name="gpt-4",               # Model alias (custom, referenced by AgentConfig)
        api_key="<YOUR_API_KEY>",
        model_name="Qwen/Qwen2.5-32B-Instruct",
        url="https://api.siliconflow.cn/v1",
        temperature=0.3,
        top_p=0.9
    )

    # 4) Configure Agent
    agent_config = AgentConfig(
        name="example_agent",
        description="An example agent that can execute Python code and search the web",
        prompt_templates=None,
        tools=[],
        max_steps=5,
        model_name="gpt-4",              # Corresponds to model_config.cite_name
        provide_run_summary=False,
        managed_agents=[]
    )

    # 5) Assemble run info
    agent_run_info = AgentRunInfo(
        query="How many letter r are in strrawberry?",  # Example question
        model_config_list=[model_config],
        observer=observer,
        agent_config=agent_config,
        mcp_host=None,                     # Optional: MCP service addresses
        history=None,                      # Optional: chat history
        stop_event=stop_event
    )

    # 6) Run with streaming and consume messages
    async for message in agent_run(agent_run_info):
        message_data = json.loads(message)
        message_type = message_data.get("type", "unknown")
        content = message_data.get("content", "")
        print(f"[{message_type}] {content}")

    # 7) Read final answer (if any)
    final_answer = observer.get_final_answer()
    if final_answer:
        print(f"\nFinal Answer: {final_answer}")


if __name__ == "__main__":
    logging.disable(logging.CRITICAL)
    asyncio.run(main())
```

Tip: Store sensitive config such as `api_key` in environment variables or a secrets manager, not in code.

## Message Stream Format and Handling

Internally, `agent_run` executes the agent in a background thread and continuously yields JSON strings from the `MessageObserver` message buffer. You can parse these fields for categorized display or logging.

- Important fields
  - `type`: message type (corresponds to `ProcessType`)
  - `content`: text content
  - `agent_name`: optional, which agent produced this message

Common `type` values (from `ProcessType`):
- `AGENT_NEW_RUN`: new task started
- `STEP_COUNT`: step updates
- `MODEL_OUTPUT_THINKING` / `MODEL_OUTPUT_CODE`: model thinking/code snippets
- `PARSE`: code parsing results
- `EXECUTION_LOGS`: Python execution logs
- `FINAL_ANSWER`: final answer
- `ERROR`: error information

## Configuration Reference

### ModelConfig

- `cite_name`: model alias (referenced by `AgentConfig.model_name`)
- `api_key`: model service API key
- `model_name`: model invocation name
- `url`: base URL of the model service
- `temperature` / `top_p`: sampling params

### AgentConfig

- `name`: agent name
- `description`: agent description
- `prompt_templates`: optional, Jinja template dict
- `tools`: tool configuration list (see ToolConfig)
- `max_steps`: maximum steps
- `model_name`: model alias (corresponds to `ModelConfig.cite_name`)
- `provide_run_summary`: whether sub-agents provide run summary
- `managed_agents`: list of sub-agent configurations

### Pass Chat History (optional)

You can pass historical messages via `AgentRunInfo.history`, and Nexent will write them into internal memory:

```python
from nexent.core.agents.agent_model import AgentHistory

history = [
    AgentHistory(role="user", content="Hi"),
    AgentHistory(role="assistant", content="Hello, how can I help you?"),
]

agent_run_info = AgentRunInfo(
    # ... other fields omitted
    history=history,
)
```

## MCP Tool Integration (optional)

If you provide `mcp_host` (list of MCP service addresses), Nexent will automatically pull remote tools through `ToolCollection.from_mcp` and inject them into the agent:

```python
agent_run_info = AgentRunInfo(
    # ... other fields omitted
    mcp_host=["http://localhost:3000"],
)
```

Friendly error messages (EN/ZH) will be produced if the connection fails.

## Interrupt Execution

During execution, you can trigger interruption via `stop_event.set()`:

```python
stop_event.set()  # The agent will gracefully stop after the current step completes
```

## Relation to CoreAgent

- `agent_run` is a wrapper over `NexentAgent` and `CoreAgent`, responsible for:
  - Constructing `CoreAgent` (including models and tools)
  - Injecting history into memory
  - Driving streaming execution and forwarding buffered messages from `MessageObserver`
- You can also directly use `CoreAgent.run(stream=True)` to handle streaming yourself (see `core/agents.md`); `agent_run` provides a more convenient threaded and JSON-message oriented interface. 