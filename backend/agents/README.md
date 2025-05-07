# Agent配置文件说明

本目录包含用于创建不同类型Agent的配置文件。这些JSON文件定义了Agent的核心组件、工具和行为。

## 文件命名规范

命名格式为`{agent_type}_agent.json`，其中：
- `agent_type`：描述Agent的主要功能或用途


## 配置文件结构

每个配置文件包含以下主要部分：

1. **models**：定义Agent可使用的语言模型
   - `main_model`：主要使用的模型
   - `sub_model`：辅助模型

2. **managed_agents**：该Agent管理的子Agent列表（可选）
   - `name`：子Agent名称，用于主Agent调用时引用
   - `model`：子Agent使用的模型（引用models中定义的模型）
   - `description`：子Agent功能描述，通常包含使用规范和约束
   - `max_steps`：子Agent最大执行步骤数
   - `provide_run_summary`：是否为主agent提供执行摘要
   - `prompt_templates_path`：子Agent使用的提示词模板路径
   - `tools`：可用工具列表

3. **main_agent**：主Agent的配置
   - `name`：Agent名称
   - `model`：使用的模型（引用models中定义的模型）
   - `max_steps`：最大执行步骤数
   - `tools`：可用工具列表
   - `prompt_templates_path`：提示词模板路径

## 工具配置详解

`tools`字段定义了Agent可以使用的工具列表，每个工具配置包含以下参数：

1. **name**：工具名称，必须与实际实现的工具类名称匹配
   - 对于本地工具，必须在系统中已注册（如`KnowledgeBaseSearchTool`）
   - 对于MCP工具，必须在MCP服务器中存在

2. **source**：工具来源
   - `local`：本地实现的工具，通过Python类直接实例化
   - `mcp`：MCP服务器提供的外部工具，通过服务调用

3. **model**（可选）：工具使用的语言模型
   - 引用`models`部分定义的模型名称
   - 仅适用于需要语言模型的工具（如`SummaryTool`）

4. **params**：工具特定参数
   - 提供给工具构造函数的参数字典
   - 仅本地实现的工具需要传入实例化参数，MCP服务器工具参数在服务器端定义

## 现有配置文件

### manager_agent_demo.json

这是一个复杂Agent配置，它：
- 定义了一个包含搜索功能的managed agent (`ask_search_agent`)
- 主Agent可以调用这个子 agent来执行搜索任务
- 主Agent同时还可以使用其他工具如`search_papers`

### search_agent.json

这是一个专门用于搜索的Agent配置，它：
- 没有managed agents
- 主Agent直接使用多种搜索工具：`KnowledgeBaseSearchTool`、`EXASearchTool`和`SummaryTool`
- 适用于需要独立搜索功能的场景

## 使用方法

这些配置文件由`AgentCreateFactory`类解析和处理，该类位于`backend/utils/agent_create_factory.py`。

使用示例：

```python
from agent.agent_create_factory import AgentCreateFactory

# 初始化工厂
factory = AgentCreateFactory(mcp_tool_collection, observer)

# 从配置文件创建Agent
agent = factory.create_from_json("backend/consts/agents/search_agent.json")
```

创建自定义Agent配置时，请参考现有配置文件的结构，并确保：
1. 所有环境变量使用`${VARIABLE_NAME}`格式
2. 确保工具存在，mcp_tool_collection为mcp服务器端工具列表
3. 工具配置中包含必要的参数
4. 正确设置提示模板路径