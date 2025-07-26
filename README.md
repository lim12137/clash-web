![Nexent Banner](./assets/NexentBanner.png)

[![English](https://img.shields.io/badge/English-README-blue)](README.md)
[![中文](https://img.shields.io/badge/中文-README-green)](README_CN.md)
[![codecov](https://codecov.io/gh/ModelEngine-Group/nexent-commercial/branch/develop/graph/badge.svg?token=G6FRRL2M04)](https://codecov.io/gh/ModelEngine-Group/nexent-commercial?branch=develop)

Nexent is a zero-code platform for auto-generating agents — no orchestration, no complex drag-and-drop required, using pure language to develop any agent you want. Built on the MCP ecosystem with rich tool integration, Nexent also provides various built-in agents to meet your intelligent service needs in different scenarios such as work, travel, and daily life. Nexent offers powerful capabilities for agent running control, multi-agent collaboration, data processing and knowledge tracing, multimodal dialogue, and batch scaling.

> One prompt. Endless reach.

### 🌟 Try Nexent Now

- 🌐 Visit our [official website](http://nexent.tech/) to learn more
- 🚀 [Try it now](http://nexent.tech/try) to experience the power of Nexent

https://github.com/user-attachments/assets/b844e05d-5277-4509-9463-1c5b3516f11e

# 🤝 Join Our Community

> *If you want to go fast, go alone; if you want to go far, go together.*

We have released **Nexent v1**, and the platform is now relatively stable. However, there may still be some bugs, and we are continuously improving and adding new features. Stay tuned: we will announce **v2.0** soon!

* **🗺️ Check our [Feature Map](https://github.com/orgs/ModelEngine-Group/projects/6)** to explore current and upcoming features.
* **🔍 Try the current build** and leave ideas or bugs in the [Issues](https://github.com/ModelEngine-Group/nexent/issues) tab.

> *Rome wasn't built in a day.*

If our vision speaks to you, jump in via the **[Contribution Guide](CONTRIBUTING.md)** and shape Nexent with us.

Early contributors won't go unnoticed: from special badges and swag to other tangible rewards, we're committed to thanking the pioneers who help bring Nexent to life.

Most of all, we need visibility. Star ⭐ and watch the repo, share it with friends, and help more developers discover Nexent — your click brings new hands to the project and keeps the momentum growing.

# ⚡ Have a try first

### 1. 📋 Prerequisites  

| Resource | Minimum |
|----------|---------|
| **CPU**  | 2 cores |
| **RAM**  | 6 GiB   |
| **Software** | Docker & Docker Compose installed |

### 2. 🛠️ Quick start with Docker Compose

```bash
git clone https://github.com/ModelEngine-Group/nexent.git
cd nexent/docker
cp .env.example .env # fill only necessary configs
bash deploy.sh
```

When the containers are running, open **http://localhost:3000** in your browser and follow the setup wizard.

### 3. 🤖 Model Configuration & Provider Recommendations

We recommend the following model providers:

| Model Type | Provider | Notes |
|------------|----------|-------|
| LLM & VLLM | [Silicon Flow](https://siliconflow.cn/) | Free tier available |
| LLM & VLLM | [Alibaba Bailian](https://bailian.console.aliyun.com/) | Free tier available |
| Embedding | [Jina](https://jina.ai/) | Free tier available |
| TTS & STT | [Volcengine Voice](https://www.volcengine.com/product/voice-tech) | Free for personal use |
| Search | [EXA](https://exa.ai/) | Free tier available |

You'll need to input the following information in the model configuration page:
- Base URL
- API Key
- Model Name

The following configurations need to be added to your `.env` file (we'll make these configurable through the frontend soon):
- TTS and STT related configurations
- EXA search API Key

> ℹ️ Due to core features development, currently, we only support Jina Embedding model. Support for other models will be added in future releases. For Jina API key setup, please refer to our [FAQ](FAQ.md).

### 4. ❓ Need help?

- Browse the [FAQ](FAQ.md) for common install issues.  
- Drop questions in our [Discord community](https://discord.gg/tb5H3S3wyv).  
- File bugs or feature ideas in [GitHub Issues](https://github.com/ModelEngine-Group/nexent/issues).

### 5. 🔧 Hack on Nexent

Want to build from source or add new features? Check the [Contribution Guide](CONTRIBUTING.md) for step-by-step instructions.

### 6. 🛠️ Build from Source

Prefer to run Nexent from source code? Follow our [Developer Guide](DEVELOPPER_NOTE.md) for detailed setup instructions and customization options.

## 🌱 MCP Tool Ecosystem

Nexent is built on the Model Context Protocol (MCP) tool ecosystem, providing a flexible and extensible framework for integrating various tools and services. MCP serves as the "USB-C of AI" - a universal interface standard that allows AI agents to seamlessly connect with external data sources, tools, and services.

### 🌐 MCP Community Hub

The global MCP ecosystem is thriving with multiple platforms supporting MCP development and deployment:

| Platform | Description | Notes |
|----------|-------------|-------|
| **[GitHub MCP Server](https://github.com/github/github-mcp-server)** | Deep integration with Claude, GPT-4, Copilot etc., supports Go and Python | OAuth/GitHub account authorization |
| **[Qdrant MCP Vector Server](https://github.com/qdrant/mcp-server-qdrant)** | Semantic vector storage with Python/Go compatibility | Compatible with LangChain and other tools |
| **[Anthropic Reference MCP Servers](https://github.com/modelcontextprotocol/servers)** | Lightweight teaching and prototyping tools, Python | Includes fetch, git and other universal tools |
| **[AWS Labs MCP Server](https://github.com/awslabs/mcp)** | AWS+Go+CDK cloud reference services | Suitable for cloud environments |
| **[MCP Hub China](https://www.mcp-cn.com/)** | Chinese curated high-quality MCP service platform | Focuses on quality over quantity, community-driven |
| **[ModelScope MCP Marketplace](https://modelscope.cn/mcp)** | China's largest MCP community with 1,500+ services | From Amap to Alipay, comprehensive service coverage |
| **Community MCP Servers** | Various scenario-specific source code collection | Mostly experimental and innovative tools |

### 🛠️ Recommended MCP Tools

| Tool Name | Function | Description |
|-----------|----------|-------------|
| **[Amap Maps](https://modelscope.cn/mcp/servers/@amap/amap-maps)** | Geographic services and navigation | Comprehensive mapping, geocoding, routing, and location services |
| **[Bing Search (Chinese)](https://modelscope.cn/mcp/servers/@yan5236/bing-cn-mcp-server)** | Web search in Chinese | Optimized Chinese web search and information retrieval |
| **[12306 Train Ticket Query](https://modelscope.cn/mcp/servers/@Joooook/12306-mcp)** | China railway ticket booking | Real-time train schedules, ticket availability, and booking assistance |
| **[Alipay MCP](https://modelscope.cn/mcp/servers/@alipay/mcp-server-alipay)** | Payment and financial services | Digital payments, financial tools, and services integration |
| **[Variflight Aviation](https://modelscope.cn/mcp/servers/@variflight-ai/variflight-mcp)** | Flight information and aviation data | Real-time flight tracking, schedules, and aviation analytics |
| **[Sequential Thinking](https://modelscope.cn/mcp/servers/@modelcontextprotocol/sequentialthinking)** | Structured problem-solving framework | Break down complex problems into manageable, sequential steps |
| **[ArXiv AI Search](https://modelscope.cn/mcp/servers/@blazickjp/arxiv-mcp-server)** | Academic paper search and research | Advanced search and retrieval of scientific papers and research |
| **[Firecrawl MCP Server](https://modelscope.cn/mcp/servers/@mendableai/firecrawl-mcp-server)** | Web scraping and content extraction | Intelligent web scraping, data extraction, and content processing |

### 🚀 Suggested Agent Scenarios

With MCP's powerful ecosystem, you can create sophisticated AI agents for various scenarios:

🌍 **Travel Planning Agent** 
- Use Amap for route planning and navigation 📍
- Integrate 12306 for train bookings 🚄
- Connect Variflight for flight information ✈️
- Enable Alipay for seamless payments 💳

🔬 **Research Assistant Agent**
- Leverage ArXiv search for academic papers 📚
- Use Bing Search for comprehensive web research 🔍
- Apply Sequential Thinking for structured analysis 🧠
- Integrate Firecrawl for web data extraction 🕷️

💼 **Business Intelligence Agent**
- Connect multiple data sources through various MCP servers 📊
- Use geographic tools for location-based insights 🗺️
- Integrate payment systems for financial analysis 💰
- Apply structured thinking frameworks for decision-making 🎯

🏠 **Smart Lifestyle Agent**
- Combine mapping services with payment integration 🛒
- Use transportation tools for commute optimization 🚗
- Integrate web search for local recommendations 🏪
- Apply intelligent content extraction for information gathering 📱

The MCP ecosystem empowers you to build agents that can seamlessly interact with the real world, accessing live data, performing complex operations, and providing contextual assistance across virtually any domain. Each tool brings specialized capabilities that can be combined to create powerful, multi-functional AI experiences.

## ✨ Key Features

`1` **Smart agent prompt generation**  
   Turn plain language into runnable prompts. Nexent automatically chooses the right tools and plans the best action path for every request.

   ![Feature 1](./assets/Feature1.png)

`2` **Scalable data process engine**  
   Process 20+ data formats with fast OCR and table structure extraction, scaling smoothly from a single process to large-batch pipelines.

   ![Feature 2](./assets/Feature2.png)

`3` **Personal-grade knowledge base**  
   Import files in real time, auto-summarise them, and let agents access both personal and global knowledge instantly, also knowing what it can get from each knowledge base.

   ![Feature 3](./assets/Feature3.png)

`4` **Internet knowledge search**  
   Connect to 5+ web search providers so agents can mix fresh internet facts with your private data.

   ![Feature 4](./assets/Feature4.png)

`5` **Knowledge-level traceability**  
   Serve answers with precise citations from web and knowledge-base sources, making every fact verifiable.

   ![Feature 5](./assets/Feature5.png)

`6` **Multimodal understanding & dialogue**  
   Speak, type, files, or show images. Nexent understands voice, text, and pictures, and can even generate new images on demand.

   ![Feature 6](./assets/Feature6.png)

`7` **MCP tool ecosystem**  
   Drop in or build Python plug-ins that follow the MCP spec; swap models, tools, and chains without touching core code.

   ![Feature 7](./assets/Feature7.png)

# 🐛 Known Issues

1📝 **Code Output May Be Misinterpreted as Executable**  
   In Nexent conversations, if the model outputs code-like text, it may sometimes be misinterpreted as something that should be executed. We will fix this as soon as possible.


# 💬 Community & contact

Join our [Discord community](https://discord.gg/tb5H3S3wyv) to chat with other developers and get help!

# 📄 License

Nexent is licensed under the [MIT](LICENSE) with additional conditions. Please read the [LICENSE](LICENSE) file for details.

