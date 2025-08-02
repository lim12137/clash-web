# 💡 基本使用

本指南提供使用 Nexent SDK 构建智能体的全面介绍。

## 🚀 快速开始

### 💡 基本导入

```python
import nexent
from nexent.core import MessageObserver, ProcessType
from nexent.core.agents import CoreAgent, NexentAgent
from nexent.core.models import OpenAIModel
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
result = agent.run("你的问题")

# 访问最终答案
print(result.final_answer)
```

## 🎯 高级使用模式

### 🔧 自定义工具集成

```python
from nexent.core.tools import BaseTool

class CustomTool(BaseTool):
    def __init__(self, observer: MessageObserver):
        super().__init__(observer=observer, name="custom_tool")
    
    def run(self, input_text: str) -> str:
        # 你的自定义工具逻辑
        return f"已处理: {input_text}"

# 将自定义工具添加到智能体
custom_tool = CustomTool(observer=observer)
agent.tools.append(custom_tool)
```

### 🎭 多模态智能体设置

```python
from nexent.core.models import OpenAIVLMModel

# 创建支持视觉的模型
vision_model = OpenAIVLMModel(
    observer=observer,
    model_id="gpt-4-vision-preview",
    api_key="your-api-key"
)

# 创建具有视觉能力的智能体
vision_agent = CoreAgent(
    observer=observer,
    tools=[search_tool],
    model=vision_model,
    name="vision_agent"
)
```

### 📡 流式输出处理

```python
# 监控流式输出
def handle_stream(message: str, process_type: ProcessType):
    if process_type == ProcessType.MODEL_OUTPUT_THINKING:
        print(f"🤔 思考中: {message}")
    elif process_type == ProcessType.EXECUTION_LOGS:
        print(f"⚙️ 执行中: {message}")
    elif process_type == ProcessType.FINAL_ANSWER:
        print(f"✅ 答案: {message}")

# 设置带有自定义处理器的观察者
observer.set_message_handler(handle_stream)
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
    temperature=0.7,  # 模型创造力水平
    system_prompt="你是一个有用的AI助手。"  # 自定义系统提示
)
```

### 🔧 工具配置

```python
# 使用特定参数配置搜索工具
search_tool = ExaSearchTool(
    exa_api_key="your-exa-key",
    observer=observer,
    max_results=10,  # 搜索结果数量
    search_type="neural",  # 搜索类型: neural, keyword 等
    include_domains=["example.com"],  # 限制搜索到特定域名
    exclude_domains=["spam.com"]  # 排除特定域名
)
```

## 📊 错误处理

### 🛡️ 优雅的错误恢复

```python
try:
    result = agent.run("你的问题")
    print(f"成功: {result.final_answer}")
except Exception as e:
    print(f"发生错误: {e}")
    # 适当处理错误
```

### 🔧 工具错误处理

```python
# 工具自动处理错误并提供回退方案
search_tool = ExaSearchTool(
    exa_api_key="your-exa-key",
    observer=observer,
    max_results=5,
    fallback_to_keyword=True  # 如果神经搜索失败，回退到关键词搜索
)
```

## 🎭 多模态示例

### 💡 图像处理

```python
# 使用视觉模型处理图像
result = vision_agent.run(
    "描述你在这张图片中看到的内容",
    image_path="path/to/image.jpg"
)
```

### 💡 语音处理

```python
from nexent.core.tools import SpeechToTextTool, TextToSpeechTool

# 添加语音能力
stt_tool = SpeechToTextTool(observer=observer)
tts_tool = TextToSpeechTool(observer=observer)

voice_agent = CoreAgent(
    observer=observer,
    tools=[stt_tool, tts_tool, search_tool],
    model=model,
    name="voice_agent"
)
```

## 🔍 最佳实践

### 💡 性能优化

- **连接池**: 重用连接以获得更好的性能
- **批量处理**: 在可能的情况下一起处理多个请求
- **缓存**: 为频繁访问的数据实现缓存
- **异步操作**: 对I/O密集型操作使用 async/await

### 💡 安全考虑

- **API密钥管理**: 使用环境变量安全存储API密钥
- **输入验证**: 在处理前验证所有输入
- **速率限制**: 实现速率限制以防止滥用
- **错误日志**: 记录错误而不暴露敏感信息

### 💡 监控和调试

```python
# 启用详细日志
import logging
logging.basicConfig(level=logging.DEBUG)

# 监控智能体执行
for step in agent.execution_steps:
    print(f"步骤 {step.step_number}: {step.action}")
    print(f"结果: {step.result}")
```

有关更高级的使用模式和详细的API文档，请参阅 **[核心组件](./core/)** 和 **[工具开发](./core/tools)** 指南。 