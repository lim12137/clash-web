# Third-Party Model Providers

This guide helps you obtain API keys and configure various AI model providers supported by Nexent. Nexent supports all OpenAI-compatible models, multimodal embeddings, and multimodal language models.

## 🤖 Large Language Models (LLM)

### Silicon Flow
- **Website**: [siliconflow.cn](https://siliconflow.cn/)
- **Free Tier**: Available
- **Supported Models**: DeepSeek-R1, DeepSeek-V3, QwQ-32B, GLM-4-9B-Chat, and more

**Getting Started**:
1. Visit [SiliconFlow](https://siliconflow.cn/) and create an account
2. Navigate to API Keys section in your dashboard
3. Create a new API key and copy it
4. Use base URL: `https://api.siliconflow.cn/v1`

### Alibaba Cloud Bailian
- **Website**: [bailian.console.aliyun.com](https://bailian.console.aliyun.com/)
- **Free Tier**: Available
- **Supported Models**: Qwen series, ERNIE, and various open-source models

**Getting Started**:
1. Sign up for Alibaba Cloud account
2. Access Bailian console
3. Create API credentials in the model service section
4. Configure your API endpoint and key

### Other OpenAI-Compatible Providers
Nexent supports any provider that follows the OpenAI API specification:
- **OpenAI**: [platform.openai.com](https://platform.openai.com/)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
- **Deepseek**: [platform.deepseek.com](https://platform.deepseek.com/)
- **Moonshot**: [platform.moonshot.cn](https://platform.moonshot.cn/)
- **Local Models**: Ollama, vLLM, or any OpenAI-compatible server

## 🎭 Multimodal Vision Models

Nexent supports multimodal models that can process both text and images:

### Recommended Providers
- **GPT-4V** (OpenAI): Best overall performance
- **Claude-3** (Anthropic): Excellent reasoning capabilities
- **Qwen-VL** (Alibaba): Strong multilingual support
- **GLM-4V** (Zhipu): Good Chinese language support

**Configuration**: Use the same API endpoints as LLM models, but specify multimodal model names.

## 🔤 Embedding Models

### Jina AI
- **Website**: [jina.ai](https://jina.ai/)
- **Free Tier**: Available
- **Specialties**: Multilingual embeddings, document understanding

**Getting Started**:
1. Visit [Jina AI](https://jina.ai/) (no sign-up required for basic usage)
2. Navigate to the Embedding section
3. Get your API key from the dashboard
4. Use endpoint: `https://api.jina.ai/v1/embeddings`

### Other Embedding Providers
- **OpenAI Embeddings**: text-embedding-3-small, text-embedding-3-large
- **Cohere**: High-quality multilingual embeddings
- **Local Embeddings**: BGE, E5, or any OpenAI-compatible embedding service

## 🎤 Voice Models

### Volcengine Voice
- **Website**: [volcengine.com/product/voice-tech](https://www.volcengine.com/product/voice-tech)
- **Free Tier**: Available for personal use
- **Specialties**: High-quality Chinese and English voice synthesis

**Getting Started**:
1. Register for Volcengine account
2. Access Voice Technology service
3. Create application and get API credentials
4. Configure TTS/STT settings in your environment

## 🔍 Search Providers

### EXA
- **Website**: [exa.ai](https://exa.ai/)
- **Free Tier**: Available
- **Specialties**: Semantic search, web content retrieval

**Getting Started**:
1. Sign up at [EXA](https://exa.ai/)
2. Generate API key in dashboard
3. Configure search parameters

### Tavily
- **Website**: [tavily.com](https://tavily.com/)
- **Free Tier**: Available
- **Specialties**: AI-powered search, research assistant

**Getting Started**:
1. Sign up at [Tavily](https://tavily.com/)
2. Get your API key from the dashboard
3. Configure search preferences

### Linkup
- **Website**: [linkup.com](https://linkup.com/)
- **Free Tier**: Available
- **Specialties**: Real-time web search, content discovery

**Getting Started**:
1. Register at [Linkup](https://linkup.com/)
2. Generate API credentials
3. Set up search parameters

## 🛠️ Configuration in Nexent

### Model Configuration Page
1. Access Nexent at `http://localhost:3000`
2. Navigate to Model Configuration page
3. Add your provider details:
   - **Base URL**: Provider's API endpoint
   - **API Key**: Your provider's API key
   - **Model Name**: Specific model identifier

## 💡 Tips for Choosing Providers

### For Development & Testing
- **SiliconFlow**: Great free tier, multiple models
- **Jina AI**: Excellent embedding capabilities
- **Local Models**: Complete privacy and control

### For Production
- **OpenAI**: Most reliable, best documentation
- **Anthropic**: Strong safety and reasoning
- **Enterprise Providers**: Dedicated support and SLAs

### For Cost Optimization
- **Free Tiers**: Start with SiliconFlow, Jina, and EXA
- **Open Source**: Self-host with Ollama or vLLM
- **Regional Providers**: Often cheaper for local markets

## 🔗 Quick Links

- [Installation & Setup](./installation) - Complete deployment guide
- [Model Configuration FAQ](./faq) - Common configuration issues
- [Known Issues](../known-issues) - Current limitations and workarounds

## 💡 Need Help

If you encounter issues with model providers:
1. Check provider-specific documentation
2. Verify API key permissions and quotas
3. Test with provider's official examples
4. Join our [Discord community](https://discord.gg/tb5H3S3wyv) for support