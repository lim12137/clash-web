# Nexent Project Structure Description

## Project Overview

Nexent is an AI agent-based intelligent dialogue system, adopting a frontend-backend separated architecture. It supports multi-tenancy, multi-language, streaming responses, and other enterprise-level features.

## Overall Architecture

```
nexent/
├── frontend/          # Frontend application (Next.js + TypeScript)
├── backend/           # Backend services (FastAPI + Python)
├── sdk/               # Python SDK
├── docker/            # Docker deployment configuration
├── make/              # Build scripts
├── test/              # Test code
└── assets/            # Static resources
```

## Detailed Directory Structure

### 🎨 Frontend (Presentation Layer)

```
frontend/
├── app/                          # Next.js App Router
│   └── [locale]/                 # Internationalization routes (zh/en)
│       ├── chat/                 # Chat interface
│       │   ├── internal/         # Core chat logic
│       │   ├── layout/           # Chat layout components
│       │   └── streaming/        # Streaming response handling
│       ├── setup/                # System settings pages
│       │   ├── agentSetup/       # Agent configuration
│       │   ├── knowledgeBaseSetup/ # Knowledge base configuration
│       │   └── modelSetup/       # Model configuration
│       └── layout.tsx            # Global layout
├── components/                   # Reusable UI components
│   ├── providers/                # Context providers
│   └── ui/                       # Basic UI component library
├── services/                     # API service layer
│   ├── api.ts                    # API base configuration
│   ├── conversationService.ts    # Conversation service
│   ├── agentConfigService.ts     # Agent configuration service
│   ├── knowledgeBaseService.ts   # Knowledge base service
│   └── modelService.ts           # Model service
├── hooks/                        # Custom React Hooks
├── lib/                          # Utility library
├── types/                        # TypeScript type definitions
├── public/                       # Static resources
│   └── locales/                  # Internationalization files
└── middleware.ts                 # Next.js middleware
```

**Responsibilities:**
- **Presentation Layer:** User interface and interaction logic
- **Service Layer:** Encapsulate API calls, handle data transformation
- **State Management:** Use React Hooks to manage component state
- **Internationalization:** Support for Chinese and English switching
- **Routing Management:** Based on Next.js App Router

### 🔧 Backend (Service Layer)

```
backend/
├── apps/                         # API application layer
│   ├── base_app.py               # FastAPI main application
│   ├── agent_app.py              # Agent-related APIs
│   ├── conversation_management_app.py # Conversation management APIs
│   ├── file_management_app.py    # File management APIs
│   ├── knowledge_app.py          # Knowledge base APIs
│   ├── model_managment_app.py    # Model management APIs
│   ├── config_sync_app.py        # Configuration sync APIs
│   └── voice_app.py              # Voice-related APIs
├── services/                     # Business service layer
│   ├── agent_service.py          # Agent business logic
│   ├── conversation_management_service.py # Conversation management
│   ├── elasticsearch_service.py  # Search engine service
│   ├── model_health_service.py   # Model health check
│   ├── prompt_service.py         # Prompt service
│   └── tenant_config_service.py  # Tenant configuration service
├── database/                     # Data access layer
│   ├── client.py                 # Database connection
│   ├── db_models.py              # Database models
│   ├── agent_db.py               # Agent data operations
│   ├── conversation_db.py        # Conversation data operations
│   ├── knowledge_db.py           # Knowledge base data operations
│   └── tenant_config_db.py       # Tenant configuration data operations
├── agents/                       # Agent core logic
│   ├── agent_run_manager.py      # Agent run manager
│   ├── create_agent_info.py      # Agent info creation
│   └── default_agents/           # Default agent configuration
├── data_process/                 # Data processing module
│   ├── app.py                    # Data processing application
│   ├── config.py                 # Data processing configuration
│   ├── tasks.py                  # Data processing tasks
│   ├── worker.py                 # Data processing worker
│   └── utils.py                  # Data processing utilities
├── utils/                        # Utility classes
│   ├── auth_utils.py             # Authentication utilities
│   ├── config_utils.py           # Configuration utilities
│   ├── file_management_utils.py  # File management utilities
│   ├── logging_utils.py          # Logging utilities
│   └── thread_utils.py           # Thread utilities
├── consts/                       # Constant definitions
│   ├── const.py                  # System constants
│   └── model.py                  # Data models
├── prompts/                      # Prompt templates
│   ├── knowledge_summary_agent.yaml # Knowledge base summary agent
│   ├── manager_system_prompt_template.yaml # Manager system prompt
│   └── utils/                    # Prompt utilities
├── sql/                          # SQL scripts
├── assets/                       # Backend resource files
├── main_service.py               # Main service entry
├── data_process_service.py       # Data processing service entry
└── requirements.txt              # Python dependencies
```

