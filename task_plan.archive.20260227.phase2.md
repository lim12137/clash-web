# 实施计划（内网单机 + 局域网代理）

## 元信息
- 最近更新: 2026-02-27
- 当前状态: 进行中（已完成“重构建 + 容器级联调 + /connections 回灌验证 + api_server 结构化分割调研 + 方案1公共层落地 + Phase 2 第三刀服务层拆分 + 重构2蓝图分析与计划整理 + Phase B `kernel_service` 拆分”）
- 使用技能: `planning-with-files`
- 归档: `./task_plan.archive.20260227.md`

## 前期摘要
- 2026-02-25 至 2026-02-27 已完成：管理面板、多订阅合并、脚本覆写、定时任务、日志页重排、节点延迟测试、gunicorn 启动链路修复、连接记录模块拆分。
- 关键历史细节已转存至归档文件：`./task_plan.archive.20260227.md`。
- 上一轮未完成项为“容器级联调与真实 `/connections` 数据回灌验证”。

## 本轮执行（2026-02-27）

### 目标
- 按“有更新，重新构建”要求重建本地镜像并完成上一轮未完成验证。

### 执行步骤
1. 重建镜像
   - `docker build --pull=false -t nexent:proxy-test .`
2. 启动容器
   - `$env:IMAGE_REF='nexent:proxy-test'; docker compose up -d --pull never`
3. 基础健康检查
   - `GET /api/health`
   - `GET /api/proxy-records/recorder`
   - `GET /api/proxy-records/stats`
4. 真实连接回灌验证
   - 通过 `27890` 发起代理请求到 `httpbin.org`（持续请求）
   - 对比 `type=connection` 记录前后数量

### 验证结果
- 容器 `clash-meta-manager` 状态：`Up ... (healthy)`。
- `/api/health`：成功返回。
- `/api/proxy-records/recorder`：`running=true`、`enabled=true`。
- `/api/proxy-records/stats`：`types.connection` 为 `3`（本轮前为 `2`）。
- 回灌对比：
  - `before_connection_count=2`
  - `after_connection_count=3`
  - `connection_delta=1`
  - 新增记录样本包含：`host=httpbin.org`、`type=connection`、`chains=[COMPATIBLE, Free-Auto, Proxy]`。

## 当前状态
- “容器级联调与真实 `/connections` 数据回灌验证”已完成。
- 运行环境当前可继续推进镜像发布与远程切回流程。

## 本轮执行补充（2026-02-27，`api_server` 结构化分割调研）

### 目标
- 对 `scripts/api_server.py` 做可落地的结构化拆分调研，输出分阶段改造方案。

### 执行步骤
1. 现状测绘
   - 统计函数与路由规模、超长函数、按路由域聚合行数。
2. 耦合分析
   - 抽取“路由 -> helper -> 全局状态”依赖映射。
   - 识别导入时副作用与线程启动风险点。
3. 输出落地方案
   - 形成目标目录结构、模块边界、迁移顺序、首个 PR 建议。

### 核心发现
- `scripts/api_server.py` 当前 `3095` 行，`62` 个路由处理器。
- 最大热点为 `action_geo_update`（`471` 行），其次为 provider/kernal/clash 相关流程。
- 存在“路由 + 业务 + IO + 外部请求 + 线程状态”同文件耦合，建议先抽公共层与服务层，再蓝图化路由。

### 产出物
- 调研文档：`./api_server_split_research.md`
- 计划与笔记、交付记录已同步更新（`task_plan.md`、`notes.md`、`deliverable.md`）。

## 本轮执行补充（2026-02-27，方案1落地 + 项目级默认执行规则）

### 目标
- 执行重构方案1（抽 `common` 公共层，不迁移路由，不改 URL/响应结构）。
- 将“默认执行 + 验收标准”固化到 `AGENTS.md`，覆盖全项目而非仅方案1。

### 执行步骤
1. 代码落地
   - 新增 `scripts/api/common/{responses.py,io.py,auth.py,logging.py}`。
   - 新增 `scripts/api/{app.py,settings.py}` 与 `scripts/api/__init__.py`。
   - `scripts/api_server.py` 改为 import 公共能力，保留路由与入口兼容。
