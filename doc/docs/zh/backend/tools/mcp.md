# 分层代理架构说明

## 系统架构流程图

```mermaid
graph TD
    A["前端请求"] --> B["主服务 (FastAPI)<br/>(端口: 5010)"]
    
    B --> B1["Web API管理层<br/>(/api/mcp/*)"]
    B1 --> B2["/api/mcp/tools/<br/>(获取工具信息)"]
    B1 --> B3["/api/mcp/add<br/>(添加MCP服务器)"]
    B1 --> B4["/api/mcp/<br/>(删除MCP服务器)"]
    B1 --> B5["/api/mcp/list<br/>(列出MCP服务器)"]
    B1 --> B6["/api/mcp/recover<br/>(恢复MCP服务器)"]
    
    B --> C["MCP服务 (FastMCP)<br/>(端口: 5011)"]
    
    C --> C1["本地服务层"]
    C --> C2["远程代理层"]
    C --> C3["MCP协议API层"]
    
    C1 --> C11["local_mcp_service<br/>(稳定挂载)"]
    
    C2 --> C21["RemoteProxyManager<br/>(动态管理)"]
    C21 --> C22["远程代理1"]
    C21 --> C23["远程代理2"]
    C21 --> C24["远程代理n..."]
    
    C3 --> C31["/healthcheck<br/>(连通性检查)"]
    C3 --> C32["/list-remote-proxies<br/>(列出代理)"]
    C3 --> C33["/add-remote-proxies<br/>(添加代理)"]
    C3 --> C34["/remote-proxies<br/>(删除代理)"]
    
    C22 --> D1["远程MCP服务1<br/>(SSE/HTTP)"]
    C23 --> D2["远程MCP服务2<br/>(SSE/HTTP)"]
    C24 --> D3["远程MCP服务n<br/>(SSE/HTTP)"]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style B1 fill:#fff3e0
    style C1 fill:#e8f5e8
    style C2 fill:#fff3e0
    style C3 fill:#fce4ec
```

## 架构概述

本系统实现了一个**双服务代理架构**，包含两个独立服务：

### 1. 主服务 (FastAPI) - 端口 5010
- **用途**：提供Web管理界面和RESTful API，作为前端唯一入口
- **特点**：面向用户管理，包含认证、多租户支持，代理MCP服务调用
- **启动文件**：`main_service.py`

### 2. MCP服务 (FastMCP) - 端口 5011  
- **用途**：提供MCP协议服务和代理管理（内部服务）
- **特点**：MCP协议标准，支持本地服务和远程代理，仅供主服务调用
- **启动文件**：`nexent_mcp_service.py`

**重要说明**：前端客户端仅直接访问主服务(5010)，所有MCP相关操作均由主服务代为调用MCP服务(5011)完成。

## 核心功能

### 1. 本地服务稳定性
- `local_mcp_service` 等本地服务始终保持稳定运行
- 远程代理的添加、删除、更新不会影响本地服务

### 2. 动态远程代理管理
- 支持动态添加、删除、更新远程MCP服务代理
- 每个远程代理作为独立的服务进行管理
- 支持多种传输方式（SSE、HTTP）

### 3. 双层API接口

#### 主服务API (端口 5010) - 对外管理层
**前端客户端直接访问的接口**，提供面向用户的管理功能，支持认证和多租户：

**获取远程MCP服务器工具信息**
```http
GET /api/mcp/tools/?service_name={name}&mcp_url={url}
Authorization: Bearer {token}
```

**添加远程MCP服务器**
```http
POST /api/mcp/add?mcp_url={url}&service_name={name}
Authorization: Bearer {token}
```

**删除远程MCP服务器**
```http
DELETE /api/mcp/?service_name={name}&mcp_url={url}
Authorization: Bearer {token}
```

**获取远程MCP服务器列表**
```http
GET /api/mcp/list
Authorization: Bearer {token}
```

**恢复远程MCP服务器**
```http
GET /api/mcp/recover
Authorization: Bearer {token}
```

