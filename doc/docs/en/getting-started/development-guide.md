# Nexent Development Guide

## Project Overview

Nexent is an AI agent-based intelligent conversation system with a frontend-backend separation architecture, supporting enterprise-level features like multi-tenancy, multi-language, and streaming responses.

## Overall Architecture

```
nexent/
├── frontend/          # Frontend application (Next.js + TypeScript)
├── backend/           # Backend services (FastAPI + Python)
├── sdk/              # Python SDK
├── docker/           # Docker deployment configuration
├── make/             # Build scripts
├── test/             # Test code
└── assets/           # Static resources
```

## Architecture Module Overview

### 🎨 Frontend Development
- **Tech Stack**: Next.js 14 + TypeScript + React + Tailwind CSS
- **Core Features**: User interface, real-time chat, configuration management, internationalization
- **Details**: See [Frontend Overview](../frontend/overview.md)

### 🔧 Backend Development
- **Tech Stack**: FastAPI + Python 3.10+ + PostgreSQL + Redis + Elasticsearch
- **Core Features**: API services, agent management, data processing, vector search
- **Details**: See [Backend Overview](../backend/overview.md)

### 🤖 AI Agents
- **Framework**: Enterprise agent framework based on smolagents
- **Core Features**: Agent creation, tool integration, reasoning execution, multi-modal support
- **Details**: See [Agent Overview](../agents/overview.md)

### 📦 SDK Development Kit
- **Features**: Complete interfaces for AI agents, model calling, tool integration
- **Modules**: Core agents, data processing, vector database
- **Details**: See [SDK Overview](../sdk/overview.md)

## Technology Stack

### Frontend Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Library**: React + Tailwind CSS
- **State Management**: React Hooks
- **Internationalization**: react-i18next
- **HTTP Client**: Fetch API

### Backend Tech Stack
- **Framework**: FastAPI
- **Language**: Python 3.10+
- **Database**: PostgreSQL + Redis + Elasticsearch
- **File Storage**: MinIO
- **Task Queue**: Celery + Ray
- **AI Framework**: smolagents
- **Vector Database**: Elasticsearch

### Deployment Tech Stack
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Monitoring**: Built-in health checks
- **Logging**: Structured logging

## Development Environment Setup 🚀

### 1. Environment Requirements
- Python 3.10+
- Node.js 18+
- Docker & Docker Compose
- uv (Python package manager)

### 2. Backend Setup
```bash
cd backend
uv sync && uv pip install -e ../sdk
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Service Startup
Nexent includes three core backend services that need to be started separately:
```bash
python backend/data_process_service.py   # Data processing service
python backend/main_service.py           # Main service
python backend/nexent_mcp_service.py     # MCP service
```

## Development Module Guide

### Agent Development 🤖
- **Custom Agents**: See [Agent Overview](../agents/overview.md)
- **System Prompts**: Located in `backend/prompts/`
- **Implementation Steps**: Create instance → Configure tools → Set prompts → Test run

### Tool Development 🛠️
- **MCP Tool System**: Based on Model Context Protocol
- **Development Flow**: Implement logic → Register tool → Restart service
- **Detailed Specification**: See [Tool Development Guide](../sdk/core/tools.md)

### Data Processing 📊
- **File Processing**: Supports 20+ formats
- **Chunking Strategies**: basic, by_title, none
- **Streaming Processing**: Memory optimization for large files
- **Details**: See [Data Processing Guide](../sdk/data-process.md)

## Build & Deployment 🏗️

### Docker Build
For detailed build instructions, see [Docker Build Guide](../deployment/docker-build.md)

## Development Best Practices

### Code Quality
1. **Test-Driven**: Write unit tests and integration tests
2. **Code Review**: Follow team coding standards
3. **Documentation**: Update related documentation timely
4. **Error Handling**: Comprehensive exception handling and logging

### Performance Optimization
1. **Async Processing**: Use async architecture for performance
2. **Caching Strategy**: Proper use of caching mechanisms
3. **Resource Management**: Pay attention to memory and connection pool management
4. **Monitoring & Debugging**: Use performance monitoring tools

### Security Considerations
1. **Input Validation**: Strictly validate all input parameters
2. **Access Control**: Implement appropriate access controls
3. **Sensitive Information**: Properly handle sensitive data like API keys
4. **Security Updates**: Regular dependency and security updates

## Important Notes ⚠️

1. **Service Dependencies**: Ensure all services are started before testing
2. **Code Changes**: Restart related services after code modifications
3. **Development Mode**: Use debug mode in development environment
4. **Protocol Compliance**: Tool development must follow MCP protocol
5. **Prompt Testing**: System prompts need thorough testing

## Getting Help 💬

### Documentation Resources
- [Installation Guide](./installation.md) - Environment setup and deployment
- [Model Providers](./model-providers.md) - Model configuration and API acquisition
- [FAQ](../faq.md) - Frequently asked questions

### Community Support
- [Discord Community](https://discord.gg/tb5H3S3wyv) - Real-time communication and support
- [GitHub Issues](https://github.com/ModelEngine-Group/nexent/issues) - Issue reporting and feature requests
- [Contributing Guide](../contributing.md) - Participate in project development