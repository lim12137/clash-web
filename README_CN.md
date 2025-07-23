![Nexent Banner](./assets/NexentBanner.png)

[![English](https://img.shields.io/badge/English-README-blue)](README.md)
[![中文](https://img.shields.io/badge/中文-README-green)](README_CN.md)
[![codecov](https://codecov.io/gh/ModelEngine-Group/nexent-commercial/branch/develop/graph/badge.svg?token=G6FRRL2M04)](https://codecov.io/gh/ModelEngine-Group/nexent-commercial?branch=develop)

Nexent 是一个零代码智能体自动生成平台 —— 无需编排，无需复杂的拖拉拽操作，使用纯语言开发你想要的任何智能体。基于MCP生态，具备丰富的工具集成，同时提供多种自带智能体，满足你的工作、旅行、生活等不同场景的智能服务需要。Nexent 还提供强大的智能体运行控制、多智能体协作、数据处理和知识溯源、多模态对话、批量扩展能力。

> 一个提示词，无限种可能。

### 🌟 立即体验 Nexent

- 🌐 访问我们的[官方网站](http://nexent.tech/)了解更多信息
- 🚀 [一键试用](http://nexent.tech/try)体验 Nexent 的强大功能

https://github.com/user-attachments/assets/b844e05d-5277-4509-9463-1c5b3516f11e

# 🤝 加入我们的社区

> *If you want to go fast, go alone; if you want to go far, go together.*

我们已经发布了 **Nexent v1**，目前功能已经相对稳定，但仍可能存在一些 bug，我们会持续改进并不断增加新功能。敬请期待，我们很快也会公布 **v2.0** 版本！

* **🗺️ 查看我们的 [功能地图](https://github.com/orgs/ModelEngine-Group/projects/6)** 探索当前和即将推出的功能。
* **🔍 试用当前版本** 并在 [问题反馈](https://github.com/ModelEngine-Group/nexent/issues) 中留下想法或报告错误。

> *Rome wasn't built in a day.*

如果我们的愿景与您产生共鸣，请通过 **[贡献指南](CONTRIBUTING_CN.md)** 加入我们，共同塑造 Nexent。

早期贡献者不会被忽视：从特殊徽章和纪念品到其他实质性奖励，我们致力于感谢那些帮助 Nexent 诞生的先驱者。

最重要的是，我们需要关注度。请为仓库点星 ⭐ 并关注，与朋友分享，帮助更多开发者发现 Nexent —— 您的每一次点击都能为项目带来新的参与者，保持发展势头。

# ⚡ 先来试试看

### 1. 📋 系统要求  

| 资源 | 最低要求 |
|----------|---------|
| **CPU**  | 2 核 |
| **内存**  | 6 GiB   |
| **软件** | 已安装 Docker 和 Docker Compose |

### 2. 🛠️ 使用 Docker Compose 快速开始

```bash
git clone https://github.com/ModelEngine-Group/nexent.git
cd nexent/docker
cp .env.example .env # fill only nessasary configs
bash deploy.sh
```

当容器运行后，在浏览器中打开 **http://localhost:3000** 并按照设置向导操作。

### 3. 🤖 模型配置与模型提供商推荐

我们建议使用以下模型提供商：

| 模型类型 | 提供商 | 说明 |
|------------|----------|-------|
| LLM 与 VLLM | [硅基流动](https://siliconflow.cn/) | 提供免费额度 |
| LLM 与 VLLM | [阿里云百炼](https://bailian.console.aliyun.com/) | 提供免费额度 |
| Embedding | [Jina](https://jina.ai/) | 提供免费额度 |
| TTS 与 STT | [火山引擎语音](https://www.volcengine.com/product/voice-tech) | 个人用户免费 |
| 搜索 | [EXA](https://exa.ai/) | 提供免费额度 |

您需要在模型配置页面输入以下信息：
- Base URL
- API Key
- Model Name

以下配置需要添加到您的 `.env` 文件中（我们将尽快把这些配置前端化）：
- TTS 与 STT 相关配置
- EXA 搜索 API Key

> ℹ️ 由于开发紧张，目前我们仅支持 Jina Embedding 模型。其他模型的支持将在未来版本中添加。有关 Jina API 密钥获取，请参阅我们的[常见问题](FAQ_CN.md)。

### 4. ❓ 需要帮助？

- 浏览 [常见问题](FAQ_CN.md) 了解常见安装问题。  
- 在我们的 [Discord 社区](https://discord.gg/tb5H3S3wyv) 中提问。  
- 在 [GitHub Issues](https://github.com/ModelEngine-Group/nexent/issues) 中提交错误报告或功能建议。

### 5. 🔧 开发 Nexent

想要从源代码构建或添加新功能？查看 [贡献指南](CONTRIBUTING_CN.md) 获取分步说明。

### 6. 🛠️ 从源码构建

想要从源码运行 Nexent？查看我们的[开发者指南](DEVELOPPER_NOTE_CN.md)获取详细的设置说明和自定义选项。

## 🌱 MCP 工具生态

Nexent 基于模型上下文协议（MCP）工具生态系统构建，为集成各种工具和服务提供了灵活且可扩展的框架。MCP 被誉为"AI 的 USB-C" - 一个通用接口标准，让 AI 智能体能够无缝连接外部数据源、工具和服务。

### 🌐 MCP 社区中心

全球 MCP 生态系统蓬勃发展，多个平台支持 MCP 开发和部署：

| 平台 | 描述 | 备注 |
|------|------|------|
| **[GitHub MCP Server](https://github.com/github/github-mcp-server)** | 深度集成 Claude、GPT-4、Copilot 等，支持 Go 和 Python | OAuth/GitHub 账户授权 |
| **[Qdrant MCP Vector Server](https://github.com/qdrant/mcp-server-qdrant)** | 语义向量存储，兼容 Python/Go | 与 LangChain 等工具兼容 |
| **[Anthropic Reference MCP Servers](https://github.com/modelcontextprotocol/servers)** | 轻量级教学与原型工具，Python | 包含 fetch、git 等通用工具 |
| **[AWS Labs MCP Server](https://github.com/awslabs/mcp)** | AWS+Go+CDK 云端参考服务 | 适合云环境 |
| **[MCP Hub 中国](https://www.mcp-cn.com/)** | 中国精选优质 MCP 服务平台 | 追求质量而非数量，社区驱动 |
| **[ModelScope MCP 广场](https://modelscope.cn/mcp)** | 中国最大的 MCP 社区，拥有 1,500+ 服务 | 从高德地图到支付宝，全面的服务覆盖 |
| **Community MCP Servers** | 各类场景源码聚集地 | 多为实验和创新工具 |

### 🛠️ 推荐 MCP 工具

| 工具名称 | 功能 | 描述 |
|----------|------|------|
| **[高德地图](https://modelscope.cn/mcp/servers/@amap/amap-maps)** | 地理服务和导航 | 全面的地图、地理编码、路线规划和位置服务 |
| **[必应搜索中文](https://modelscope.cn/mcp/servers/@yan5236/bing-cn-mcp-server)** | 中文网络搜索 | 优化的中文网络搜索和信息检索 |
| **[12306车票查询工具](https://modelscope.cn/mcp/servers/@Joooook/12306-mcp)** | 中国铁路购票 | 实时列车时刻表、票务查询和订票助手 |
| **[支付宝MCP](https://modelscope.cn/mcp/servers/@alipay/mcp-server-alipay)** | 支付和金融服务 | 数字支付、金融工具和服务集成 |
| **[飞常准-Aviation](https://modelscope.cn/mcp/servers/@variflight-ai/variflight-mcp)** | 航班信息和航空数据 | 实时航班跟踪、时刻表和航空分析 |
| **[Sequential Thinking](https://modelscope.cn/mcp/servers/@modelcontextprotocol/sequentialthinking)** | 结构化问题解决框架 | 将复杂问题分解为可管理的连续步骤 |
| **[ArXiv AI搜索服务](https://modelscope.cn/mcp/servers/@blazickjp/arxiv-mcp-server)** | 学术论文搜索和研究 | 科学论文和研究的高级搜索和检索 |
| **[Firecrawl MCP 服务器](https://modelscope.cn/mcp/servers/@mendableai/firecrawl-mcp-server)** | 网页抓取和内容提取 | 智能网页抓取、数据提取和内容处理 |

### 🚀 建议的智能体场景

借助 MCP 强大的生态系统，您可以为各种场景创建复杂的 AI 智能体：

🌍 **旅行规划智能体** 
- 使用高德地图进行路线规划和导航 📍
- 集成 12306 进行火车订票 🚄
- 连接飞常准获取航班信息 ✈️
- 启用支付宝实现无缝支付 💳

🔬 **研究助手智能体**
- 利用 ArXiv 搜索学术论文 📚
- 使用必应搜索进行全面的网络研究 🔍
- 应用 Sequential Thinking 进行结构化分析 🧠
- 集成 Firecrawl 进行网络数据提取 🕷️

💼 **商业智能智能体**
- 通过各种 MCP 服务器连接多个数据源 📊
- 使用地理工具进行基于位置的洞察 🗺️
- 集成支付系统进行财务分析 💰
- 应用结构化思维框架进行决策制定 🎯

🏠 **智能生活智能体**
- 结合地图服务与支付集成 🛒
- 使用交通工具优化通勤 🚗
- 集成网络搜索获取本地推荐 🏪
- 应用智能内容提取进行信息收集 📱

MCP 生态系统让您能够构建可以与现实世界无缝交互的智能体，访问实时数据、执行复杂操作，并在几乎任何领域提供上下文辅助。每个工具都带来了专门的能力，可以组合起来创建强大的、多功能的 AI 体验。

## ✨ 主要特性

`1` **智能体提示词自动生成**  
   将自然语言转化为可被Agent执行的提示词。Nexent可以根据你的需要自动选择正确的工具并为每个请求规划最佳执行路径。

   ![Feature 1](./assets/Feature1.png)

`2` **可扩展数据处理引擎**  
   支持 20+ 数据格式的快速 OCR 和表格结构提取，从单进程到大规模批处理管道都能平滑扩展。

   ![Feature 2](./assets/Feature2.png)

`3` **个人级知识库**  
   实时导入文件，自动总结，让智能体能够即时访问个人和全局知识，并了解每个知识库能提供什么。

   ![Feature 3](./assets/Feature3.png)

`4` **互联网知识搜索**  
   连接 5+ 个网络搜索提供商，让智能体能够将最新的互联网信息与您的私有数据结合。

   ![Feature 4](./assets/Feature4.png)

`5` **知识级可追溯性**  
   提供来自网络和知识库来源的精确引用，使每个事实都可验证。

   ![Feature 5](./assets/Feature5.png)

`6` **多模态理解与对话**  
   说话、打字、文件或展示图片。Nexent 理解语音、文本和图片，甚至可以根据需求生成新图像。

   ![Feature 6](./assets/Feature6.png)

`7` **MCP 工具生态系统**  
   插入或构建符合 MCP 规范的 Python 插件；无需修改核心代码即可更换模型、工具和链。

   ![Feature 7](./assets/Feature7.png)

# 🐛 已知问题

1📝 **代码类输出可能被误认为可执行**  
   Nexent对话时如果模型输出代码类的文本，可能会被错误理解为需要被执行，我们会尽快修复。



# 💬 社区与联系方式

加入我们的 [Discord 社区](https://discord.gg/tb5H3S3wyv) 与其他开发者交流并获取帮助！

# 📄 许可证

Nexent 采用 [MIT](LICENSE) 许可证，并附有额外条件。请阅读 [LICENSE](LICENSE) 文件了解详情。
