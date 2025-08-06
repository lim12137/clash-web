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

## 📚 更多资源

有关更高级的使用模式和详细的API文档，请参阅：

- **[工具开发指南](./core/tools)** - 详细的工具开发规范和示例
- **[模型架构指南](./core/models)** - 模型集成和使用文档
- **[智能体模块](./core/agents)** - 智能体开发的最佳实践和高级模式 