2. 规则固化
   - 在 `AGENTS.md` 新增“默认执行约定（全项目）”和“验收标准（全项目）”。
3. 按标准回归
   - `D:\py311\python.exe -m py_compile ...`（覆盖改动文件）
   - `node --check web/app.js`
   - `D:\py311\python.exe scripts/merge.py merge`
   - `GET /api/health`、`GET /api/status`、`GET /api/logs`、`GET /api/files`

### 验证结果
- 语法检查通过（Python + JS）。
- merge 执行成功并写入 `config/config.yaml`。
- API 回归全部通过（4 个接口均 `HTTP 200` 且 `success=true`）。
- 兼容入口验证通过：`import api_server; api_server.app` 可用。

## 本轮执行补充（2026-02-27，Phase 2 首刀：`file_service`）

### 目标
- 在不改变 URL 的前提下启动服务层拆分，优先迁移低风险 `override.js` 校验逻辑。

### 执行步骤
1. 新增服务模块
   - `scripts/api/services/file_service.py`
   - `scripts/api/services/__init__.py`
2. 迁移逻辑
   - 将 `validate_js_override` 从 `api_server.py` 挪到 `file_service.py`。
   - `api_server.py` 改为调用服务层函数，并继续使用 `NODE_BIN/JS_VALIDATE_TIMEOUT` 参数。
3. 回归验证
   - Python/JS 语法检查。
   - `GET /api/health`、`GET /api/status`、`GET /api/logs`、`GET /api/files`。
   - `GET + PUT /api/override-script`（PUT 回写同内容，验证 JS 校验链路）。

### 验证结果
- 语法检查通过（含新增 `services/file_service.py`）。
- 基础 API 回归通过（4 个接口均 `HTTP 200` 且 `success=true`）。
- `PUT /api/override-script` 成功返回 `HTTP 200`、`success=true`，服务层调用链路正常。

## 本轮执行补充（2026-02-27，Phase 2 第二刀：`merge_service` + `clash_client`）

### 目标
- 在不变更 URL/响应结构的前提下，继续把 `api_server.py` 内的 merge/scheduler/reload 逻辑下沉到服务层。

### 执行步骤
1. 新增服务模块
   - `scripts/api/services/merge_service.py`
   - `scripts/api/services/clash_client.py`
2. 迁移逻辑
   - `clash_headers` 与 reload 安全路径回退逻辑迁移到 `clash_client`。
   - `default_schedule` / `schedule_history` / `run_merge_job` / `start_merge_job` / `scheduler_loop` 迁移到 `merge_service`。
   - `scripts/api_server.py` 保留同名函数作为薄封装，调用服务层，路由不变。
3. 服务包导出
   - 更新 `scripts/api/services/__init__.py` 导出 `MergeService`、`build_clash_headers`、`reload_clash_config`。
4. 按项目验收标准回归
   - Python 语法检查
   - 前端语法检查
   - merge 链路
   - 本地 API 回归（含本轮涉及接口）
   - 入口兼容验证
   - 容器同等回归（用户选择项 3）

### 验证结果
- 语法检查通过：
  - `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/api/services/clash_client.py scripts/api/services/merge_service.py scripts/api/services/file_service.py scripts/api/common/auth.py scripts/api/common/io.py scripts/api/common/logging.py scripts/api/common/responses.py scripts/api/app.py scripts/api/settings.py`
  - `node --check web/app.js`
- merge 链路通过：
  - `D:\py311\python.exe scripts/merge.py merge` 成功。
- 本地 API（19092）通过：
  - `GET /api/health`、`GET /api/status`、`GET /api/logs`、`GET /api/files` -> `200` 且 `success=true`
  - `GET /api/schedule`、`GET /api/schedule/history` -> `200` 且 `success=true`
  - `POST /api/actions/merge` -> `200` 且 `success=true`
  - `POST /api/actions/reload` -> `200` 且 `success=true`
- 入口兼容通过：
  - `D:\py311\python.exe -c "import api_server; print(bool(api_server.app))"` 输出 `True`。
- 容器回归通过：
  - `docker build --pull=false -t nexent:proxy-test .`
  - `$env:IMAGE_REF='nexent:proxy-test'; docker compose up -d --pull never --force-recreate`
  - 容器健康：`healthy`
  - `GET /api/health|status|logs|files`（18080）均 `200` 且 `success=true`
  - `PUT /api/override-script`（回写同内容）`200` 且 `success=true`
  - `docker top` 确认 gunicorn：`python3 -m gunicorn api_server:app ...`