#### MCP服务API (端口 5011) - 内部协议层
**内部接口，主要供主服务调用**，也可供外部MCP客户端直接使用：

**连通性检查**
```http
GET /healthcheck?mcp_url={url}
```
快速检查远程MCP服务是否可达，返回简单的连接状态。

**列出所有远程代理**
```http
GET /list-remote-proxies
```

**添加远程代理**
```http
POST /add-remote-proxies
Content-Type: application/json

{
    "service_name": "my_service",
    "mcp_url": "http://localhost:5012/sse", 
    "transport": "sse"
}
```

**删除远程代理**
```http
DELETE /remote-proxies?service_name={service_name}
```

## 使用方法

### 1. 启动服务

**启动主服务**
```bash
cd backend
python main_service.py
```
服务将在 `http://localhost:5010` 启动。

**启动MCP服务**
```bash
cd backend
python nexent_mcp_service.py
```
服务将在 `http://localhost:5011` 启动。

### 2. 使用API

#### 推荐方式：通过主服务管理MCP服务器
**前端客户端应使用此方式**，具备完整的认证和权限管理：

```bash
# 添加远程MCP服务器
curl -X POST "http://localhost:5010/api/mcp/add?mcp_url=http://external-server:5012/sse&service_name=external_service" \
  -H "Authorization: Bearer {your_token}"

# 获取MCP服务器列表
curl -H "Authorization: Bearer {your_token}" \
  "http://localhost:5010/api/mcp/list"
```

#### 内部调试：直接访问MCP服务（可选）
**仅用于调试或外部MCP客户端直接集成**：

```bash
# 测试远程服务连接
curl "http://localhost:5011/healthcheck?mcp_url=http://external-server:5012/sse"

# 添加远程代理
curl -X POST http://localhost:5011/add-remote-proxies \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "external_service",
    "mcp_url": "http://external-server:5012/sse",
    "transport": "sse"
  }'
```

## 代码结构

### 主服务组件 (main_service.py)
- **FastAPI应用**：提供Web API和管理界面
- **多租户支持**：基于认证的多租户管理
- **路由管理**：包含多个功能模块的路由器

### MCP服务组件 (nexent_mcp_service.py)

#### RemoteProxyManager 类
负责管理所有远程代理的生命周期：
- `add_remote_proxy()`: 添加新的远程代理
- `remove_remote_proxy()`: 移除指定的远程代理  
- `update_remote_proxy()`: 更新现有远程代理
- `list_remote_proxies()`: 列出所有远程代理配置
- `_validate_remote_service()`: 验证远程服务连接

#### MCP协议端点
- `/healthcheck`: 连通性检查端点
- `/list-remote-proxies`: 列出所有远程代理端点
- `/add-remote-proxies`: 添加远程代理端点
- `/remote-proxies`: 删除特定代理端点

### 远程MCP管理 (remote_mcp_app.py)
- **认证集成**：与主服务认证系统集成
- **数据持久化**：支持数据库存储和恢复
- **服务发现**：工具信息获取和管理

## 服务依赖关系

```mermaid
graph LR
    A["前端客户端"] --> B["主服务 :5010<br/>(FastAPI)"]
    B --> C["MCP服务 :5011<br/>(FastMCP)"]
    B --> D["数据库<br/>(用户/租户/配置)"]
    C --> E["本地MCP服务"]
    C --> F["远程MCP代理"]
    
    G["外部MCP客户端"] -.-> C
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style G fill:#fff3e0
```

## 错误处理

- 添加代理前会验证远程服务连接
- 提供详细的错误信息和状态码
- 支持优雅的服务卸载和重新加载
- 双层错误处理：管理层和协议层

## 性能优化

- 代理服务按需加载
- 支持并发操作
- 最小化对现有服务的影响
- 服务间松耦合设计

## 接口时序图

### 1. 获取远程MCP工具信息 (GET /api/mcp/tools/)