**Responsibilities:**
- **Application Layer (apps):** API route definitions, request parameter validation, response formatting
- **Service Layer (services):** Core business logic, data processing, external service calls
- **Data Layer (database):** Database operations, ORM models, data access interfaces
- **Agent Layer (agents):** AI agent core logic, tool invocation, inference execution
- **Utility Layer (utils):** General utility functions, configuration management, logging

### 📦 SDK (Software Development Kit)

```
sdk/
└── nexent/
    ├── core/                     # Core functionality
    │   ├── agents/               # Agent core
    │   │   ├── core_agent.py     # Base agent class
    │   │   ├── nexent_agent.py   # Nexent agent implementation
    │   │   └── run_agent.py      # Agent runner
    │   ├── models/               # Model interfaces
    │   │   ├── openai_llm.py     # OpenAI LLM
    │   │   ├── embedding_model.py # Embedding model
    │   │   ├── stt_model.py      # Speech-to-text
    │   │   └── tts_model.py      # Text-to-speech
    │   ├── tools/                # Tool collection
    │   │   ├── knowledge_base_search_tool.py # Knowledge base search
    │   │   ├── search_tool.py    # General search
    │   │   └── summary_tool.py   # Summary tool
    │   ├── nlp/                  # NLP tools
    │   └── utils/                # SDK utilities
    ├── data_process/             # Data processing
    │   ├── core.py               # Data processing core
    │   └── excel_process.py      # Excel processing
    └── vector_database/          # Vector database
        ├── elasticsearch_core.py # ES core interface
        └── utils.py              # Vector database utilities
```

**Responsibilities:**
- **Core Functionality:** Provide core interfaces for AI agents, model invocation, and tool integration
- **Data Processing:** File processing, data cleansing, format conversion
- **Vector Database:** Vector storage, similarity search, index management

### 🐳 Docker (Containerization)

```
docker/
├── docker-compose.yml           # Development environment configuration
├── docker-compose.prod.yml      # Production environment configuration
├── docker-compose.dev.yml       # Development environment configuration
├── deploy.sh                    # Deployment script
├── uninstall.sh                 # Uninstall script
├── init.sql                     # Database initialization
└── sql/                         # Database migration scripts
```

**Responsibilities:**
- **Environment Configuration:** Development, testing, and production environment setup
- **Service Orchestration:** Multi-service container orchestration
- **Deployment Scripts:** Automated deployment and operations

### 🧪 Test (Testing)

```
test/
├── backend/                     # Backend tests
│   └── services/                # Service layer tests
├── sdk/                         # SDK tests
├── run_all_tests.py             # Test runner
└── workflow_test.py             # Workflow tests
```

**Responsibilities:**
- **Unit Testing:** Module functionality tests
- **Integration Testing:** Service integration tests
- **End-to-End Testing:** Complete workflow tests

## Data Flow Architecture

### 1. User Request Flow
```
User input → Frontend validation → API call → Backend routing → Business service → Data access → Database
```

