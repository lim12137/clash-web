# 实施计划（内网单机 + 局域网代理）

## 元信息
- 最近更新: 2026-02-28
- 当前状态: 进行中（Docker 运行时代码覆盖问题已修复并推送，镜像回归通过；待确认是否清理 `dist/collected` 的历史镜像包与清单旧哈希）
- 使用技能: `planning-with-files`
- 归档:
  - `./task_plan.archive.20260227.md`
  - `./task_plan.archive.20260227.phase2.md`

## 前期摘要
- 2026-02-25 至 2026-02-27 已完成：
  - 管理面板、多订阅合并、覆写脚本与策略、定时任务、日志页重排、节点延迟测试；
  - gunicorn 启动链路修复、连接记录模块拆分与容器级回灌验证；
  - `api_server.py` 结构化分割调研与阶段化落地（公共层 + 多个服务层）。
- 历史细节已归档，主计划文件仅保留当前阶段与下一步，避免持续膨胀。

## 当前阶段执行（2026-02-27，Phase E：文档收尾与回归）

### 目标
- 同步 Phase C/Phase D 阶段结论到交付文档。
- 完成 `geo_service` 迁移后的收尾回归并沉淀提交证据。

### 已完成事项
1. Phase C 完成：`action_geo_update` 拆解为编排流程 + helper，行为不变。
2. Phase D 完成：新增 `scripts/api/services/geo_service.py`，`api_server.py` 改为注入并调用 `geo_service`。
3. 文档同步完成：`deliverable.md`、`notes.md` 已追加 Phase C/D 与 Phase E 回归结论。
4. 收尾回归完成：基础接口、`/api/actions/geo/update`、`import api_server; app` 兼容校验均通过。

### 验证结果
- 语法检查通过：
  - `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/api/services/geo_service.py scripts/api/services/__init__.py`
- 本地 API（19092）通过：
  - `GET /api/health`、`/api/status`、`/api/logs`、`/api/files`、`POST /api/actions/geo/update` 均 `200` 且 `success=true`
- 入口兼容通过：
  - `D:\py311\python.exe -c "import api_server; print('APP_BOOL', bool(api_server.app))"` 输出 `APP_BOOL True`

### 当前风险/观察
- `import api_server` 会输出运行时初始化日志（connection/provider/kernel），属于既有行为；未影响 `app` 可用性与接口回归结果。

## 下一步
1. 根据用户决策处理 `dist/collected`：保留双文件名镜像包，或清理为单一推荐包并重写 `MANIFEST.txt` 哈希。
2. 若继续结构化拆分，进入下一阶段路由蓝图化（按域迁移并逐组回归）。

## 当前阶段执行（2026-02-28，Docker 运行链路修复 + 镜像替换）

### 目标
- 解决容器启动时覆盖挂载 `scripts/` 导致的“非标回写”问题。
- 在 60 秒健康上限与 10 秒接口超时约束下完成 Docker 回归。
- 用更小可用镜像替换收集目录中的旧镜像包。

### 已完成事项
1. 修复运行链路覆盖问题：
   - `entrypoint.sh` 增加 `SYNC_RUNTIME_FROM_SEED` 开关，默认 `0`（不覆盖），`1` 强制同步。
   - `docker-compose.yml`、`docker-compose.base.yml` 增加 `SYNC_RUNTIME_FROM_SEED` 环境透传。
2. 新规则入库：
   - `AGENTS.md` 新增 Docker/API 超时约定（单接口 `<=10s`，健康等待 `<=60s`）。
3. 镜像与回归：
   - 本地重建并验证 `clash2web:rebuid`。
   - 默认开关日志出现 `skipped runtime seed sync`，强制开关日志出现 `synced runtime api code from seed`。
   - 代理与接口回归通过。
4. 代码提交与推送：
   - 提交 `320c2772`：`fix(docker): add seed sync toggle to prevent runtime overwrite`
   - 已推送到 `origin/rebuid`。

### 关键验证结果
- Docker 启动：
  - `docker build --pull=false -t clash2web:rebuid .` 成功
  - `docker compose -f docker-compose.yml up -d --pull never` 成功
- API 回归（均 `200` 且 `success=true`）：
  - `GET /api/health`、`/api/status`、`/api/logs`、`/api/files`
- 代理可用：
  - `curl -x http://127.0.0.1:27890 -I https://www.gstatic.com/generate_204 --max-time 10` 返回 `204`
- 配置迁移可用性：
  - 运行时 `api_server.py`/`settings.py` 保持 `get_config` 导入链路。

### 镜像替换记录（收集目录）
- 目录：`dist/collected/docker-chain-minimal-20260228_070013`
- 新旧体积对比：
  - 旧：`ghcr.io/lim12137/clash2web:latest` = `190846985`
  - 新：`clash2web:rebuid` = `158531388`
  - 差异：减少 `32315597`（约 `16.9%`）
- 替换结果：
  - `image.ghcr.io_lim12137_clash2web_latest.tar` 已改为新镜像导出内容（为兼容旧文件名）
  - `image.clash2web_rebuid.tar` 同步保留（推荐文件名）

### 当前阻塞/注意事项
- 工作区仍有未跟踪产物（`dist/collected/`、`dist/runtime-minimal-offline/nexent-local.tar`、本地临时文件），未纳入本次代码提交。
