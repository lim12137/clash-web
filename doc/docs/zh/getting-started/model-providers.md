# 第三方模型提供商

本指南帮助您获取 API 密钥并配置 Nexent 支持的各种 AI 模型提供商。Nexent 支持所有 OpenAI 兼容的模型、多模态嵌入模型和多模态大语言模型。

## 🤖 大语言模型 (LLM)

### 硅基流动 (Silicon Flow)
- **网站**: [siliconflow.cn](https://siliconflow.cn/)
- **免费额度**: 可用
- **支持模型**: DeepSeek-R1、DeepSeek-V3、QwQ-32B、GLM-4-9B-Chat 等

**开始使用**:
1. 访问 [硅基流动](https://siliconflow.cn/) 并创建账户
2. 在控制台导航到 API 密钥部分
3. 创建新的 API 密钥并复制
4. 使用 base URL: `https://api.siliconflow.cn/v1`

### 阿里巴巴百炼
- **网站**: [bailian.console.aliyun.com](https://bailian.console.aliyun.com/)
- **免费额度**: 可用
- **支持模型**: 通义千问系列、ERNIE 及各种开源模型

**开始使用**:
1. 注册阿里云账户
2. 访问百炼控制台
3. 在模型服务部分创建 API 凭证
4. 配置您的 API 端点和密钥

### 其他 OpenAI 兼容提供商
Nexent 支持任何遵循 OpenAI API 规范的提供商：
- **OpenAI**: [platform.openai.com](https://platform.openai.com/)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
- **Deepseek**: [platform.deepseek.com](https://platform.deepseek.com/)
- **月之暗面**: [platform.moonshot.cn](https://platform.moonshot.cn/)
- **本地模型**: Ollama、vLLM 或任何 OpenAI 兼容服务器

## 🎭 多模态视觉模型

Nexent 支持可以处理文本和图像的多模态模型：

### 推荐提供商
- **GPT-4V** (OpenAI): 最佳整体性能
- **Claude-3** (Anthropic): 出色的推理能力
- **Qwen-VL** (阿里巴巴): 强大的多语言支持
- **GLM-4V** (智谱): 良好的中文语言支持

**配置**: 使用与 LLM 模型相同的 API 端点，但指定多模态模型名称。

## 🔤 嵌入模型

### Jina AI
**网站**: [jina.ai](https://jina.ai/)
**免费额度**: 可用
**特色**: 多语言嵌入、文档理解

**开始使用**:
1. 访问 [Jina AI](https://jina.ai/)（基本使用无需注册）
2. 导航到嵌入部分
3. 从控制台获取您的 API 密钥
4. 使用端点: `https://api.jina.ai/v1/embeddings`

### 其他嵌入提供商
- **OpenAI Embeddings**: text-embedding-3-small、text-embedding-3-large
- **Cohere**: 高质量多语言嵌入
- **本地嵌入**: BGE、E5 或任何 OpenAI 兼容嵌入服务

## 🎤 文本转语音 (TTS) 和语音转文本 (STT)

### 火山引擎语音
- **网站**: [volcengine.com/product/voice-tech](https://www.volcengine.com/product/voice-tech)
- **免费额度**: 个人使用可用
- **特色**: 高质量中英文语音合成

**开始使用**:
1. 注册火山引擎账户
2. 访问语音技术服务
3. 创建应用并获取 API 凭证
4. 在环境中配置 TTS/STT 设置

## 🔍 搜索提供商

### EXA
**网站**: [exa.ai](https://exa.ai/)
**免费额度**: 可用
**特色**: 语义搜索、网络内容检索

**开始使用**:
1. 在 [EXA](https://exa.ai/) 注册
2. 在控制台生成 API 密钥
3. 配置搜索参数

## 🛠️ 在 Nexent 中配置

### 方法一：Web 界面
1. 访问 Nexent `http://localhost:3000`
2. 导航到模型配置页面
3. 添加您的提供商详细信息：
   - **Base URL**: 提供商的 API 端点
   - **API Key**: 您的提供商 API 密钥
   - **Model Name**: 特定模型标识符

### 方法二：环境配置
添加到您的 `.env` 文件：
```bash
# 模型提供商配置
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_API_KEY=your_api_key_here
LLM_MODEL_NAME=deepseek-ai/DeepSeek-V3

EMBEDDING_BASE_URL=https://api.jina.ai/v1
EMBEDDING_API_KEY=your_jina_key_here
EMBEDDING_MODEL_NAME=jina-embeddings-v3

# TTS/STT 配置
TTS_API_KEY=your_volcengine_key
STT_API_KEY=your_volcengine_key

# 搜索配置
EXA_API_KEY=your_exa_key
```

## 💡 选择提供商的建议

### 开发和测试
- **硅基流动**: 优秀的免费额度，多种模型
- **Jina AI**: 出色的嵌入能力
- **本地模型**: 完全隐私和控制

### 生产环境
- **OpenAI**: 最可靠，最佳文档
- **Anthropic**: 强大的安全性和推理
- **企业提供商**: 专用支持和 SLA

### 成本优化
- **免费额度**: 从硅基流动、Jina 和 EXA 开始
- **开源**: 使用 Ollama 或 vLLM 自托管
- **区域提供商**: 本地市场通常更便宜

## 🔗 快速链接

- [安装与配置](./installation.md) - 完整部署指南
- [模型配置常见问题](../faq.md) - 常见配置问题
- [已知问题](../known-issues.md) - 当前限制和解决方法

## 🆘 需要帮助？

如果您在模型提供商方面遇到问题：
1. 查看提供商特定文档
2. 验证 API 密钥权限和配额
3. 使用提供商官方示例进行测试
4. 加入我们的 [Discord 社区](https://discord.gg/tb5H3S3wyv) 获取支持