### 2. AI Agent Execution Flow
```
User message → Agent creation → Tool invocation → Model inference → Streaming response → Result saving
```

### 3. File Processing Flow
```
File upload → Temporary storage → Data processing → Vectorization → Knowledge base storage → Index update
```

## Technology Stack

### Frontend Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **UI Library:** React + Tailwind CSS
- **State Management:** React Hooks
- **Internationalization:** react-i18next
- **HTTP Client:** Fetch API

### Backend Stack
- **Framework:** FastAPI
- **Language:** Python 3.9+
- **Database:** PostgreSQL + Redis + Elasticsearch
- **File Storage:** MinIO
- **Task Queue:** Celery + Ray
- **AI Framework:** smolagents
- **Vector Database:** Elasticsearch

### Deployment Stack
- **Containerization:** Docker + Docker Compose
- **Reverse Proxy:** Nginx
- **Monitoring:** Built-in health checks
- **Logging:** Structured logging

## Development Guide 🛠️

### Environment Setup & Running 🚀

1. **Install Python SDK dependencies:**
   ```bash
   cd backend
   uv sync && uv pip install -e ../sdk
   ```
2. **Start Backend Services:**
   Nexent consists of three core backend services that need to be started separately:
   ```bash
   python backend/data_process_service.py   # Data processing service
   python backend/main_service.py           # Main service
   python backend/nexent_mcp_service.py     # MCP service
   ```
3. **Start Frontend Service:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

### Custom Tool Development 🛠️

Nexent's tool system is based on [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/python-sdk).
To add a new tool:
1. Implement logic in `backend/mcp_service/local_mcp_service.py`
2. Register with `@mcp.tool()`
3. Restart the MCP service

Example:
```python
@mcp.tool(name="my_tool", description="My custom tool")
def my_tool(param1: str, param2: int) -> str:
    # Implement tool logic
    return f"Processing result: {param1} {param2}"
```

---

### Custom Agent Development 🤖

- **System prompt templates:** See `backend/prompts/`
- **Agent implementation:**
  1. Create an agent instance:
     ```python
     from nexent.core.agents import CoreAgent
     from nexent.core.models import OpenAIModel

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
  2. Add custom tools via `tools`, set behavior via `system_prompt`, and configure parameters like `max_steps`, `temperature`, etc.

---

### Build & Docker Guide 🏗️🐳

#### Build and Push Images
```bash
# Multi-architecture build & push
# (login to Docker Hub first)
docker buildx create --name nexent_builder --use
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t nexent/nexent -f make/main/Dockerfile . --push
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t nexent/nexent-data-process -f make/data_process/Dockerfile . --push
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t nexent/nexent-web -f make/web/Dockerfile . --push
```
#### Local Development Build
```bash
# Build images for local architecture
docker build --progress=plain -t nexent/nexent -f make/main/Dockerfile .
docker build --progress=plain -t nexent/nexent-data-process -f make/data_process/Dockerfile .
docker build --progress=plain -t nexent/nexent-web -f make/web/Dockerfile .
```
#### Clean up Docker resources
```bash
docker builder prune -f && docker system prune -f
```
- Use `--platform linux/amd64,linux/arm64` for multi-arch
- `--push` uploads to Docker Hub
- `--load` loads image locally (single arch only)
- Use `docker images` to verify
- Use `--progress=plain` for detailed logs
- Use `--build-arg MIRROR=...` to setup pip mirror

---

### Important Notes ⚠️
1. Ensure all services are started before testing
2. Restart relevant service after code changes
3. Use debug mode in development
4. Follow MCP protocol for tools
5. System prompts need thorough testing

### Getting Help 💬
- Check Our [Documentation](https://modelengine-group.github.io/nexent/en/getting-started/overview)
- Join our [Discord community](https://discord.gg/tb5H3S3wyv)
- Submit [GitHub Issues](https://github.com/ModelEngine-Group/nexent/issues)
