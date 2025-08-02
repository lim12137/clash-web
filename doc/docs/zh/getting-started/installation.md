# 安装与配置

## 🎯 系统要求

| 资源 | 最低要求 |
|----------|---------|
| **CPU**  | 2 核 |
| **内存**  | 6 GiB   |
| **架构** | x86_64 / ARM64 |
| **软件** | 已安装 Docker 和 Docker Compose |

## 🚀 快速开始

### 1. 下载和设置

```bash
git clone https://github.com/ModelEngine-Group/nexent.git
cd nexent/docker
cp .env.example .env # 配置环境变量
```

### 2. 部署选项

部署脚本提供多种模式：

```bash
bash deploy.sh
```

**可用部署模式:**
- **开发模式 (默认)**: 暴露所有服务端口以便调试
- **基础设施模式**: 仅启动基础设施服务
- **生产模式**: 为安全起见仅暴露端口 3000
- **测试模式**: 使用开发分支镜像

**可选组件:**
- **终端工具**: 启用 openssh-server 供 AI 智能体执行 shell 命令
- **区域优化**: 中国大陆用户可使用优化的镜像源

### 3. 访问您的安装

部署成功完成后：
1. 在浏览器中打开 **http://localhost:3000**
2. 按照设置向导进行初始配置
3. 配置您的模型提供商（参见 [模型提供商指南](./model-providers)）

## 🤖 模型配置

Nexent 支持所有 **OpenAI 兼容的模型**，包括：
- **大语言模型 (LLM)**: 任何 OpenAI 兼容的 API 提供商
- **多模态视觉模型**: 文本 + 图像处理能力
- **嵌入模型**: 所有 OpenAI 兼容的嵌入服务
- **文本转语音和语音转文本**: 多提供商支持
- **搜索集成**: 网络搜索和语义检索

### 快速提供商设置

有关详细设置说明和 API 密钥获取，请参阅我们的 **[模型提供商指南](./model-providers)**。

**快速开始推荐**:
- **LLM**: [硅基流动](https://siliconflow.cn/) (有免费额度)
- **嵌入**: [Jina AI](https://jina.ai/) (有免费额度)
- **搜索**: [EXA](https://exa.ai/) (有免费额度)

### 配置方法

**方法一：Web 界面**
1. 访问 `http://localhost:3000` 的模型配置
2. 添加提供商详细信息：Base URL、API Key、Model Name

**方法二：环境变量**
添加到您的 `.env` 文件：
```bash
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_API_KEY=your_api_key
EMBEDDING_API_KEY=your_jina_key
EXA_API_KEY=your_exa_key
```

## 🏗️ 服务架构

部署包含以下组件：

**核心服务:**
- `nexent`: 后端服务 (端口 5010)
- `nexent-web`: 前端界面 (端口 3000)
- `nexent-data-process`: 数据处理服务 (端口 5012)

**基础设施服务:**
- `nexent-postgresql`: 数据库 (端口 5434)
- `nexent-elasticsearch`: 搜索引擎 (端口 9210)
- `nexent-minio`: 对象存储 (端口 9010，控制台 9011)
- `redis`: 缓存服务 (端口 6379)

**可选服务:**
- `nexent-openssh-server`: 终端工具的 SSH 服务器 (端口 2222)

## 🔌 端口映射

| 服务 | 内部端口 | 外部端口 | 描述 |
|---------|---------------|---------------|-------------|
| Web 界面 | 3000 | 3000 | 主应用程序访问 |
| 后端 API | 5010 | 5010 | 后端服务 |
| 数据处理 | 5012 | 5012 | 数据处理 API |
| PostgreSQL | 5432 | 5434 | 数据库连接 |
| Elasticsearch | 9200 | 9210 | 搜索引擎 API |
| MinIO API | 9000 | 9010 | 对象存储 API |
| MinIO 控制台 | 9001 | 9011 | 存储管理 UI |
| Redis | 6379 | 6379 | 缓存服务 |
| SSH 服务器 | 2222 | 2222 | 终端工具访问 |

有关完整的端口映射详细信息，请参阅我们的 [开发容器指南](../deployment/devcontainer.md#port-mapping)。

## 💡 需要帮助

- 浏览 [常见问题](./faq) 了解常见安装问题
- 在我们的 [Discord 社区](https://discord.gg/tb5H3S3wyv) 提问
- 在 [GitHub Issues](https://github.com/ModelEngine-Group/nexent/issues) 提交错误报告或功能建议

## 🔧 从源码构建

想要从源码构建或添加新功能？查看 [Docker 构建指南](../deployment/docker-build) 获取详细说明。

有关详细的安装说明和自定义选项，请查看我们的 [开发指南](./development-guide)。