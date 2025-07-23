# Nexent

[![English](https://img.shields.io/badge/Language-English-blue.svg)](README_EN.md)

nexent 是一个企业级、高性能的 Agent SDK，提供了完整的智能体开发解决方案，支持分布式处理、流式输出、多模态交互和丰富的工具生态系统。

## 安装方式

### 用户安装
如果您想使用 nexent：

```bash
# 使用 uv 安装 (推荐)
uv add nexent

# 或从源码安装
uv pip install .
```

### 开发环境设置
如果您是第三方 SDK 开发者：

```bash
# 方式 1：仅安装依赖（不安装 nexent）
uv pip install -r requirements.txt

# 方式 2：安装完整开发环境（包括 nexent）
uv pip install -e ".[dev]"  # 包含所有开发工具（测试、代码质量检查等）
```

开发环境包含以下额外功能：
- 代码质量检查工具 (ruff)
- 测试框架 (pytest)
- 数据处理依赖 (unstructured)
- 其他开发依赖

## 使用方式

```python
import nexent
from nexent.core import MessageObserver, ProcessType
from nexent.core.agents import CoreAgent, NexentAgent
from nexent.core.models import OpenAIModel
from nexent.core.tools import ExaSearchTool, KnowledgeBaseSearchTool
```

### 创建基本 Agent

```python
# 创建消息观察者
observer = MessageObserver()

# 创建模型（model和Agent必须使用同一个observer）
model = OpenAIModel(
    observer=observer,
    model_id="your-model-id",
    api_key="your-api-key",
    api_base="your-api-base"
)

# 创建工具
search_tool = ExaSearchTool(exa_api_key="your-exa-key", observer=observer, max_results=5)
kb_tool = KnowledgeBaseSearchTool(top_k=5, observer=observer)

# 创建Agent
agent = CoreAgent(
    observer=observer,
    tools=[search_tool, kb_tool],
    model=model,
    name="my_agent",
    max_steps=5
)

# 运行Agent
result = agent.run("你的问题")
```

### 使用分布式数据处理服务

```python
from nexent.data_process import DataProcessCore

# 创建数据处理核心实例
core = DataProcessCore()

# 处理单个文档（支持内存处理）
with open("document.pdf", "rb") as f:
    file_data = f.read()

result = core.file_process(
    file_data=file_data,
    filename="document.pdf",
    chunking_strategy="by_title"
)

# 批量处理多个文档
documents = ["doc1.pdf", "doc2.docx", "sheet.xlsx"]
for doc in documents:
    result = core.file_process(
        file_path_or_url=doc,
        destination="local",
        chunking_strategy="basic"
    )
```

### 使用向量数据库服务

```python
from nexent.vector_database import ElasticSearchCore
from nexent.core.models import BaseEmbedding

# 初始化Elasticsearch核心服务
es_core = ElasticSearchCore(
    host="https://localhost:9200",
    api_key="your-elasticsearch-api-key"
)

# 创建索引并插入文档
index_name = "company_docs"
documents = [
    {"content": "文档内容", "title": "文档标题", "metadata": {...}}
]

# 支持混合搜索、语义搜索、精确搜索
results = es_core.hybrid_search(
    index_names=[index_name],
    query_text="搜索查询",
    embedding_model=embedding_model,
    top_k=5
)
```

## 主要特性

- **企业级Agent框架**：基于 SmolAgent 扩展，支持复杂业务场景
- **分布式处理能力**：
  - **异步处理**：基于 asyncio 的高性能异步架构
  - **多线程支持**：线程安全的并发处理机制
  - **Celery 友好**：专为分布式任务队列优化的设计
  - **批量操作**：支持大规模数据的批量处理和优化
- **丰富的 Agent 工具生态**：
  - **搜索工具**：EXA、Tavily、Linkup 网络搜索和本地知识库检索
  - **通信工具**：IMAP/SMTP 邮件收发功能
  - **MCP 集成**：支持 Model Context Protocol 工具集成
  - **统一规范**：所有工具遵循一致的开发标准和接口设计
- **多模态支持**：
  - **语音服务**：集成 STT & TTS，支持实时语音交互
  - **视觉模型**：支持图像理解和处理
  - **长上下文模型**：处理大规模文档和对话历史
- **强大的数据处理能力**：
  - **多格式支持**：处理 PDF、Word、Excel、HTML 等 20+ 种格式
  - **智能分块**：支持基础分块、标题分块、无分块等策略
  - **内存处理**：支持大文件的内存流式处理
  - **分布式架构**：支持任务队列管理和并行处理
- **向量数据库集成**：
  - **Elasticsearch**：企业级向量搜索和文档管理
  - **混合搜索**：结合精确匹配和语义搜索
  - **嵌入模型**：集成 Jina 等主流嵌入模型
  - **大规模优化**：支持数百万级文档的高效检索

## 核心组件

### NexentAgent - 企业级Agent框架

nexent 的核心是 `NexentAgent` 和 `CoreAgent` 类，提供完整的智能体解决方案：

- **多模型支持**：支持 OpenAI、视觉语言模型、长上下文模型等
- **MCP 集成**：无缝集成 Model Context Protocol 工具生态
- **动态工具加载**：支持本地工具和 MCP 工具的动态创建和管理
- **分布式执行**：基于线程池和异步架构的高性能执行引擎
- **状态管理**：完善的任务状态追踪和错误恢复机制

### CoreAgent - 代码执行引擎

继承并增强了 SmolAgent 的 `CodeAgent`，提供以下关键能力：

- **Python代码执行**：支持解析和执行Python代码，能够动态处理任务
- **多语言支持**：内置中英文提示词模板，可根据需要切换语言
- **流式输出**：通过 MessageObserver 实现模型输出的实时流式显示
- **步骤追踪**：记录并展示Agent执行的每个步骤，便于调试和监控
- **中断控制**：支持任务中断和优雅停止机制
- **错误处理**：完善的错误处理机制，提高稳定性
- **状态管理**：维护和传递执行状态，支持复杂任务的连续处理

CoreAgent 实现了ReAct框架的思考-行动-观察循环：
1. **思考**：使用大语言模型生成解决方案代码
2. **行动**：执行生成的Python代码
3. **观察**：收集执行结果和日志
4. **重复**：根据观察结果继续思考和执行，直到任务完成

### MessageObserver - 流式消息处理

消息观察者模式的核心实现，用于处理 Agent 的流式输出：

- **流式输出捕获**：实时捕获模型生成的token
- **过程类型区分**：根据不同的处理阶段（模型输出、代码解析、执行日志等）格式化输出
- **多语言支持**：支持中英文输出格式
- **统一接口**：为不同来源的消息提供统一处理方式

ProcessType枚举定义了以下处理阶段：
- `STEP_COUNT`: 当前执行步骤
- `MODEL_OUTPUT_THINKING`: 模型思考过程输出
- `MODEL_OUTPUT_CODE`: 模型代码生成输出
- `PARSE`: 代码解析结果
- `EXECUTION_LOGS`: 代码执行结果
- `AGENT_NEW_RUN`: Agent基本信息
- `FINAL_ANSWER`: 最终总结结果
- `SEARCH_CONTENT`: 搜索结果内容
- `PICTURE_WEB`: 网络图片处理结果

### 工具集

nexent 提供了丰富的工具生态系统，支持多种类型的任务处理。所有工具都遵循统一的开发规范，确保一致性和可扩展性。

#### 搜索工具
- **ExaSearchTool**: 基于 EXA API 的高质量网络搜索工具，支持实时爬取和图像过滤
- **TavilySearchTool**: 基于 Tavily API 的网络搜索工具，提供准确的搜索结果
- **LinkupSearchTool**: 基于 Linkup API 的搜索工具，支持文本和图像搜索结果
- **KnowledgeBaseSearchTool**: 本地知识库检索工具，支持混合搜索、精确匹配和语义搜索三种模式

#### 通信工具
- **GetEmailTool**: 邮件获取工具，支持 IMAP 协议，可按时间范围和发件人过滤邮件
- **SendEmailTool**: 邮件发送工具，支持 SMTP 协议，支持 HTML 格式和多收件人

#### 工具开发规范

所有工具都遵循以下设计原则：

1. **统一架构**：
   - 继承自 `smolagents.tools.Tool` 基类
   - 使用 `pydantic.Field` 进行参数管理
   - 集成 `MessageObserver` 支持流式输出
   - 内置中英文双语支持

2. **标准接口**：
   - 必须实现 `forward()` 方法作为主要执行入口
   - 统一的 JSON 格式输入输出
   - 完善的异常处理和日志记录
   - 支持参数验证和类型检查

3. **命名规范**：
   - 文件名：`{功能名}_tool.py`
   - 类名：`{功能名}Tool`
   - 属性和方法：小写字母 + 下划线

4. **扩展性**：
   - 模块化设计，便于功能扩展
   - 支持自定义配置和环境变量
   - 提供丰富的回调和钩子机制

详细的工具开发规范请参考工具开发文档：[中文版](nexent/core/tools/README.md) | [English](nexent/core/tools/README_EN.md)。

#### 工具使用示例

```python
from nexent.core.tools import ExaSearchTool, KnowledgeBaseSearchTool

# 网络搜索工具
search_tool = ExaSearchTool(
    exa_api_key="your-api-key",
    observer=observer,
    max_results=5
)

# 知识库搜索工具  
kb_tool = KnowledgeBaseSearchTool(
    top_k=5,
    index_names=["company_docs"],
    observer=observer,
    embedding_model=embedding_model,
    es_core=es_client
)

# 在Agent中使用
agent = CoreAgent(
    observer=observer,
    tools=[search_tool, kb_tool],
    model=model,
    name="search_agent"
)
```

### 数据处理服务

基于 Unstructured IO 和 OpenPyxl 构建的企业级文档处理服务，提供分布式处理能力：

- **多格式支持**：处理 20+ 种文档格式，包括 PDF、Word、Excel、PPT、HTML、Email 等
- **多源处理**：支持本地文件、远程 URL、MinIO 对象存储和内存数据处理
- **智能分块**：提供基础分块、标题分块、无分块等多种策略
- **分布式架构**：支持大规模文档的并行处理和批量操作
- **内存优化**：支持大文件的流式处理，减少内存占用
- **状态追踪**：完善的任务状态管理和错误恢复机制
- **Celery 友好**：专为分布式任务队列设计的架构

支持的文档格式：

| 文档类型 | 表格支持 | 策略选项 | 处理器 |
|---------|---------|---------|---------|
| CSV/TSV文件 | 是 | 无 | OpenPyxl |
| 电子邮件 (.eml/.msg) | 否 | 无 | Unstructured |
| 文档类 (.docx/.doc/.odt/.rtf) | 是 | 无 | Unstructured |
| 表格类 (.xlsx/.xls) | 是 | 无 | OpenPyxl |
| 演示类 (.pptx/.ppt) | 是 | 无 | Unstructured |
| PDF文档 | 是 | auto/fast/hi_res/ocr_only | Unstructured |
| 图像文件 | 是 | auto/hi_res/ocr_only | Unstructured |
| HTML/XML | 否 | 无 | Unstructured |
| 纯文本/代码文件 | 否 | 无 | Unstructured |
| Markdown/ReStructured Text | 是 | 无 | Unstructured |

使用方式：
```bash
# 启动分布式数据处理服务
python -m nexent.data_process --host 0.0.0.0 --port 8000 --workers 3 --data-dir ./data
```

### 向量数据库服务

提供企业级的向量搜索和文档管理服务，基于 Elasticsearch 构建：

- **多种搜索模式**：
  - **精确搜索**：基于关键词的传统文本匹配
  - **语义搜索**：基于向量相似度的语义理解搜索
  - **混合搜索**：结合精确匹配和语义搜索的最佳实践
- **嵌入模型集成**：支持 Jina、OpenAI 等主流嵌入模型
- **大规模优化**：
  - **批量操作**：支持数百万级文档的高效批量插入
  - **分布式友好**：Celery 兼容的上下文管理
  - **连接池管理**：优化的连接复用和资源管理
- **索引管理**：
  - **动态索引创建**：自动创建和配置索引结构
  - **索引统计**：实时监控索引状态和性能指标
  - **索引优化**：自动优化索引设置以提升性能
- **安全性**：支持 API Key 认证和 SSL/TLS 加密传输

### 模型服务

提供统一的多模态 AI 模型服务：

#### 语音服务 (STT & TTS)
- **语音识别(STT)**: 通过WebSocket连接进行实时音频转写
- **语音合成(TTS)**: 通过WebSocket流式传输将文本转换为音频
- **单一端口**: 两种服务在同一端口上运行，简化部署和使用
- **流式处理**: 支持实时流式音频识别和合成，提供低延迟体验

#### 大语言模型
- **OpenAI 集成**: 支持 GPT 系列模型
- **长上下文支持**: 专门优化的长上下文处理模型
- **流式输出**: 实时 token 流式生成
- **多配置管理**: 支持多个模型配置的动态切换

#### 视觉语言模型
- **多模态理解**: 支持图像和文本的联合理解
- **视觉问答**: 基于图像内容的智能问答
- **图像描述**: 自动生成图像描述和分析

#### 嵌入模型
- **多提供商支持**: Jina、OpenAI 等主流嵌入服务
- **批量处理**: 支持大规模文本的批量向量化
- **缓存优化**: 智能缓存机制提升处理效率

## 使用语音服务

```bash
uv run python -m nexent.service.voice_service --env .env --port 8000
```

更多详细使用说明，请参考各模块的专门文档。

## 架构优势

### 1. 分布式处理能力
- **异步架构**：基于 asyncio 的高性能异步处理
- **多线程安全**：线程安全的并发处理机制
- **Celery 集成**：专为分布式任务队列优化
- **批量优化**：智能批量操作减少网络开销

### 2. 企业级可扩展性
- **模块化设计**：松耦合的模块架构便于扩展
- **插件化工具**：标准化的工具接口支持快速集成
- **配置管理**：灵活的配置系统支持多环境部署
- **监控友好**：完善的日志和状态监控

### 3. 高性能优化
- **连接池**：数据库和HTTP连接的智能复用
- **内存管理**：大文件的流式处理和内存优化
- **并发控制**：智能的并发限制和负载均衡
- **缓存策略**：多层缓存提升响应速度

## 开发团队

- Shuangrui Chen
- Simeng Bian
- Tao Liu
- Jingyuan Li
- Mingchen Wan
- Yichen Xia
- Peiling Jiang
- Yu Lin

## Future Features

- Observer全量重构到Callback架构
- 提供NL2SQL能力
- Embedding模型抽象化
- 多用户使用能力
- 提供DeepDoc数据处理能力
- 提供向量知识库自动化Summary与自动化识别入库
- 提供可视化工具能力
- 提供邮件发送、提醒发送能力
- 提供文搜图、图搜图能力
- 多模态对话能力
- Ray 分布式计算集成
- Kubernetes 原生支持
