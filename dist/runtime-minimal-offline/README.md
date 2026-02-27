# Runtime Minimal Offline Bundle

这个目录是跨设备运行的最小离线集合，不需要在目标设备重新 `docker build`。

## 文件清单

- `nexent-local.tar`: 本地导出的离线镜像
- `docker-compose.yml`: 最小运行编排
- `.env.example`: 环境变量模板
- `start.bat`: 一键导入镜像并启动
- `check_health.bat`: 健康检查
- `web/`: 前端静态文件目录（挂载到容器，修改后刷新页面即可生效）

## 目标设备前置条件

- Windows + Docker Desktop（Linux 容器模式）
- `docker` 与 `docker compose` 命令可用
- 目标设备有足够磁盘空间（建议 > 2 GB）

快速确认:

```powershell
docker version
docker compose version
```

## 跨设备启动步骤

1. 将本目录完整拷贝到目标设备。
2. 在本目录打开终端，执行:

```powershell
start.bat
```

3. 启动后访问:
- `http://127.0.0.1:18080`

4. 健康检查:

```powershell
check_health.bat
```

预期输出包含:
- `StatusCode=200`
- `{"success":true,...}`

## 失败排查（重点）

1. 端口冲突
- 编辑 `.env`（可由 `.env.example` 复制），修改:
  - `WEB_PORT`
  - `MIXED_PORT`
  - `SOCKS_PORT`
- 然后执行:

```powershell
docker compose down
start.bat
```

2. 旧卷/旧配置污染（跨设备最常见）
- 在当前目录执行:

```powershell
docker compose down -v
start.bat
```

3. 镜像未正确导入
- 检查镜像是否存在:

```powershell
docker images nexent:local
```

- 若不存在，手动导入:

```powershell
docker load -i .\nexent-local.tar
```

4. 启动后不健康
- 查看容器状态:

```powershell
docker compose ps
```

- 查看最近日志:

```powershell
docker compose logs --tail 80
```

## 清理与重装

```powershell
docker compose down -v
docker image rm nexent:local
docker load -i .\nexent-local.tar
start.bat
```
