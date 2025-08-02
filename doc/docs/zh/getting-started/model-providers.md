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

### 阿里云百炼
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
- **网站**: [jina.ai](https://jina.ai/)
- **免费额度**: 可用
- **特色**: 多语言嵌入、文档理解

**开始使用**:
1. 访问 [Jina AI](https://jina.ai/)（基本使用无需注册）
2. 导航到嵌入部分
3. 从控制台获取您的 API 密钥
4. 使用端点: `https://api.jina.ai/v1/embeddings`

### 其他嵌入提供商
- **OpenAI Embeddings**: text-embedding-3-small、text-embedding-3-large
- **Cohere**: 高质量多语言嵌入
- **本地嵌入**: BGE、E5 或任何 OpenAI 兼容嵌入服务

## 🎤 语音模型

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
- **网站**: [exa.ai](https://exa.ai/)
- **免费额度**: 可用
- **特色**: 语义搜索、网络内容检索

**开始使用**:
1. 在 [EXA](https://exa.ai/) 注册
2. 在控制台生成 API 密钥
3. 配置搜索参数

### Tavily
- **网站**: [tavily.com](https://tavily.com/)
- **免费额度**: 可用
- **特色**: AI 驱动的搜索、研究助手

**开始使用**:
1. 在 [Tavily](https://tavily.com/) 注册
2. 从控制台获取您的 API 密钥
3. 配置搜索偏好

### Linkup
- **网站**: [linkup.com](https://linkup.com/)
- **免费额度**: 可用
- **特色**: 实时网络搜索、内容发现

**开始使用**:
1. 在 [Linkup](https://linkup.com/) 注册
2. 生成 API 凭证
3. 设置搜索参数

## 🛠️ 在 Nexent 中配置

### 模型配置页面
1. 访问 Nexent `http://localhost:3000`
2. 导航到模型配置页面
3. 添加您的提供商详细信息：
   - **Base URL**: 提供商的 API 端点
   - **API Key**: 您的提供商 API 密钥
   - **Model Name**: 特定模型标识符

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

- [安装与配置](./installation) - 完整部署指南
- [模型配置常见问题](./faq) - 常见配置问题
- [已知问题](../known-issues) - 当前限制和解决方法

## 💡 需要帮助

如果您在模型提供商方面遇到问题：
1. 查看提供商特定文档
2. 验证 API 密钥权限和配额
3. 使用提供商官方示例进行测试
4. 加入我们的 [Discord 社区](https://discord.gg/tb5H3S3wyv) 获取支持