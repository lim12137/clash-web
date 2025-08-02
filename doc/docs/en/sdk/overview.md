# Nexent SDK

Nexent is a powerful, enterprise-grade Agent SDK that revolutionizes intelligent agent development. Built on proven enterprise architecture, it provides a comprehensive solution for building production-ready AI agents with distributed processing, real-time streaming, multi-modal capabilities, and an extensive ecosystem of tools and models.

## 🚀 Installation

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

## 📖 Basic Usage

For comprehensive usage examples and step-by-step guides, see our **[Basic Usage Guide](./basic-usage)**.



## ⭐ Key Features

### 🏢 Enterprise-grade Agent Framework
- **Extended from SmolAgent**: Supporting complex business scenarios
- **Production Ready**: Built for enterprise environments with proper scaling and monitoring
- **Comprehensive Testing**: Extensive test coverage ensuring reliability

### ⚡ Distributed Processing Capabilities
- **Asynchronous Processing**: High-performance asynchronous architecture based on asyncio
- **Multi-threading Support**: Thread-safe concurrent processing mechanisms
- **Celery-friendly**: Design optimized for distributed task queues
- **Batch Operations**: Support for large-scale data batch processing and optimization

### 🔧 Rich Agent Tool Ecosystem
- **Search Tools**: EXA, Tavily, Linkup web search and local knowledge base retrieval
- **Communication Tools**: IMAP/SMTP email functionality
- **MCP Integration**: Support for Model Context Protocol tool integration
- **Unified Standards**: All tools follow consistent development standards and interface design

### 🎭 Multi-modal Support
- **Voice Services**: Integrated STT & TTS, supporting real-time voice interaction
- **Vision Models**: Support for image understanding and processing
- **Long Context Models**: Processing large-scale documents and conversation history

### 📊 Powerful Data Processing Capabilities
- **Multi-format Support**: Processing 20+ formats including PDF, Word, Excel, HTML
- **Intelligent Chunking**: Support for basic chunking, title chunking, no chunking strategies
- **Memory Processing**: Support for streaming processing of large files in memory
- **Distributed Architecture**: Support for task queue management and parallel processing

### 🔍 Vector Database Integration
- **Elasticsearch**: Enterprise-grade vector search and document management
- **Hybrid Search**: Combining exact matching and semantic search
- **Embedding Models**: Integration with mainstream embedding models like Jina
- **Large-scale Optimization**: Support for efficient retrieval of millions of documents

## 🏗️ Core Components

### 🤖 NexentAgent - Enterprise-grade Agent Framework

The core of nexent is the `NexentAgent` and `CoreAgent` classes, providing complete intelligent agent solutions:

- **Multi-model Support**: Support for OpenAI, vision language models, long context models, etc.
- **MCP Integration**: Seamless integration with Model Context Protocol tool ecosystem
- **Dynamic Tool Loading**: Support for dynamic creation and management of local and MCP tools
- **Distributed Execution**: High-performance execution engine based on thread pools and asynchronous architecture
- **State Management**: Comprehensive task state tracking and error recovery mechanisms

### ⚙️ CoreAgent - Code Execution Engine

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

### 📡 MessageObserver - Streaming Message Processing

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

## 🛠️ Tool Suite

Nexent provides a rich tool ecosystem supporting multiple types of task processing. All tools follow unified development standards to ensure consistency and extensibility.

For detailed tool development standards and comprehensive tool documentation, please refer to: **[Tool Development Guide](./core/tools)**

## 📊 Data Processing Service

Enterprise-grade document processing service providing distributed processing capabilities with support for 20+ document formats, intelligent chunking strategies, and memory optimization.

For detailed data processing capabilities and usage examples, please refer to: **[Data Processing Guide](./data-process)**

## 🔍 Vector Database Service

Provides enterprise-grade vector search and document management services with multiple search modes, embedding model integration, and large-scale optimization.

For comprehensive vector database integration and configuration, please refer to: **[Vector Database Guide](./vector-database)**

## 🤖 Model Services

Provides unified multi-modal AI model services with support for various model types and providers.

For comprehensive model integration and usage documentation, please refer to: **[Model Architecture Guide](./core/models)**

For more detailed usage instructions, please refer to the dedicated documentation for each module. 