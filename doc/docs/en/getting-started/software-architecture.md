# Software Architecture

Nexent adopts a modern distributed microservices architecture designed to provide high-performance, scalable AI agent platform. The entire system is based on containerized deployment, supporting cloud-native and enterprise-grade application scenarios.

![Software Architecture Diagram](../../assets/architecture_en.png)

## 🏗️ Overall Architecture Design

Nexent's software architecture follows layered design principles, structured into the following core layers from top to bottom:

### 🌐 Frontend Layer
- **Technology Stack**: Next.js + React + TypeScript
- **Functions**: User interface, agent interaction, multimodal input processing
- **Features**: Responsive design, real-time communication, internationalization support

### 🔌 API Gateway Layer
- **Core Service**: FastAPI high-performance web framework
- **Responsibilities**: Request routing, authentication, API version management, load balancing
- **Ports**: 5010 (main service), 5012 (data processing service)

### 🧠 Business Logic Layer
- **Agent Management**: Agent generation, execution, monitoring
- **Conversation Management**: Multi-turn dialogue, context maintenance, history tracking
- **Knowledge Base Management**: Document processing, vectorization, retrieval
- **Model Management**: Multi-model support, health checks, load balancing

### 📊 Data Layer
Distributed data storage architecture with multiple specialized databases:

#### 🗄️ Structured Data Storage
- **PostgreSQL**: Primary database storing user information, agent configurations, conversation records
- **Port**: 5434
- **Features**: ACID transactions, relational data integrity

#### 🔍 Search Engine
- **Elasticsearch**: Vector database and full-text search engine
- **Port**: 9210
- **Functions**: Vector similarity search, hybrid search, large-scale optimization

#### 💾 Cache Layer
- **Redis**: High-performance in-memory database
- **Port**: 6379
- **Usage**: Session caching, temporary data, distributed locks

#### 📁 Object Storage
- **MinIO**: Distributed object storage service
- **Port**: 9010
- **Functions**: File storage, multimedia resource management, large file processing

## 🔧 Core Service Architecture

### 🤖 Agent Services
```
Agent framework based on SmolAgents, providing:
├── Agent generation and configuration
├── Tool calling and integration
├── Reasoning and decision execution
└── Lifecycle management
```

### 📈 Data Processing Services
```
Distributed data processing architecture:
├── Real-time document processing (20+ format support)
├── Batch data processing pipelines
├── OCR and table structure extraction
└── Vectorization and index construction
```

### 🌐 MCP Ecosystem
```
Model Context Protocol tool integration:
├── Standardized tool interfaces
├── Plugin architecture
├── Third-party service integration
└── Custom tool development
```

## 🚀 Distributed Architecture Features

### ⚡ Asynchronous Processing Architecture
- **Foundation Framework**: High-performance async processing based on asyncio
- **Concurrency Control**: Thread-safe concurrent processing mechanisms
- **Task Queue**: Celery + Ray distributed task execution
- **Stream Processing**: Real-time data and response streaming

### 🔄 Microservices Design
```
Service decomposition strategy:
├── nexent (main service) - Agent core logic
├── nexent-data-process (data processing) - Document processing pipeline
├── nexent-mcp-service (MCP service) - Tool protocol service
└── Optional services (SSH, monitoring, etc.)
```

### 🌍 Containerized Deployment
```
Docker Compose service orchestration:
├── Application service containerization
├── Database service isolation
├── Network layer security configuration
└── Volume mounting for data persistence
```

## 🔐 Security and Scalability

### 🛡️ Security Architecture
- **Authentication**: Multi-tenant support, user permission management
- **Data Security**: End-to-end encryption, secure transmission protocols
- **Network Security**: Inter-service secure communication, firewall configuration

### 📈 Scalability Design
- **Horizontal Scaling**: Independent microservice scaling, load balancing
- **Vertical Scaling**: Resource pool management, intelligent scheduling
- **Storage Scaling**: Distributed storage, data sharding

### 🔧 Modular Architecture
- **Loose Coupling Design**: Low inter-service dependencies, standardized interfaces
- **Plugin Architecture**: Hot-swappable tools and models
- **Configuration Management**: Environment isolation, dynamic configuration updates

## 🔄 Data Flow Architecture

### 📥 User Request Flow
```
User Input → Frontend Validation → API Gateway → Route Distribution → Business Service → Data Access → Database
```

### 🤖 Agent Execution Flow
```
User Message → Agent Creation → Tool Calling → Model Inference → Streaming Response → Result Storage
```

### 📚 Knowledge Base Processing Flow
```
File Upload → Temporary Storage → Data Processing → Vectorization → Knowledge Base Storage → Index Update
```

### ⚡ Real-time Processing Flow
```
Real-time Input → Instant Processing → Agent Response → Streaming Output
```

## 🎯 Architecture Advantages

### 🏢 Enterprise-grade Features
- **High Availability**: Multi-layer redundancy, failover capabilities
- **High Performance**: Asynchronous processing, intelligent caching
- **High Concurrency**: Distributed architecture, load balancing
- **Monitoring Friendly**: Comprehensive logging and status monitoring

### 🔧 Developer Friendly
- **Modular Development**: Clear hierarchical structure
- **Standardized Interfaces**: Unified API design
- **Flexible Configuration**: Environment adaptation, feature toggles
- **Easy Testing**: Unit testing and integration testing support

### 🌱 Ecosystem Compatibility
- **MCP Standard**: Compliant with Model Context Protocol
- **Open Source Ecosystem**: Integration with rich open source tools
- **Cloud Native**: Support for Kubernetes and Docker deployment
- **Multi-model Support**: Compatible with mainstream AI model providers

---

This architectural design ensures that Nexent can provide a stable, scalable AI agent service platform while maintaining high performance. Whether for individual users or enterprise-level deployments, it delivers excellent user experience and technical assurance.