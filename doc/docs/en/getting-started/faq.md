# Nexent FAQ

This FAQ addresses common questions and issues you might encounter while installing and deploying Nexent. For the basic installation steps, please refer to the [Quick Start Guide](./overview#quick-start) in our documentation.

## 🚀 Installation & Setup

For model provider setup and API key acquisition, see our detailed **[Model Providers Guide](./model-providers)**.

## 🚫 Common Errors & Operations

### 🌐 Network Connection Issues
- **Q: How can a Docker container access models deployed on the host machine (e.g., Ollama)?**
  - A: Since `localhost` inside the container refers to the container itself, use one of these methods to connect to host services:

    **Option 1: Use Docker's special DNS name `host.docker.internal`**  
    Supported environments: Mac/Windows and newer Docker Desktop versions (Linux version also supported)  
    ```bash
    http://host.docker.internal:11434/v1
    ```

    **Option 2: Use host machine's actual IP (ensure firewall allows access)**
    ```bash
    http://[HOST_IP]:11434/v1
    ```

    **Option 3: Modify Docker Compose configuration**  
    Add to your docker-compose.yaml file:
    ```yaml
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ```

### 🔌 Port Conflicts
- **Q: Port 3000 is already in use. How can I change it?**
  - A: You can modify the port in the Docker Compose configuration file.

### 📦 Container Issues
- **Q: How do I check container logs?**
  - A: Use `docker logs <container_name>` to view logs for specific containers.

## 🔍 Troubleshooting

### 🔢 Model Connection Issues

- **Q: Why can't my model connect?**
  - A: Check the following:
    1. **Correct API endpoint**: Ensure you're using the right base URL
    2. **Valid API key**: Verify your API key has proper permissions
    3. **Model name**: Confirm the model identifier is correct
    4. **Network access**: Ensure your deployment can reach the provider's servers
    
    For specific provider setup, see our [Model Providers Guide](./model-providers).

### 📧 Email Tools Configuration
- **Q: How can I enable and configure email tools?**
  - A: Our team has pre-implemented email tools based on IMAP and SMTP. To enable them:
    1. Configure email parameters in `.env` file
    2. Uncomment the email tool imports and registrations in `agent_utils.py`
    3. Switch to the email-enabled system prompt by using `code_agent_with_email.yaml`
    4. Restart the MCP service to apply changes

## 💡 Need Help

If your question isn't answered here:
- Join our [Discord community](https://discord.gg/tb5H3S3wyv) for real-time support
- Check our [GitHub Issues](https://github.com/ModelEngine-Group/nexent/issues) for similar problems
- Refer to our [Contribution Guide](../contributing) for more detailed information 