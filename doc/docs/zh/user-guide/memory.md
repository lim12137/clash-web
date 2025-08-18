## 🧠 Nexent 智能记忆功能指南

### 1. 功能概览
Nexent 的智能记忆功能让智能体能够记住对话历史，并在未来交互中调用这些信息，实现 **更连贯**、**更个性化** 的体验。  
记忆可以手动管理，也能在对话中自动更新，支持多种层级设置，满足不同场景需求。

---

### 2. 开启与基础设置
1. 点击网页右上角的 **大脑图标** 进入记忆管理界面  
2. 在 **基础设置** 中：
   - **记忆能力**：可开启/关闭（默认开启）  
   - **Agent 记忆共享**：
     - 总是共享（默认）
     - 每次询问我
     - 永不共享

---

### 3. 记忆层级
Nexent 基于 **mem0** 提供四种记忆层级：

| 层级 | 作用范围 | 存储内容 | 保存时长 | 典型场景 |
| ---- | -------- | -------- | -------- | -------- |
| 租户级（Tenant Level） | 全组织 | 共享知识、政策、流程 | 永久 | 组织知识管理 |
| 智能体级（Agent Level） | 特定智能体 | 专业知识、对话历史 | 智能体存在期间 | 专业领域积累 |
| 用户级（User Level） | 特定用户 | 偏好、常用设置 | 永久 | 个性化服务 |
| 用户-智能体级（User-Agent Level） | 特定用户 + 特定智能体 | 对话历史、合作模式 | 关系存在期间 | 深度合作 |

<div style="display: flex; justify-content: left;">
  <img src="./assets/memory/mem-config.png)" style="width: 50%; height: auto;" />
</div>

---

### 4. 使用方式
- **自动调用**：对话时，智能体会根据所选 Agent 调用相关记忆回答问题  
- **自动添加**：对话中出现的事实会自动保存为记忆  
- **手动修改**：可在对话中直接指令添加、更新或删除记忆  

> 💡 建议每条记忆只包含一个简洁的事实，以便后续调用更准确。

**💬 示例：**

<div style="display: flex; justify-content: left;">
  <img src="./assets/memory/chat-add-name.png)" style="width: 50%; height: auto;" />
</div>

<div style="display: flex; justify-content: left;">
  <img src="./assets/memory/mem-config-update.png)" style="width: 50%; height: auto;" />
</div>

---

### 5. 管理与删除
- **记忆管理菜单**：
  - 绿色「➕」按钮添加记忆
  - 红色橡皮图标删除记忆
- **删除 Agent**：
  - 会同时清除其 **Agent 级** 和 **User-Agent 级** 的记忆
