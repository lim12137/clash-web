# clash-web

一个面向内网/局域网场景的 Clash 管理面板，集成了以下能力：

- Web 管理界面（订阅、分组切换、日志、计划任务）
- 多订阅拉取与合并（`scripts/merge.py`）
- 配置覆写链路（`template.yaml` -> `site_policy.yaml` -> `override.yaml` -> `override.js`）
- 订阅集合管理（集合1/集合2）并自动注入 `override.js` 头部
- 定时执行“合并并重载”，并记录执行历史

## 架构

- `nginx`：对外提供页面与 API 反向代理（端口 `80`）
- `api_server.py`（Flask）：管理接口（容器内 `9092`）
- `mihomo`：代理核心（控制接口 `9090`，代理端口 `7890/7891`）

## 快速启动

前提：

- 已安装 Docker 与 Docker Compose
- 当前目录包含本仓库文件

启动命令：

```powershell
docker compose up -d --build
```

可选环境变量（Windows PowerShell 示例）：

```powershell
$env:CLASH_SECRET = "change_me"
$env:ADMIN_TOKEN = "change_me_too"
docker compose up -d --build
```

访问与代理端口：

- 管理面板：`http://<主机IP>/`
- HTTP 代理：`<主机IP>:7890`
- SOCKS5 代理：`<主机IP>:7891`

## 目录说明

- `docker-compose.yml`：单容器部署定义
- `Dockerfile`：构建镜像（Alpine + mihomo + Python + nginx + node）
- `entrypoint.sh`：初始化默认配置并启动各进程
- `nginx.conf`：前端静态资源、API 反代、SSE 配置
- `web/`：管理前端（`index.html`、`app.js`、`style.css`）
- `scripts/api_server.py`：管理 API
- `scripts/merge.py`：订阅合并核心逻辑
- `scripts/subscriptions.json`：订阅源列表
- `scripts/subscription_sets.json`：订阅集合（`set1`/`set2`）
- `scripts/schedule.json`：定时任务配置
- `scripts/schedule_history.json`：定时任务执行历史
- `scripts/template.yaml`：基础模板
- `scripts/site_policy.yaml`：站点分流策略
- `scripts/override.yaml`：YAML 覆写
- `scripts/override.js`：JS 覆写脚本（必须定义 `main(config)`）
- `config/`：mihomo 运行目录与备份目录（挂载持久化）

## 页面功能

- 运行操作：仅合并、仅重载、合并并重载
- 订阅管理：新增、编辑、启停、测试、删除
- 订阅集合：两套表格维护，支持批量导入
- 节点切换：读取 Clash 代理组并切换当前节点
- 配置编辑：在线编辑 `override.js`、`override.yaml`、`site_policy.yaml`、`merge.py`
- 定时任务：间隔执行（5-1440 分钟）
- 执行历史：支持筛选（仅 scheduler / 仅失败）
- 实时日志：SSE 推送任务日志

## 推荐使用流程

1. 在“订阅管理”维护每个订阅源，先测试可用性。
2. 在“订阅集合”维护 `set1`（付费）和 `set2`（免费）。
3. 在 `override.js` 中使用自动注入变量：
   `SUB_SET1`、`SUB_SET2`、`SUB_SET1_URLS`、`SUB_SET2_URLS`。
4. 在 `site_policy.yaml` 添加域名规则和自定义组。
5. 点击“合并并重载”验证最终配置。
6. 在“定时任务”启用自动执行。

## 配置与脚本校验

- 修改 `override.yaml`、`site_policy.yaml`、`template.yaml` 时会做 YAML 语法校验
- 修改 `merge.py` 时会做 Python 语法校验
- 修改 `override.js` 时会校验 `main(config)` 是否可执行
- 写入前会自动备份旧文件到 `config/backups`（容器内 `/root/.config/mihomo/backups`）

## API 概览

健康与状态：

- `GET /api/health`
- `GET /api/status`

订阅与集合：

- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `PUT /api/subscriptions/<name>`
- `DELETE /api/subscriptions/<name>`
- `POST /api/subscriptions/<name>/toggle`
- `POST /api/subscriptions/<name>/test`
- `GET /api/subscription-sets`
- `PUT /api/subscription-sets`

执行与计划：

- `POST /api/actions/merge`
- `POST /api/actions/reload`
- `POST /api/actions/merge-and-reload`
- `GET /api/schedule`
- `PUT /api/schedule`
- `GET /api/schedule/history`
- `DELETE /api/schedule/history`

Clash 交互：

- `GET /api/clash/status`
- `GET /api/clash/groups`
- `POST /api/clash/groups/<group_name>/select`

文件与备份：

- `GET /api/override` / `PUT /api/override`
- `GET /api/override-script` / `PUT /api/override-script`
- `GET /api/site-policy` / `PUT /api/site-policy`
- `GET /api/template` / `PUT /api/template`
- `GET /api/merge-script` / `PUT /api/merge-script`
- `GET /api/files`
- `GET /api/files/<key>` / `PUT /api/files/<key>`
- `GET /api/backups`
- `DELETE /api/backups/<name>`
- `POST /api/backups/<name>/restore`

日志：

- `GET /api/logs`
- `GET /api/logs/stream`（SSE）

## 安全说明

- 设置 `ADMIN_TOKEN` 后，所有写操作都需要令牌。
- 设置 `CLASH_SECRET` 后，后端访问 mihomo 控制接口会自动带鉴权头。
- 若在公网部署，请额外加入口访问控制和 HTTPS，避免直接裸露管理面板。

## 常见问题

1. 页面能打开但操作报 `Unauthorized`
   说明已配置 `ADMIN_TOKEN`，请在页面顶部输入正确令牌后保存。

2. 合并成功但切换节点失败
   请检查 `CLASH_SECRET` 是否与运行中的 mihomo 一致。

3. 订阅可访问但节点数为 0
   可能是订阅内容不含 `proxies` 字段，或被 `include_filter` / `exclude_filter` 过滤掉。
