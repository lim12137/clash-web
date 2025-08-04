# Nexent 项目结构说明

## 项目概述

Nexent 是一个基于AI代理的智能对话系统，采用前后端分离架构，支持多租户、多语言、流式响应等企业级特性。

## 整体架构

```
nexent/
├── frontend/          # 前端应用 (Next.js + TypeScript)
├── backend/           # 后端服务 (FastAPI + Python)
├── sdk/              # Python SDK
├── docker/           # Docker 部署配置
├── make/             # 构建脚本
├── test/             # 测试代码
└── assets/           # 静态资源
```

## 详细目录结构

### 🎨 Frontend (前端层)

```
frontend/
├── app/                          # Next.js App Router
│   └── [locale]/                 # 国际化路由 (zh/en)
│       ├── chat/                 # 聊天界面
│       │   ├── internal/         # 聊天核心逻辑
│       │   ├── layout/           # 聊天界面布局组件
│       │   └── streaming/        # 流式响应处理
│       ├── setup/                # 系统设置页面
│       │   ├── agentSetup/       # 代理配置
│       │   ├── knowledgeBaseSetup/ # 知识库配置
│       │   └── modelSetup/       # 模型配置
│       └── layout.tsx            # 全局布局
├── components/                    # 可复用UI组件
│   ├── providers/                # 上下文提供者
│   └── ui/                       # 基础UI组件库
├── services/                     # API服务层
│   ├── api.ts                    # API基础配置
│   ├── conversationService.ts    # 对话服务
│   ├── agentConfigService.ts     # 代理配置服务
│   ├── knowledgeBaseService.ts   # 知识库服务
│   └── modelService.ts           # 模型服务
├── hooks/                        # 自定义React Hooks
├── lib/                          # 工具库
├── types/                        # TypeScript类型定义
├── public/                       # 静态资源
│   └── locales/                  # 国际化文件
└── middleware.ts                 # Next.js中间件
```

**职责说明：**
- **展示层**：用户界面和交互逻辑
- **服务层**：封装API调用，处理数据转换
- **状态管理**：使用React Hooks管理组件状态
- **国际化**：支持中英文切换
- **路由管理**：基于Next.js App Router

### 🔧 Backend (后端层)

```
backend/
├── apps/                         # API应用层
│   ├── base_app.py              # FastAPI主应用
│   ├── agent_app.py             # 代理相关API
│   ├── conversation_management_app.py # 对话管理API
│   ├── file_management_app.py   # 文件管理API
│   ├── knowledge_app.py         # 知识库API
│   ├── model_managment_app.py   # 模型管理API
│   ├── config_sync_app.py       # 配置同步API
│   └── voice_app.py             # 语音相关API
├── services/                     # 业务服务层
│   ├── agent_service.py         # 代理业务逻辑
│   ├── conversation_management_service.py # 对话管理
│   ├── elasticsearch_service.py # 搜索引擎服务
│   ├── model_health_service.py  # 模型健康检查
│   ├── prompt_service.py        # 提示词服务
│   └── tenant_config_service.py # 租户配置服务
├── database/                     # 数据访问层
│   ├── client.py                # 数据库连接
│   ├── db_models.py             # 数据库模型
│   ├── agent_db.py              # 代理数据操作
│   ├── conversation_db.py       # 对话数据操作
│   ├── knowledge_db.py          # 知识库数据操作
│   └── tenant_config_db.py      # 租户配置数据操作
├── agents/                       # 代理核心逻辑
│   ├── agent_run_manager.py     # 代理运行管理器
│   ├── create_agent_info.py     # 代理信息创建
│   └── default_agents/          # 默认代理配置
├── data_process/                 # 数据处理模块
│   ├── app.py                   # 数据处理应用
│   ├── config.py                # 数据处理配置
│   ├── tasks.py                 # 数据处理任务
│   ├── worker.py                # 数据处理工作器
│   └── utils.py                 # 数据处理工具
├── utils/                        # 工具类
│   ├── auth_utils.py            # 认证工具
│   ├── config_utils.py          # 配置工具
│   ├── file_management_utils.py # 文件管理工具
│   ├── logging_utils.py         # 日志工具
│   └── thread_utils.py          # 线程工具
├── consts/                       # 常量定义
│   ├── const.py                 # 系统常量
│   └── model.py                 # 数据模型
├── prompts/                      # 提示词模板
│   ├── knowledge_summary_agent.yaml # 知识库摘要代理
│   ├── manager_system_prompt_template.yaml # 管理器系统提示词
│   └── utils/                   # 提示词工具
├── sql/                         # SQL脚本
├── assets/                      # 后端资源文件
├── main_service.py              # 主服务入口
├── data_process_service.py      # 数据处理服务入口
└── requirements.txt             # Python依赖
```

