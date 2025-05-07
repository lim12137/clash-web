# Nexent

nexent 是一个轻量化、低代码的Agent SDK，提供了丰富的 Agent 工具集、流式输出能力和语音服务、数据处理服务集成。

## 安装方式

### 用户安装
如果您想使用 nexent：

```bash
# 从 PyPI 安装
pip install nexent

# 或从源码安装
pip install .
```

### 开发环境设置
如果您是第三方 SDK 开发者：

```bash
# 方式 1：仅安装依赖（不安装 nexent）
pip install -r requirements.txt

# 方式 2：安装完整开发环境（包括 nexent）
pip install -e ".[dev]"  # 包含所有开发工具（测试、代码质量检查等）
```

开发环境包含以下额外功能：
- 代码质量检查工具 (ruff)
- 测试框架 (pytest)
- 其他开发依赖

## 使用方式

```python
import nexent
from nexent.core import CoreAgent, OpenAIModel, MessageObserver
from nexent.core.tools import EXASearchTool, FinalAnswerFormatTool
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
search_tool = EXASearchTool(exa_api_key="your-exa-key", max_results=5)
final_answer_tool = FinalAnswerFormatTool(llm=model, system_prompt="自定义提示词")

# 创建Agent
agent = CoreAgent(
    observer=observer,
    tools=[search_tool, final_answer_tool],
    model=model,
    name="my_agent",
    max_steps=5
)

# 运行Agent
result = agent.run("你的问题")
```

### 使用数据处理服务

```python
from nexent.data_process import process_data, DataProcessService

# 直接清洗单个文档
result = process_data(
    source="path/to/document.pdf",
    source_type="file"
)

# 或启动清洗服务进行任务管理
service = DataProcessService(num_workers=3)
service.start()

# 创建清洗任务
task_id = service.create_task(
    source="https://example.com",
    source_type="url"
)

# 获取任务结果
task = service.get_task(task_id)
print(f"任务状态: {task['status']}")

# 停止服务
service.stop()
```

## 主要特性

- 继承 SmolAgent 的核心能力
- 支持多种 Agent 工具:
  - 博查 (Bocha) 搜索工具
  - EXA 专业网络检索工具
  - 本地知识库检索工具
  - 格式化输出工具
- 模型流式输出支持
- 可扩展的消息观察者模式
- 集成语音服务 (STT & TTS)
- 数据处理服务:
  - 处理多种文档格式（PDF、Word、HTML等）
  - 批量处理多源文档
  - 任务队列管理和并行处理
  - REST API接口支持

## 核心组件

### CoreAgent

nexent 的核心是 `CoreAgent` 类，它继承并增强了 SmolAgent 的 `CodeAgent`，提供以下关键能力：

- **Python代码执行**：支持解析和执行Python代码，能够动态处理任务
- **多语言支持**：内置中英文提示词模板，可根据需要切换语言
- **流式输出**：通过 MessageObserver 实现模型输出的实时流式显示
- **步骤追踪**：记录并展示Agent执行的每个步骤，便于调试和监控
- **自定义工具集成**：轻松集成自定义工具，扩展Agent能力
- **错误处理**：完善的错误处理机制，提高稳定性
- **状态管理**：维护和传递执行状态，支持复杂任务的连续处理

CoreAgent 实现了ReAct框架的思考-行动-观察循环：
1. **思考**：使用大语言模型生成解决方案代码
2. **行动**：执行生成的Python代码
3. **观察**：收集执行结果和日志
4. **重复**：根据观察结果继续思考和执行，直到任务完成

### MessageObserver

消息观察者模式的核心实现，用于处理 Agent 的流式输出：

- **流式输出捕获**：实时捕获模型生成的token
- **过程类型区分**：根据不同的处理阶段（模型输出、代码解析、执行日志等）格式化输出
- **多语言支持**：支持中英文输出格式
- **统一接口**：为不同来源的消息提供统一处理方式

ProcessType枚举定义了以下处理阶段：
- `STEP_COUNT`: 当前执行步骤
- `MODEL_OUTPUT`: 模型流式输出
- `PARSE`: 代码解析结果
- `EXECUTION_LOGS`: 代码执行结果
- `AGENT_NEW_RUN`: Agent基本信息
- `FINAL_ANSWER`: 最终总结结果

### 工具集

- **EXASearchTool**: EXA搜索工具，提供高质量的网络搜索能力，支持结果自动总结
- **KBSearchTool**: 知识库检索工具，用于搜索和获取本地知识库中的相关信息
- **SummaryTool**: 输出格式化工具，根据自定义系统提示词优化最终输出格式

### 数据处理服务

基于Unstructured IO构建的文档处理服务，提供以下功能：

- **多格式支持**：处理PDF、Word、HTML、Email等多种格式
- **多源处理**：支持文件、URL和原始文本处理
- **并行处理**：维护任务队列实现并行清洗（默认3线程）
- **REST API**：提供HTTP接口进行任务管理和结果检索
- **任务转发**：将处理结果转发至外部服务
- **状态追踪**：跟踪和查询任务处理状态
- **持久化**：可选的任务信息持久化存储

支持的文档格式：

| 文档类型 | 表格支持 | 策略选项 |
|---------|---------|---------|
| CSV/TSV文件 | 是 | 无 |
| 电子邮件 (.eml/.msg) | 否 | 无 |
| 文档类 (.docx/.doc/.odt/.rtf) | 是 | 无 |
| 表格类 (.xlsx/.xls) | 是 | 无 |
| 演示类 (.pptx/.ppt) | 是 | 无 |
| PDF文档 | 是 | auto/fast/hi_res/ocr_only |
| 图像文件 | 是 | auto/hi_res/ocr_only |
| HTML/XML | 否 | 无 |
| 纯文本/代码文件 | 否 | 无 |
| Markdown/ReStructured Text | 是 | 无 |

使用方式：
```bash
# 启动服务
python -m data_process --host 0.0.0.0 --port 8000 --workers 3 --data-dir ./data
```

### 语音服务

提供统一的语音识别(STT)和语音合成(TTS)服务，支持WebSocket实时通信：

- **语音识别(STT)**: 通过WebSocket连接进行实时音频转写
- **语音合成(TTS)**: 通过WebSocket流式传输将文本转换为音频
- **单一端口**: 两种服务在同一端口上运行，简化部署和使用
- **流式处理**: 支持实时流式音频识别和合成，提供低延迟体验

## 使用语音服务

```bash
python -m nexent.service.voice_service --env .env --port 8000
```

更多详细使用说明，请参考 [语音服务文档](doc/voice_service.md)。

## 开发团队

- Shuangrui Chen
- Simeng Bian
- Tao Liu
- Jingyuan Li
- Mingchen Wan
- Yichen Xia
- Peiling Jiang
- Yu Lin

## Known Issues

TODO

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
