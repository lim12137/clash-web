# Compose Deployment Bundle

此目录用于“只拉取镜像，不在部署机二次构建”的部署方式。

## 文件说明

- `docker-compose.yml`：直接使用 `image:` 拉取 GHCR 镜像
- `.env.example`：可选环境变量模板

## 使用方式

1. 在本目录下准备环境变量文件：

   ```powershell
   Copy-Item .env.example .env
   ```

2. 按需修改 `.env`（如 `IMAGE_REF`、`ADMIN_TOKEN`、`CLASH_SECRET`、`CORE_UPDATE_ALLOWED_REPOS`）。
3. 拉取并启动：

   ```powershell
   docker compose pull
   docker compose up -d
   ```

4. 健康检查：

   ```powershell
   Invoke-WebRequest http://127.0.0.1/api/health
   ```

## 持久化说明

- `config_data`：持久化 mihomo 运行配置和备份
- `scripts_data`：持久化管理脚本与页面在线编辑内容
- `core_data`：持久化 mihomo 内核文件（`/opt/mihomo-core/mihomo`）

首次启动时，Docker 会将镜像内置的 `/scripts` 初始化到 `scripts_data` 卷中。
默认开启 `CORE_UPDATE_REQUIRE_CHECKSUM=1`，用于在线更新时强制校验 SHA256。
