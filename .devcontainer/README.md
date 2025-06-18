# Nexent Dev Container 使用指南

## 1. 环境说明

此开发容器配置了一个完整的 Nexent 开发环境，包含以下组件：

- 主要开发容器 (`nexent-dev`)：基于 nexent/nexent 镜像，添加了开发工具
- 服务容器：
  - Elasticsearch (`nexent-elasticsearch`)
  - PostgreSQL (`nexent-postgresql`)
  - MinIO (`nexent-minio`)
  - Nexent 后端 (`nexent`)
  - Nexent 前端 (`nexent-web`)
  - 数据处理服务 (`nexent-data-process`)

## 2. 使用步骤

### 2.1 准备工作

1. 安装 Cursor
2. 安装 Dev Containers 插件 (`ms-vscode-remote.remote-containers`)
3. 确保 Docker 和 Docker Compose 已安装并运行

### 2.2 使用 Dev Container 启动项目

1. 克隆项目到本地
2. 在 Cursor 中打开项目文件夹
3. 按下 `F1` 或 `Ctrl+Shift+P`，输入 `Dev Containers: Reopen in Container ...`
4. Cursor 将根据 `.devcontainer` 目录中的配置启动开发容器

### 2.3 开发工作流

1. 容器启动后，Cursor 会自动连接到开发容器
2. 所有文件编辑都在容器内完成
3. 进行开发、测试，修改完成后可以直接在容器内构建和运行

## 3. 容器内可用命令

开发容器中已配置以下便捷命令：

- `logs-nexent` - 查看 Nexent 后端日志
- `logs-web` - 查看 Nexent 前端日志
- `logs-data` - 查看数据处理服务日志

## 4. 端口映射

以下端口已在 devcontainer.json 中配置了映射：

- 3000: Nexent Web 界面
- 5010: Nexent 后端服务
- 5012: 数据处理服务
- 9010: MinIO API
- 9011: MinIO 控制台
- 9210: Elasticsearch API
- 5434: PostgreSQL

## 5. 自定义开发环境

您可以通过修改以下文件来自定义开发环境：

- `.devcontainer/devcontainer.json` - 插件配置项
- `.devcontainer/Dockerfile` - 开发容器构筑逻辑，安装开发工具和依赖
- `.devcontainer/.bashrc` - 添加别名

## 6. 常见问题解决

如果遇到权限问题，可能需要在容器内运行：

```bash
sudo chown -R $(id -u):$(id -g) /opt
```

如果容器启动失败，可以尝试：

1. 重建容器：按下 `F1` 或 `Ctrl+Shift+P`，输入 `Dev Containers: Rebuild Container`
2. 检查 Docker 日志：`docker logs nexent-dev`
3. 检查 `.env` 文件中的配置是否正确