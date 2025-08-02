# MCP Tool Ecosystem

Nexent is built on the Model Context Protocol (MCP) tool ecosystem, providing a flexible and extensible framework for integrating various tools and services. MCP serves as the "USB-C of AI" - a universal interface standard that allows AI agents to seamlessly connect with external data sources, tools, and services.

## What is MCP?

The Model Context Protocol (MCP) is an open protocol that enables AI applications to securely connect to external data sources and tools. It provides a standardized way for AI models to access and interact with external systems, making it easier to build powerful, context-aware AI applications.

## MCP Community Hub

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

## Recommended MCP Tools

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

## Benefits of MCP

### Standardization
- **Universal Interface**: MCP provides a consistent way to connect AI models with external tools
- **Interoperability**: Tools built for one MCP-compatible platform work with others
- **Reduced Development Time**: Standardized protocols mean less custom integration work

### Security
- **Controlled Access**: MCP provides secure, permission-based access to external resources
- **Authentication**: Built-in support for various authentication methods
- **Audit Trail**: Track and monitor all external interactions

### Scalability
- **Modular Design**: Add or remove tools without affecting the core application
- **Load Distribution**: Distribute tool execution across multiple servers
- **Version Management**: Handle different versions of tools gracefully

## Getting Started with MCP

1. **Explore Available Tools**: Browse the MCP marketplace to find tools that fit your needs
2. **Install Tools**: Add MCP tools to your Nexent instance
3. **Configure Access**: Set up authentication and permissions
4. **Create Agents**: Build agents that leverage multiple MCP tools
5. **Monitor Performance**: Track usage and optimize tool selection

For detailed integration guides, see our [Backend Tools Documentation](../backend/tools/).

## Building Custom MCP Tools

Interested in building your own MCP tools? Check out:
- [LangChain Tools Guide](../backend/tools/langchain)
- [MCP Tools Development](../backend/tools/mcp)
- [SDK Tools Documentation](../sdk/core/tools)

The MCP ecosystem empowers you to build agents that can seamlessly interact with the real world, accessing live data, performing complex operations, and providing contextual assistance across virtually any domain.