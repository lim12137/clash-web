# Installation & Setup

## 🎯 Prerequisites

| Resource | Minimum |
|----------|---------|
| **CPU**  | 2 cores |
| **RAM**  | 6 GiB   |
| **Architecture** | x86_64 / ARM64 |
| **Software** | Docker & Docker Compose installed |

## 🚀 Quick Start

### 1. Download and Setup

```bash
git clone https://github.com/ModelEngine-Group/nexent.git
cd nexent/docker
cp .env.example .env # Configure environment variables
```

### 2. Deployment Options

The deployment script offers multiple modes:

```bash
bash deploy.sh
```

**Available deployment modes:**
- **Development mode (default)**: Exposes all service ports for debugging
- **Infrastructure mode**: Only starts infrastructure services
- **Production mode**: Only exposes port 3000 for security
- **Beta mode**: Uses development branch images

**Optional components:**
- **Terminal Tool**: Enables openssh-server for AI agent shell command execution
- **Regional optimization**: Mainland China users can use optimized image sources

### 3. Access Your Installation

When deployment completes successfully:
1. Open **http://localhost:3000** in your browser
2. Follow the setup wizard for initial configuration
3. Configure your model providers (see [Model Providers Guide](./model-providers))

## 🤖 Model Configuration

Nexent supports all **OpenAI-compatible models**, including:
- **Large Language Models (LLM)**: Any OpenAI-compatible API provider
- **Multimodal Vision Models**: Text + image processing capabilities  
- **Embedding Models**: All OpenAI-compatible embedding services
- **Text-to-Speech & Speech-to-Text**: Multiple provider support
- **Search Integration**: Web search and semantic retrieval

### Quick Provider Setup

For detailed setup instructions and API key acquisition, see our **[Model Providers Guide](./model-providers)**.

**Recommended for Quick Start**:
- **LLM**: [Silicon Flow](https://siliconflow.cn/) (Free tier available)
- **Embedding**: [Jina AI](https://jina.ai/) (Free tier available)
- **Search**: [EXA](https://exa.ai/) (Free tier available)

### Configuration Methods

**Method 1: Web Interface**
1. Access model configuration at `http://localhost:3000`
2. Add provider details: Base URL, API Key, Model Name

**Method 2: Environment Variables**
Add to your `.env` file:
```bash
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_API_KEY=your_api_key
EMBEDDING_API_KEY=your_jina_key
EXA_API_KEY=your_exa_key
```

## 🏗️ Service Architecture

The deployment includes the following components:

**Core Services:**
- `nexent`: Backend service (port 5010)
- `nexent-web`: Frontend interface (port 3000)
- `nexent-data-process`: Data processing service (port 5012)

**Infrastructure Services:**
- `nexent-postgresql`: Database (port 5434)
- `nexent-elasticsearch`: Search engine (port 9210)
- `nexent-minio`: Object storage (port 9010, console 9011)
- `redis`: Cache service (port 6379)

**Optional Services:**
- `nexent-openssh-server`: SSH server for Terminal tool (port 2222)

## 🔌 Port Mapping

| Service | Internal Port | External Port | Description |
|---------|---------------|---------------|-------------|
| Web Interface | 3000 | 3000 | Main application access |
| Backend API | 5010 | 5010 | Backend service |
| Data Processing | 5012 | 5012 | Data processing API |
| PostgreSQL | 5432 | 5434 | Database connection |
| Elasticsearch | 9200 | 9210 | Search engine API |
| MinIO API | 9000 | 9010 | Object storage API |
| MinIO Console | 9001 | 9011 | Storage management UI |
| Redis | 6379 | 6379 | Cache service |
| SSH Server | 2222 | 2222 | Terminal tool access |

For complete port mapping details, see our [Dev Container Guide](../deployment/devcontainer.md#port-mapping).

## 💡 Need Help

- Browse the [FAQ](./faq) for common install issues
- Drop questions in our [Discord community](https://discord.gg/tb5H3S3wyv)
- File bugs or feature ideas in [GitHub Issues](https://github.com/ModelEngine-Group/nexent/issues)

## 🔧 Build from Source

Want to build from source or add new features? Check the [Docker Build Guide](../deployment/docker-build) for step-by-step instructions.

For detailed setup instructions and customization options, see our [Development Guide](./development-guide).