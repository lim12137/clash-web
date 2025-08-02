# 💡 Basic Usage

This guide provides a comprehensive introduction to using the Nexent SDK for building intelligent agents.

## 🚀 Quick Start

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

### 🎭 Multi-modal Agent Setup

```python
from nexent.core.models import OpenAIVLMModel

# Create vision-capable model
vision_model = OpenAIVLMModel(
    observer=observer,
    model_id="gpt-4-vision-preview",
    api_key="your-api-key"
)

# Create agent with vision capabilities
vision_agent = CoreAgent(
    observer=observer,
    tools=[search_tool],
    model=vision_model,
    name="vision_agent"
)
```

### 📡 Streaming Output Handling

```python
# Monitor streaming output
def handle_stream(message: str, process_type: ProcessType):
    if process_type == ProcessType.MODEL_OUTPUT_THINKING:
        print(f"🤔 Thinking: {message}")
    elif process_type == ProcessType.EXECUTION_LOGS:
        print(f"⚙️ Executing: {message}")
    elif process_type == ProcessType.FINAL_ANSWER:
        print(f"✅ Answer: {message}")

# Set up observer with custom handler
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
# Tools automatically handle errors and provide fallbacks
search_tool = ExaSearchTool(
    exa_api_key="your-exa-key",
    observer=observer,
    max_results=5,
    fallback_to_keyword=True  # Fallback to keyword search if neural fails
)
```

## 🎭 Multi-modal Examples

### 🖼️ Image Processing

```python
# Process image with vision model
result = vision_agent.run(
    "Describe what you see in this image",
    image_path="path/to/image.jpg"
)
```

### 🎤 Voice Processing

```python
from nexent.core.tools import SpeechToTextTool, TextToSpeechTool

# Add voice capabilities
stt_tool = SpeechToTextTool(observer=observer)
tts_tool = TextToSpeechTool(observer=observer)

voice_agent = CoreAgent(
    observer=observer,
    tools=[stt_tool, tts_tool, search_tool],
    model=model,
    name="voice_agent"
)
```

## 🔍 Best Practices

### ⚡ Performance Optimization

- **Connection Pooling**: Reuse connections for better performance
- **Batch Processing**: Process multiple requests together when possible
- **Caching**: Implement caching for frequently accessed data
- **Async Operations**: Use async/await for I/O intensive operations

### 🔒 Security Considerations

- **API Key Management**: Store API keys securely using environment variables
- **Input Validation**: Validate all inputs before processing
- **Rate Limiting**: Implement rate limiting to prevent abuse
- **Error Logging**: Log errors without exposing sensitive information

### 🔍 Monitoring and Debugging

```python
# Enable detailed logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Monitor agent execution
for step in agent.execution_steps:
    print(f"Step {step.step_number}: {step.action}")
    print(f"Result: {step.result}")
```

For more advanced usage patterns and detailed API documentation, see the **[Core Components](./core/)** and **[Tool Development](./core/tools)** guides. 