**职责说明：**
- **应用层 (apps)**：API路由定义，请求参数验证，响应格式化
- **服务层 (services)**：核心业务逻辑，数据处理，外部服务调用
- **数据层 (database)**：数据库操作，ORM模型，数据访问接口
- **代理层 (agents)**：AI代理核心逻辑，工具调用，推理执行
- **工具层 (utils)**：通用工具函数，配置管理，日志记录

### 📦 SDK (开发工具包)

```
sdk/
└── nexent/
    ├── core/                     # 核心功能
    │   ├── agents/              # 代理核心
    │   │   ├── core_agent.py    # 基础代理类
    │   │   ├── nexent_agent.py  # Nexent代理实现
    │   │   └── run_agent.py     # 代理运行器
    │   ├── models/              # 模型接口
    │   │   ├── openai_llm.py    # OpenAI LLM
    │   │   ├── embedding_model.py # 嵌入模型
    │   │   ├── stt_model.py     # 语音转文字
    │   │   └── tts_model.py     # 文字转语音
    │   ├── tools/               # 工具集合
    │   │   ├── knowledge_base_search_tool.py # 知识库搜索
    │   │   ├── search_tool.py   # 通用搜索
    │   │   └── summary_tool.py  # 摘要工具
    │   ├── nlp/                 # NLP工具
    │   └── utils/               # SDK工具
    ├── data_process/            # 数据处理
    │   ├── core.py              # 数据处理核心
    │   └── excel_process.py     # Excel处理
    └── vector_database/         # 向量数据库
        ├── elasticsearch_core.py # ES核心接口
        └── utils.py             # 向量数据库工具
```

**职责说明：**
- **核心功能**：提供AI代理、模型调用、工具集成的核心接口
- **数据处理**：文件处理、数据清洗、格式转换
- **向量数据库**：向量存储、相似度搜索、索引管理

### 🐳 Docker (容器化)

```
docker/
├── docker-compose.yml           # 开发环境配置
├── docker-compose.prod.yml      # 生产环境配置
├── docker-compose.dev.yml       # 开发环境配置
├── deploy.sh                    # 部署脚本
├── uninstall.sh                 # 卸载脚本
├── init.sql                     # 数据库初始化
└── sql/                         # 数据库迁移脚本
```

**职责说明：**
- **环境配置**：开发、测试、生产环境配置
- **服务编排**：多服务容器编排
- **部署脚本**：自动化部署和运维

### 🧪 Test (测试)

```
test/
├── backend/                     # 后端测试
│   └── services/               # 服务层测试
├── sdk/                        # SDK测试
├── run_all_tests.py            # 测试运行器
└── workflow_test.py            # 工作流测试
```

**职责说明：**
- **单元测试**：各模块功能测试
- **集成测试**：服务间集成测试
- **端到端测试**：完整流程测试

## 数据流架构

### 1. 用户请求流程
```
用户输入 → 前端验证 → API调用 → 后端路由 → 业务服务 → 数据访问 → 数据库
```

### 2. AI Agent执行流程
```
用户消息 → Agent创建 → 工具调用 → 模型推理 → 流式响应 → 结果保存
```

