# Nexent

[![中文](https://img.shields.io/badge/Language-中文-blue.svg)](README.md)

Nexent is an enterprise-grade, high-performance Agent SDK that provides a complete intelligent agent development solution, supporting distributed processing, streaming output, multi-modal interaction, and a rich tool ecosystem.

## Installation

### User Installation
If you want to use nexent:

```bash
# Install using uv (recommended)
uv add nexent

# Or install from source
uv pip install .
```

### Development Environment Setup
If you are a third-party SDK developer:

```bash
# Method 1: Install dependencies only (without nexent)
uv pip install -r requirements.txt

# Method 2: Install complete development environment (including nexent)
uv pip install -e ".[dev]"  # Includes all development tools (testing, code quality checks, etc.)
```

The development environment includes the following additional features:
- Code quality checking tools (ruff)
- Testing framework (pytest)
- Data processing dependencies (unstructured)
- Other development dependencies

## Usage

```python
import nexent
from nexent.core import MessageObserver, ProcessType
from nexent.core.agents import CoreAgent, NexentAgent
from nexent.core.models import OpenAIModel
from nexent.core.tools import ExaSearchTool, KnowledgeBaseSearchTool
```

### Creating a Basic Agent

```python
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
result = agent.run("Your question")
```

### Using Distributed Data Processing Service

```python
from nexent.data_process import DataProcessCore

# Create data processing core instance
core = DataProcessCore()

# Process single document (supports in-memory processing)
with open("document.pdf", "rb") as f:
    file_data = f.read()

result = core.file_process(
    file_data=file_data,
    filename="document.pdf",
    chunking_strategy="by_title"
)

# Batch process multiple documents
documents = ["doc1.pdf", "doc2.docx", "sheet.xlsx"]
for doc in documents:
    result = core.file_process(
        file_path_or_url=doc,
        destination="local",
        chunking_strategy="basic"
    )
```

### Using Vector Database Service

```python
from nexent.vector_database import ElasticSearchCore
from nexent.core.models import BaseEmbedding

# Initialize Elasticsearch core service
es_core = ElasticSearchCore(
    host="https://localhost:9200",
    api_key="your-elasticsearch-api-key"
)

# Create index and insert documents
index_name = "company_docs"
documents = [
    {"content": "Document content", "title": "Document title", "metadata": {...}}
]

# Support hybrid search, semantic search, exact search
results = es_core.hybrid_search(
    index_names=[index_name],
    query_text="Search query",
    embedding_model=embedding_model,
    top_k=5
)
```

## Key Features

- **Enterprise-grade Agent Framework**: Extended from SmolAgent, supporting complex business scenarios
- **Distributed Processing Capabilities**:
  - **Asynchronous Processing**: High-performance asynchronous architecture based on asyncio
  - **Multi-threading Support**: Thread-safe concurrent processing mechanisms
  - **Celery-friendly**: Design optimized for distributed task queues
  - **Batch Operations**: Support for large-scale data batch processing and optimization
- **Rich Agent Tool Ecosystem**:
  - **Search Tools**: EXA, Tavily, Linkup web search and local knowledge base retrieval
  - **Communication Tools**: IMAP/SMTP email functionality
  - **MCP Integration**: Support for Model Context Protocol tool integration
  - **Unified Standards**: All tools follow consistent development standards and interface design
- **Multi-modal Support**:
  - **Voice Services**: Integrated STT & TTS, supporting real-time voice interaction
  - **Vision Models**: Support for image understanding and processing
  - **Long Context Models**: Processing large-scale documents and conversation history
- **Powerful Data Processing Capabilities**:
  - **Multi-format Support**: Processing 20+ formats including PDF, Word, Excel, HTML
  - **Intelligent Chunking**: Support for basic chunking, title chunking, no chunking strategies
  - **Memory Processing**: Support for streaming processing of large files in memory
  - **Distributed Architecture**: Support for task queue management and parallel processing
- **Vector Database Integration**:
  - **Elasticsearch**: Enterprise-grade vector search and document management
  - **Hybrid Search**: Combining exact matching and semantic search
  - **Embedding Models**: Integration with mainstream embedding models like Jina
  - **Large-scale Optimization**: Support for efficient retrieval of millions of documents

## Core Components

### NexentAgent - Enterprise-grade Agent Framework

The core of nexent is the `NexentAgent` and `CoreAgent` classes, providing complete intelligent agent solutions:

- **Multi-model Support**: Support for OpenAI, vision language models, long context models, etc.
- **MCP Integration**: Seamless integration with Model Context Protocol tool ecosystem
- **Dynamic Tool Loading**: Support for dynamic creation and management of local and MCP tools
- **Distributed Execution**: High-performance execution engine based on thread pools and asynchronous architecture
- **State Management**: Comprehensive task state tracking and error recovery mechanisms

### CoreAgent - Code Execution Engine

Inherits and enhances SmolAgent's `CodeAgent`, providing the following key capabilities:

- **Python Code Execution**: Support for parsing and executing Python code, capable of dynamic task processing
- **Multi-language Support**: Built-in Chinese and English prompt templates, switchable as needed
- **Streaming Output**: Real-time streaming display of model output through MessageObserver
- **Step Tracking**: Record and display each step of Agent execution for debugging and monitoring
- **Interrupt Control**: Support for task interruption and graceful stop mechanisms
- **Error Handling**: Comprehensive error handling mechanisms to improve stability
- **State Management**: Maintain and pass execution state, supporting continuous processing of complex tasks

CoreAgent implements the ReAct framework's think-act-observe loop:
1. **Think**: Use large language models to generate solution code
2. **Act**: Execute the generated Python code
3. **Observe**: Collect execution results and logs
4. **Repeat**: Continue thinking and executing based on observation results until the task is completed

### MessageObserver - Streaming Message Processing

Core implementation of the message observer pattern, used to handle Agent's streaming output:

- **Streaming Output Capture**: Real-time capture of tokens generated by the model
- **Process Type Distinction**: Format output according to different processing stages (model output, code parsing, execution logs, etc.)
- **Multi-language Support**: Support for Chinese and English output formats
- **Unified Interface**: Provide unified processing methods for messages from different sources

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

### Tool Suite

Nexent provides a rich tool ecosystem supporting multiple types of task processing. All tools follow unified development standards to ensure consistency and extensibility.

#### Search Tools
- **ExaSearchTool**: High-quality web search tool based on EXA API, supporting real-time crawling and image filtering
- **TavilySearchTool**: Web search tool based on Tavily API, providing accurate search results
- **LinkupSearchTool**: Search tool based on Linkup API, supporting text and image search results
- **KnowledgeBaseSearchTool**: Local knowledge base retrieval tool, supporting hybrid search, exact matching, and semantic search modes

#### Communication Tools
- **GetEmailTool**: Email retrieval tool supporting IMAP protocol, can filter emails by time range and sender
- **SendEmailTool**: Email sending tool supporting SMTP protocol, HTML format, and multiple recipients

#### Tool Development Standards

All tools follow these design principles:

1. **Unified Architecture**:
   - Inherit from `smolagents.tools.Tool` base class
   - Use `pydantic.Field` for parameter management
   - Integrate `MessageObserver` for streaming output support
   - Built-in Chinese and English bilingual support

2. **Standard Interface**:
   - Must implement `forward()` method as the main execution entry
   - Unified JSON format input and output
   - Comprehensive exception handling and logging
   - Support parameter validation and type checking

3. **Naming Conventions**:
   - File name: `{function_name}_tool.py`
   - Class name: `{FunctionName}Tool`
   - Attributes and methods: lowercase letters + underscores

4. **Extensibility**:
   - Modular design for easy functional extension
   - Support custom configuration and environment variables
   - Provide rich callback and hook mechanisms

For detailed tool development standards, please refer to the tool development documentation: [中文版](nexent/core/tools/README.md) | [English](nexent/core/tools/README_EN.md).

#### Tool Usage Examples

```python
from nexent.core.tools import ExaSearchTool, KnowledgeBaseSearchTool

# Web search tool
search_tool = ExaSearchTool(
    exa_api_key="your-api-key",
    observer=observer,
    max_results=5
)

# Knowledge base search tool  
kb_tool = KnowledgeBaseSearchTool(
    top_k=5,
    index_names=["company_docs"],
    observer=observer,
    embedding_model=embedding_model,
    es_core=es_client
)

# Use in Agent
agent = CoreAgent(
    observer=observer,
    tools=[search_tool, kb_tool],
    model=model,
    name="search_agent"
)
```

### Data Processing Service

Enterprise-grade document processing service based on Unstructured IO and OpenPyxl, providing distributed processing capabilities:

- **Multi-format Support**: Process 20+ document formats including PDF, Word, Excel, PPT, HTML, Email, etc.
- **Multi-source Processing**: Support local files, remote URLs, MinIO object storage, and in-memory data processing
- **Intelligent Chunking**: Provide basic chunking, title chunking, no chunking, and other strategies
- **Distributed Architecture**: Support parallel processing and batch operations for large-scale documents
- **Memory Optimization**: Support streaming processing of large files to reduce memory usage
- **State Tracking**: Comprehensive task state management and error recovery mechanisms
- **Celery-friendly**: Architecture designed for distributed task queues

Supported document formats:

| Document Type | Table Support | Strategy Options | Processor |
|---------|---------|---------|---------|
| CSV/TSV files | Yes | None | OpenPyxl |
| Email (.eml/.msg) | No | None | Unstructured |
| Document types (.docx/.doc/.odt/.rtf) | Yes | None | Unstructured |
| Spreadsheet types (.xlsx/.xls) | Yes | None | OpenPyxl |
| Presentation types (.pptx/.ppt) | Yes | None | Unstructured |
| PDF documents | Yes | auto/fast/hi_res/ocr_only | Unstructured |
| Image files | Yes | auto/hi_res/ocr_only | Unstructured |
| HTML/XML | No | None | Unstructured |
| Plain text/code files | No | None | Unstructured |
| Markdown/ReStructured Text | Yes | None | Unstructured |

Usage:
```bash
# Start distributed data processing service
python -m nexent.data_process --host 0.0.0.0 --port 8000 --workers 3 --data-dir ./data
```

### Vector Database Service

Provides enterprise-grade vector search and document management services based on Elasticsearch:

- **Multiple Search Modes**:
  - **Exact Search**: Traditional text matching based on keywords
  - **Semantic Search**: Semantic understanding search based on vector similarity
  - **Hybrid Search**: Best practices combining exact matching and semantic search
- **Embedding Model Integration**: Support for mainstream embedding models like Jina, OpenAI
- **Large-scale Optimization**:
  - **Batch Operations**: Support efficient batch insertion of millions of documents
  - **Distributed-friendly**: Celery-compatible context management
  - **Connection Pool Management**: Optimized connection reuse and resource management
- **Index Management**:
  - **Dynamic Index Creation**: Automatic creation and configuration of index structures
  - **Index Statistics**: Real-time monitoring of index status and performance metrics
  - **Index Optimization**: Automatic optimization of index settings to improve performance
- **Security**: Support API Key authentication and SSL/TLS encrypted transmission

### Model Services

Provides unified multi-modal AI model services:

#### Voice Services (STT & TTS)
- **Speech Recognition (STT)**: Real-time audio transcription through WebSocket connections
- **Text-to-Speech (TTS)**: Streaming text-to-audio conversion through WebSocket
- **Single Port**: Both services run on the same port, simplifying deployment and usage
- **Streaming Processing**: Support real-time streaming audio recognition and synthesis with low latency

#### Large Language Models
- **OpenAI Integration**: Support for GPT series models
- **Long Context Support**: Specially optimized long context processing models
- **Streaming Output**: Real-time token streaming generation
- **Multi-configuration Management**: Support dynamic switching of multiple model configurations

#### Vision Language Models
- **Multi-modal Understanding**: Support joint understanding of images and text
- **Visual Q&A**: Intelligent Q&A based on image content
- **Image Description**: Automatic generation of image descriptions and analysis

#### Embedding Models
- **Multi-provider Support**: Mainstream embedding services like Jina, OpenAI
- **Batch Processing**: Support large-scale text batch vectorization
- **Cache Optimization**: Intelligent caching mechanisms to improve processing efficiency

## Using Voice Services

```bash
uv run python -m nexent.service.voice_service --env .env --port 8000
```

For more detailed usage instructions, please refer to the dedicated documentation for each module.

## Architecture Advantages

### 1. Distributed Processing Capabilities
- **Asynchronous Architecture**: High-performance asynchronous processing based on asyncio
- **Multi-thread Safety**: Thread-safe concurrent processing mechanisms
- **Celery Integration**: Optimized for distributed task queues
- **Batch Optimization**: Intelligent batch operations to reduce network overhead

### 2. Enterprise-grade Scalability
- **Modular Design**: Loosely coupled modular architecture for easy extension
- **Plugin Tools**: Standardized tool interfaces supporting rapid integration
- **Configuration Management**: Flexible configuration system supporting multi-environment deployment
- **Monitoring-friendly**: Comprehensive logging and status monitoring

### 3. High-performance Optimization
- **Connection Pooling**: Intelligent reuse of database and HTTP connections
- **Memory Management**: Streaming processing and memory optimization for large files
- **Concurrency Control**: Intelligent concurrency limits and load balancing
- **Caching Strategy**: Multi-layer caching to improve response speed

## Development Team

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

- Complete refactoring of Observer to Callback architecture
- Provide NL2SQL capabilities
- Embedding model abstraction
- Multi-user support capabilities
- Provide DeepDoc data processing capabilities
- Provide automated Summary and automated recognition for vector knowledge bases
- Provide visualization tool capabilities
- Provide email sending and reminder capabilities
- Provide text-to-image and image-to-image capabilities
- Multi-modal conversation capabilities
- Ray distributed computing integration
- Kubernetes native support 