## 本轮执行补充（2026-02-27，Phase 2 第三刀：`provider_service`）

### 目标
- 继续服务层拆分：迁移 provider 查询、状态持久化、自动恢复循环逻辑，保持 API 行为不变。

### 执行步骤
1. 新增 `scripts/api/services/provider_service.py`（`ProviderService`）。
2. `scripts/api_server.py` 注入 `provider_service`，并将以下函数改为薄封装：
   - `normalize_provider_name`
   - `default/sanitize/load/save_provider_recovery_state`
   - `build/fetch_provider_rows`
   - `refresh_provider_subscription`
   - `provider_auto_recovery_loop`
3. 更新 `scripts/api/services/__init__.py` 导出 `ProviderService`。

### 验证结果
- Python/前端语法：
  - `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/api/services/provider_service.py scripts/api/services/merge_service.py scripts/api/services/clash_client.py scripts/api/services/file_service.py scripts/api/services/__init__.py`
  - `node --check web/app.js`
- merge 链路：
  - `D:\py311\python.exe scripts/merge.py merge` 成功。
- 本地 API（19092）：
  - `GET /api/health|status|logs|files|clash/providers` 均 `200` 且 `success=true`。
- 入口兼容：
  - `D:\py311\python.exe -c "import api_server; print(bool(api_server.app))"` 输出 `True`。
- 容器回归（18080）：
  - `docker build --pull=false -t nexent:proxy-test .`
  - `$env:IMAGE_REF='nexent:proxy-test'; docker compose up -d --pull never --force-recreate`
  - `GET /api/health|status|logs|files|clash/providers` 均 `200` 且 `success=true`
  - 容器健康 `healthy`，`docker top` 显示 gunicorn 正常运行。

## 本轮执行补充（2026-02-27，Phase B：`kernel_service`）

### 目标
- 按 `refactor2_plan.md` 将 kernel 更新相关 helper 与流程下沉到服务层，`api_server.py` 保留路由与同名薄封装。

### 执行步骤
1. 新增服务模块
   - `scripts/api/services/kernel_service.py`（`KernelService`）。
2. 迁移逻辑
   - 将 `normalize_core_repo`、`ensure_core_repo_allowed`、`detect_core_arch`、`fetch_core_release`、`select_core_release_asset`、`read_core_version`、`verify_core_binary`、`collect_kernel_status`、`perform_kernel_update`、kernel 更新历史读写下沉到 `KernelService`。
   - `scripts/api_server.py` 对应函数改为服务层薄封装，`/api/kernel/*` 与 `/api/actions/kernel/update` 路由保持不变。
3. 服务包导出
   - `scripts/api/services/__init__.py` 导出 `KernelService`。
4. 按验收模板回归
   - Python/前端语法 + merge 链路 + 本地 API 关键接口 + 入口兼容。

### 验证结果
- 语法检查通过：
  - `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/api/services/kernel_service.py scripts/api/services/__init__.py scripts/api/services/merge_service.py scripts/api/services/provider_service.py scripts/api/services/file_service.py`
  - `node --check web/app.js`
- merge 链路通过：
  - `D:\py311\python.exe scripts/merge.py merge` 成功。
- 本地 API（19092）通过：
  - `GET /api/health|status|logs|files|kernel/status|kernel/updates?limit=5` 均 `200` 且 `success=true`。
  - `GET /api/kernel/release/latest` 在当前环境返回 `500`（上游 release 查询失败，非本次结构迁移引入）。
- 入口兼容通过：
  - `D:\py311\python.exe -c "import api_server; print(bool(api_server.app))"` 输出 `True`。

## 下一步
1. 按 `./refactor2_plan.md` 执行 Phase C：拆解 `action_geo_update` 为编排函数 + 可复用 helper（保持 URL/响应不变）。
2. 执行 Phase D：落地 `services/geo_service.py`，并做 `_` 私有命名收口与兼容别名评估。
3. 每阶段均按 `refactor2_plan.md` 的验收模板回归并记录到 `deliverable.md`。