```mermaid
sequenceDiagram
    participant C as 前端客户端
    participant M as 主服务(5010)
    participant T as 工具配置服务
    participant R as 远程MCP服务

    C->>M: GET /api/mcp/tools/?service_name=xxx&mcp_url=xxx
    Note over C,M: Authorization: Bearer token (可选)
    
    M->>T: get_tool_from_remote_mcp_server(service_name, mcp_url)
    T->>R: 直接连接远程MCP服务获取工具列表
    R-->>T: 返回工具信息
    T-->>M: 工具信息列表
    
    M-->>C: JSON响应 {tools: [...], status: "success"}
    
    Note over M,C: 错误情况下返回 400 状态码
    Note over T,R: 注意：此接口直接访问远程MCP，不经过本地MCP服务(5011)
```

### 2. 添加远程MCP服务器 (POST /api/mcp/add)

```mermaid
sequenceDiagram
    participant C as 前端客户端
    participant M as 主服务(5010)
    participant A as 认证系统
    participant S as MCP服务管理
    participant DB as 数据库
    participant MCP as MCP服务(5011)
    participant R as 远程MCP服务

    C->>M: POST /api/mcp/add?mcp_url=xxx&service_name=xxx
    Note over C,M: Authorization: Bearer token
    
    M->>A: get_current_user_id(authorization)
    A-->>M: user_id, tenant_id
    
    M->>S: add_remote_mcp_server_list(tenant_id, user_id, mcp_url, service_name)
    
    S->>DB: 检查服务名是否已存在
    DB-->>S: 检查结果
    
    alt 服务名已存在
        S-->>M: JSONResponse (409 - Service name already exists)
        M-->>C: 错误响应 (409)
    else 服务名可用
        S->>S: add_remote_proxy()
        S->>MCP: POST /add-remote-proxies
        MCP->>MCP: 验证远程MCP服务连接
        MCP->>R: 连通性测试
        R-->>MCP: 连接响应
        
        alt MCP连接成功
            MCP->>MCP: 创建并挂载远程代理
            MCP-->>S: 200 - 成功添加代理
            S->>DB: 保存MCP服务器配置
            DB-->>S: 保存结果
            S-->>M: 成功结果
            M-->>C: JSON响应 {message: "Successfully added", status: "success"}
        else MCP连接失败
            MCP-->>S: 错误响应 (503/409/400)
            S-->>M: 错误结果/JSONResponse
            M-->>C: 错误响应 (400/409/503)
        end
    end
```

### 3. 删除远程MCP服务器 (DELETE /api/mcp/)

```mermaid
sequenceDiagram
    participant C as 前端客户端
    participant M as 主服务(5010)
    participant A as 认证系统
    participant S as MCP服务管理
    participant DB as 数据库
    participant MCP as MCP服务(5011)

    C->>M: DELETE /api/mcp/?service_name=xxx&mcp_url=xxx
    Note over C,M: Authorization: Bearer token
    
    M->>A: get_current_user_id(authorization)
    A-->>M: user_id, tenant_id
    
    M->>S: delete_remote_mcp_server_list(tenant_id, user_id, mcp_url, service_name)
    
    S->>DB: 查找并删除MCP服务器配置
    DB-->>S: 删除结果
    
    alt 数据库删除失败
        S-->>M: JSONResponse (400 - server not record)
        M-->>C: 错误响应 (400)
    else 数据库删除成功
        S->>MCP: DELETE /remote-proxies?service_name=xxx
        MCP->>MCP: 卸载远程代理服务
        
        alt MCP删除成功
            MCP-->>S: 200 - 成功移除
            S-->>M: 成功结果
            M-->>C: JSON响应 {message: "Successfully deleted", status: "success"}
        else MCP删除失败
            MCP-->>S: 404/400 - 删除失败
            S-->>M: 错误结果/JSONResponse
            M-->>C: 错误响应 (400/404)
        end
    end
```

### 4. 获取远程MCP服务器列表 (GET /api/mcp/list)

