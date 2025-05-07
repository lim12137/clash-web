# Prompt模板文件说明

本目录包含用于创建不同类型Agent的提示词模板文件。这些YAML文件定义了Agent的系统提示词、规划提示词和其他关键提示词组件。

## 文件命名规范

命名格式为`{agent_type}_agent.yaml`，其中：
- `agent_type`：描述Agent的主要功能或用途（如manager、search等）

## 提示词模板结构

每个YAML文件包含以下主要部分：

### 1. system_prompt

系统提示词是Agent的核心部分，定义了Agent的角色、能力和行为规范。通常包含以下部分：

- **核心职责**：Agent的主要职责和能力描述
- **执行流程**：Agent执行任务的标准流程和方法
- **可用资源**：Agent可以使用的工具和子Agent列表
- **资源使用要求**：使用不同工具的优先级和策略
- **Python代码规范**：编写代码的规范和约束
- **示例模板**：展示Agent执行任务的示例

### 2. planning

包含用于任务规划的各种提示词：

- **initial_facts**：初始事实收集提示词
- **initial_plan**：初始计划制定提示词
- **update_facts_pre_messages**：更新事实前的提示词
- **update_facts_post_messages**：更新事实后的提示词
- **update_plan_pre_messages**：更新计划前的提示词
- **update_plan_post_messages**：更新计划后的提示词

### 3. managed_agent

定义与子Agent交互的提示词：

- **task**：分配给子Agent的任务提示词
- **report**：子Agent报告结果的提示词

### 4. final_answer

定义最终答案生成的提示词：

- **pre_messages**：生成最终答案前的提示词
- **post_messages**：生成最终答案后的提示词

### 5. tools_requirement

定义工具使用规范和优先级的提示词。

### 6. few_shots

提供少样本学习示例的提示词，帮助Agent更好地理解任务执行方式。

## 模板变量

提示词模板中使用以下特殊变量进行动态替换：

- `{{tools}}`：可用工具列表
- `{{managed_agents}}`：可用子Agent列表
- `{{task}}`：当前任务描述
- `{{authorized_imports}}`：授权导入的Python模块
- `{{facts_update}}`：更新后的事实列表
- `{{answer_facts}}`：已知事实列表
- `{{remaining_steps}}`：剩余执行步骤数
