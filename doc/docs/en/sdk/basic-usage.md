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
import nexent
from nexent.core import MessageObserver, ProcessType
from nexent.core.agents import CoreAgent, NexentAgent
from nexent.core.models import OpenAIModel
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
# Create search tools
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
result = agent.run("Your question here")

# Access the final answer
print(result.final_answer)
```

## 🎯 Advanced Usage Patterns

### 🔧 Custom Tool Integration

```python
from nexent.core.tools import BaseTool

class CustomTool(BaseTool):
    def __init__(self, observer: MessageObserver):
        super().__init__(observer=observer, name="custom_tool")
    
    def run(self, input_text: str) -> str:
        # Your custom tool logic here
        return f"Processed: {input_text}"

# Add custom tool to agent
custom_tool = CustomTool(observer=observer)
agent.tools.append(custom_tool)
```

### 📡 Streaming Output Processing

```python
# Monitor streaming output
def handle_stream(message: str, process_type: ProcessType):
    if process_type == ProcessType.MODEL_OUTPUT_THINKING:
        print(f"🤔 Thinking: {message}")
    elif process_type == ProcessType.EXECUTION_LOGS:
        print(f"⚙️ Executing: {message}")
    elif process_type == ProcessType.FINAL_ANSWER:
        print(f"✅ Answer: {message}")

# Set observer with custom handler
observer.set_message_handler(handle_stream)
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
    temperature=0.7,  # Model creativity level
    system_prompt="You are a helpful AI assistant."  # Custom system prompt
)
```

### 🔧 Tool Configuration

```python
# Configure search tool with specific parameters
search_tool = ExaSearchTool(
    exa_api_key="your-exa-key",
    observer=observer,
    max_results=10,  # Number of search results
    search_type="neural",  # Search type: neural, keyword, etc.
    include_domains=["example.com"],  # Limit search to specific domains
    exclude_domains=["spam.com"]  # Exclude specific domains
)
```

## 📊 Error Handling

### 🛡️ Graceful Error Recovery

```python
try:
    result = agent.run("Your question")
    print(f"Success: {result.final_answer}")
except Exception as e:
    print(f"Error occurred: {e}")
    # Handle error appropriately
```

### 🔧 Tool Error Handling

```python
# Tools automatically handle errors and provide fallback options
search_tool = ExaSearchTool(
    exa_api_key="your-exa-key",
    observer=observer,
    max_results=5,
    fallback_to_keyword=True  # Fallback to keyword search if neural search fails
)
```

## 📚 More Resources

For more advanced usage patterns and detailed API documentation, please refer to:

- **[Tool Development Guide](./core/tools)** - Detailed tool development standards and examples
- **[Model Architecture Guide](./core/models)** - Model integration and usage documentation
- **[Agents](./core/agents)** - Best practices and advanced patterns for agent development 