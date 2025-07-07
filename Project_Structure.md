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

## Development Guide

### Environment Requirements
- Node.js 18+
- Python 3.9+
- Docker & Docker Compose
- PostgreSQL 13+
- Redis 6+
- Elasticsearch 7+

### Quick Start
1. Clone the project
2. Configure environment variables
3. Start Docker services
4. Run database migrations
5. Start frontend and backend services

### Development Standards
- Follow RESTful API design principles
- Use TypeScript for type-safe development
- Follow Python PEP8 coding standards
- Write unit and integration tests
- Use Git Flow workflow

## Extension Development

### Add a New Tool
1. Create the tool class in `sdk/nexent/core/tools/`
2. Configure the tool in `backend/agents/default_agents/`
3. Update the frontend tool configuration interface

### Add a New Model
1. Implement the model interface in `sdk/nexent/core/models/`
2. Add the model service in `backend/services/`
3. Update the model configuration management

### Add a New API
1. Create the API route in `backend/apps/`
2. Implement business logic in `backend/services/`
3. Add data operations in `backend/database/`
4. Update frontend service calls

## FAQ

### Q: How to add a new knowledge base?
A: Upload documents via the file management API. The system will automatically process and store them in Elasticsearch.

### Q: How to configure a new AI model?
A: Add the model configuration in the model management interface, including API keys, endpoints, etc.

### Q: How to customize agent behavior?
A: Modify system prompts, tool configurations, and other parameters via the agent configuration interface.

### Q: How to extend system functionality?
A: Refer to the SDK documentation to implement custom tools and model interfaces.

## Contribution Guide

1. Fork the project
2. Create a feature branch
3. Commit code changes
4. Create a Pull Request
5. Wait for code review

## License

This project uses the MIT License. See the LICENSE file for details. 