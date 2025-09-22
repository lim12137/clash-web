# Local Tools

The Nexent platform provides a rich set of local tools that help agents complete various system-level tasks and local operations. These tools provide agents with powerful execution capabilities through direct interaction with local systems or remote servers.

## 🛠️ Available Tools

### Terminal Tool

**[Terminal Tool](./terminal-tool)** is one of the core local tools of the Nexent platform, allowing agents to execute commands on remote servers through SSH connections.

**Key Features**:
- Remote server management
- System monitoring and status checking
- File operations and directory management
- Service start/stop and configuration management
- Log viewing and analysis

**Use Cases**:
- Server operations automation
- System monitoring and alerting
- Batch file processing
- Deployment and release management
- Troubleshooting and diagnostics

## 🔧 Tool Configuration

All local tools need to be configured in the agent configuration:

1. Navigate to the **[Agent Configuration](../agent-configuration)** page
2. Select the agent to configure
3. Find the corresponding local tool in the "Select Agent Tools" tab
4. Click the configuration button and fill in the necessary connection parameters
5. Test the connection to ensure configuration is correct
6. Save the configuration and enable the tool

## ⚠️ Security Considerations

When using local tools, please pay attention to the following security considerations:

- **Permission Control**: Create dedicated users for tools, follow the principle of least privilege
- **Network Security**: Use VPN or IP whitelist to restrict access
- **Authentication Security**: Prefer key-based authentication, regularly rotate keys
- **Command Restrictions**: Configure command whitelist in production environments
- **Audit Logging**: Enable detailed operation logging

## 🚀 Next Steps

After configuring local tools, you can:

1. **[Agent Configuration](../agent-configuration)** - Add tools to agents
2. **[Chat Interface](../chat-interface)** - Use tools through agents to execute tasks

If you encounter any issues while using local tools, please refer to the detailed documentation of the corresponding tool or join our [Discord Community](https://discord.gg/tb5H3S3wyv) for support.
