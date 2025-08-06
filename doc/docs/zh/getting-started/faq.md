# Nexent 常见问题

本常见问题解答主要针对安装和部署 Nexent 过程中可能遇到的问题。如需了解基本安装步骤，请参考我们文档中的[快速开始指南](./overview#quick-start)。

## 🚀 安装与设置

有关模型提供商设置和 API 密钥获取，请参阅我们的详细 **[模型提供商指南](./model-providers)**。

## 🚫 常见错误与运维方式

### 🌐 网络连接问题
- **Q: Docker 容器如何访问宿主机上部署的模型（如 Ollama）？**
  - A: 由于容器内的 `localhost` 指向容器自身，需要通过以下方式连接宿主机服务：
  
    **方案一：使用Docker特殊DNS名称 host.docker.internal**  
    适用场景：Mac/Windows和较新版本的Docker Desktop(Linux版本也支持)  
      ```bash
      http://host.docker.internal:11434/v1
      ```
    **方案二：使用宿主机真实 IP（需确保防火墙放行）**
    ```bash
    http://[宿主机IP]:11434/v1
    ```
    **方案三：修改Docker Compose配置**  
    在docker-compose.yaml中添加：
    ```yaml
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ```

### 🔌 端口冲突
- **Q: 端口 3000 已被占用，如何修改？**
  - A: 可以在 Docker Compose 配置文件中修改端口。

### 📦 容器问题
- **Q: 如何查看容器日志？**
  - A: 使用 `docker logs <容器名称>` 命令查看特定容器的日志。

## 🔍 故障排除

### 🔢 模型连接问题

- **Q: 为什么我的模型无法连接？**
  - A: 请检查以下项目：
    1. **正确的 API 端点**: 确保您使用正确的 base URL
    2. **有效的 API 密钥**: 验证您的 API 密钥具有适当权限
    3. **模型名称**: 确认模型标识符正确
    4. **网络访问**: 确保您的部署可以访问提供商的服务器
    
    有关特定提供商设置，请参阅我们的 [模型提供商指南](./model-providers)。

### 📧 邮件工具配置
- **Q: 如何启用和配置邮件工具？**
  - A: 我们团队已经预制实现了基于 IMAP 和 SMTP 的邮件工具。要启用它们：
    1. 在 `.env` 文件中配置邮件参数
    2. 在 `agent_utils.py` 中取消邮件工具相关的注释
    3. 切换到支持邮件的系统提示词 `code_agent_with_email.yaml`
    4. 重启 MCP 服务使更改生效

## 💡 需要帮助

如果这里没有找到您的问题答案：
- 加入我们的 [Discord 社区](https://discord.gg/tb5H3S3wyv) 获取实时支持
- 查看我们的 [GitHub Issues](https://github.com/ModelEngine-Group/nexent/issues) 寻找类似问题
- 参考我们的[贡献指南](../contributing)获取更详细的信息 