```mermaid
sequenceDiagram
    participant C as 前端客户端
    participant M as 主服务(5010)
    participant A as 认证系统
    participant S as MCP服务管理
    participant DB as 数据库

    C->>M: GET /api/mcp/list
    Note over C,M: Authorization: Bearer token
    
    M->>A: get_current_user_id(authorization)
    A-->>M: user_id, tenant_id
    
    M->>S: get_remote_mcp_server_list(tenant_id)
    S->>DB: 查询租户的MCP服务器列表
    DB-->>S: 服务器列表数据
    S-->>M: remote_mcp_server_list
    
    M-->>C: JSON响应 {remote_mcp_server_list: [...], status: "success"}
    
    Note over M,C: 错误情况下返回 400 状态码
```

### 5. 恢复远程MCP服务器 (GET /api/mcp/recover)

```mermaid
sequenceDiagram
    participant C as 前端客户端
    participant M as 主服务(5010)
    participant A as 认证系统
    participant S as MCP服务管理
    participant DB as 数据库
    participant MCP as MCP服务(5011)
    participant R as 远程MCP服务

    C->>M: GET /api/mcp/recover
    Note over C,M: Authorization: Bearer token
    
    M->>A: get_current_user_id(authorization)
    A-->>M: user_id, tenant_id
    
    M->>S: recover_remote_mcp_server(tenant_id)
    
    S->>DB: 查询租户的所有MCP服务器配置
    DB-->>S: 数据库中的服务器列表 (record_set)
    
    S->>MCP: GET /list-remote-proxies
    MCP-->>S: 当前MCP服务中的代理列表 (remote_set)
    
    S->>S: 计算差异 (record_set - remote_set)
    
    loop 对每个缺失的MCP服务器
        S->>S: add_remote_proxy(mcp_name, mcp_url)
        S->>MCP: POST /add-remote-proxies
        MCP->>R: 连接远程MCP服务
        R-->>MCP: 连接响应
        
        alt 添加成功
            MCP-->>S: 200 - 成功添加
        else 添加失败
            MCP-->>S: 错误响应
            S-->>M: 错误结果/JSONResponse
            M-->>C: 错误响应 (400)
            Note over S,M: 任一服务器恢复失败，整个操作失败
        end
    end
    
    S-->>M: 成功结果
    M-->>C: JSON响应 {message: "Successfully recovered", status: "success"}
```

## 时序图说明

### 接口分类

#### 1. 直接访问远程MCP服务的接口
- **GET /api/mcp/tools/**：直接通过工具配置服务访问远程MCP获取工具信息
- 特点：不经过本地MCP服务(5011)，直接连接外部MCP服务

#### 2. 经过本地MCP服务的接口  
- **POST /api/mcp/add**：通过MCP服务验证连接并添加代理
- **DELETE /api/mcp/**：通过MCP服务移除代理
- **GET /api/mcp/recover**：通过MCP服务恢复代理连接
- 特点：需要与本地MCP服务(5011)交互，涉及代理的生命周期管理

#### 3. 仅操作数据库的接口
- **GET /api/mcp/list**：直接查询数据库获取服务器列表
- 特点：最简单的流程，仅涉及数据库查询

### 通用流程特点
1. **认证流程**：除了工具查询接口，其他接口都需要Bearer token认证，通过`get_current_user_id()`获取用户和租户信息
2. **多租户隔离**：所有操作都基于`tenant_id`进行隔离，确保数据安全
3. **错误处理**：统一的异常处理机制，返回标准化的JSON错误响应
4. **代理架构**：主服务作为代理，协调各个后端服务的调用

### 关键交互点
- **认证系统**：验证用户身份和权限
- **数据库**：存储和管理MCP服务器配置信息
- **MCP服务(5011)**：处理MCP协议交互和代理管理
- **工具配置服务**：处理工具信息获取
- **远程MCP服务**：外部的MCP服务提供者

### 操作顺序重要性
- **添加操作**：先验证MCP连接，成功后才保存数据库（确保数据一致性）
- **删除操作**：先删除数据库记录，再移除MCP代理（防止数据残留）
- **恢复操作**：比较数据库与MCP服务差异，补充缺失的代理

## 安全特性

- **认证授权**：主服务支持Bearer token认证
- **多租户隔离**：不同租户的MCP服务器隔离管理
- **连接验证**：添加远程服务前进行连通性验证