### 3. 知识库文件处理流程
```
文件上传 → 临时存储 → 数据处理 → 向量化 → 知识库存储 → 索引更新
```

### 4. 实时文件处理流程
```
文件上传 → 临时存储 → 数据处理 → Agent → 回答
```

## 技术栈

### 前端技术栈
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **UI库**: React + Tailwind CSS
- **状态管理**: React Hooks
- **国际化**: react-i18next
- **HTTP客户端**: Fetch API

### 后端技术栈
- **框架**: FastAPI
- **语言**: Python 3.10+
- **数据库**: PostgreSQL + Redis + Elasticsearch
- **文件存储**: MinIO
- **任务队列**: Celery + Ray
- **AI框架**: smolagents
- **向量数据库**: Elasticsearch

### 部署技术栈
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx
- **监控**: 内置健康检查
- **日志**: 结构化日志

---

## 开发指南 🛠️

### 环境搭建与运行 🚀

1. **安装 Python 依赖包：**
   ```bash
   cd backend
   uv sync && uv pip install -e ../sdk
   ```
2. **启动后端服务：**
   Nexent 包含三个核心后端服务，需要分别启动：
   ```bash
   python backend/data_process_service.py   # 数据处理服务
   python backend/main_service.py           # 主服务
   python backend/nexent_mcp_service.py     # MCP 服务
   ```
3. **启动前端服务：**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

### 自定义工具开发 🛠️

Nexent 基于 [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/python-sdk) 实现工具系统。
开发新工具：
1. 在 `backend/mcp_service/local_mcp_service.py` 实现逻辑
2. 用 `@mcp.tool()` 装饰器注册
3. 重启 MCP 服务

示例：
```python
@mcp.tool(name="my_tool", description="我的自定义工具")
def my_tool(param1: str, param2: int) -> str:
    # 实现工具逻辑
    return f"处理结果: {param1} {param2}"
```

---

### 自定义智能体开发 🤖

- **系统提示词模板：** 见 `backend/prompts/`
- **智能体实现：**
  1. 创建智能体实例：
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
         system_prompt="你的系统提示词"
     )
     ```
  2. 通过 `tools` 参数添加自定义工具，通过 `system_prompt` 设置行为，并可配置 `max_steps`、`temperature` 等参数。

---

### 构建与 Docker 指南 🏗️🐳

#### 构建并推送镜像
```bash
# 多架构构建并推送（需先登录 Docker Hub）
docker buildx create --name nexent_builder --use
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t nexent/nexent -f make/main/Dockerfile . --push
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t nexent/nexent-data-process -f make/data_process/Dockerfile . --push
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t nexent/nexent-web -f make/web/Dockerfile . --push
```
#### 本地开发构建
```bash
# 构建本地架构镜像
docker build --progress=plain -t nexent/nexent -f make/main/Dockerfile .
docker build --progress=plain -t nexent/nexent-data-process -f make/data_process/Dockerfile .
docker build --progress=plain -t nexent/nexent-web -f make/web/Dockerfile .
```
#### Docker 资源清理
```bash
docker builder prune -f && docker system prune -f
```
- 用 `--platform linux/amd64,linux/arm64` 进行多架构构建
- `--push` 推送到 Docker Hub
- `--load` 仅单架构构建时本地加载
- 用 `docker images` 查看镜像
- 用 `--progress=plain` 查看详细日志
- 添加 `build-arg MIRROR=...` 设置 pip 镜像下载地址

---

### 注意事项 ⚠️
1. 确保所有服务都已启动后再测试
2. 修改代码后需重启相关服务
3. 开发环境建议用调试模式
4. 工具开发需遵循 MCP 协议
5. 系统提示词需充分测试

### 获取帮助 💬
- 查看 [我们的文档](https://modelengine-group.github.io/nexent/zh/getting-started/overview)
- 加入 [Discord 社区](https://discord.gg/tb5H3S3wyv)
- 提交 [GitHub Issues](https://github.com/ModelEngine-Group/nexent/issues)
