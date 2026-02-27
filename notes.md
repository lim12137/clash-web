# 实施笔记（管理前端 + 多订阅合并）

## 需求拆解
- 管理前端：可视化管理订阅、节点切换、日志和文件编辑。
- 节点切换：通过 Clash `/proxies` 接口查询组并切换当前节点。
- 脚本覆写：在线编辑 `override.yaml` 与 `site_policy.yaml`，参与合并输出。
- 多订阅合并：从 `subscriptions.json` 拉取多个订阅，清洗后合并写入 `config.yaml`。
- 脚本在线修改：在线编辑 `merge.py`，并支持语法校验与备份。

## 内网单机场景设计
- 对外提供 `80`（管理界面）和 `7890/7891`（代理端口）。
- `9090` Clash API 不对局域网直接暴露，统一由后端与 Nginx 内部访问。
- 预留可选管理令牌 `ADMIN_TOKEN`，默认可不启用，便于纯内网快速使用。

## 文件规划
- 容器与入口: `docker-compose.yml`, `Dockerfile`, `entrypoint.sh`, `nginx.conf`
- 核心脚本: `scripts/api_server.py`, `scripts/merge.py`
- 配置文件: `scripts/subscriptions.json`, `scripts/template.yaml`, `scripts/override.yaml`, `scripts/override.js`, `scripts/site_policy.yaml`
- 前端页面: `web/index.html`, `web/style.css`, `web/app.js`
- 文档: `README.md`

## 新增适配
- 支持 `jiaoben.txt` 风格 JS 覆写脚本（`const main = (config) => { ...; return config; }`）。
- `merge.py` 在输出前执行 `override.js`，可改写 `proxy-providers` / `rule-providers` / `proxy-groups` / `rules`。
- `api_server.py` 新增 `GET/PUT /api/override-script`，保存时做 JS 语法和 `main(config)` 检查。
- 新增两组订阅集合配置：`GET/PUT /api/subscription-sets`，写入 `scripts/subscription_sets.json`。
- 保存订阅集合后，会自动更新 `override.js` 头部常量:
  - `SUB_SET1` / `SUB_SET2`
  - `SUB_SET1_URLS` / `SUB_SET2_URLS`
- 新增定时任务配置：`GET/PUT /api/schedule`，后台线程按间隔触发“合并+重载”。
- 前端订阅集合输入已从“文本框”改为“表格增删行”。
- 新增调度历史：`GET/DELETE /api/schedule/history` + `scripts/schedule_history.json` 持久化。
- `override.js` 已迁移为接近 `jiaoben.txt` 的完整规则架构，并把订阅 URL 常量改为集合变量:
  - 付费: `SUB_SET1` / `SUB_SET1_URLS`
  - 免费: `SUB_SET2` / `SUB_SET2_URLS`

## 增量笔记（2026-02-25 晚间）

### 页面结构与模块归属
- 左侧导航已启用真实页面切换逻辑（非单页堆叠）。
- 未新增模块，仅调整归属。
- “定时执行历史”已从仪表盘迁移到“日志”页。
- “日志”页为双栏：`定时执行历史` + `运行日志`。

### 配置编辑体验
- `#editor` 高度提升，适合长脚本编辑。
- 移动端使用视口高度兜底，避免输入区过矮。

### 延迟测试（非测速）
- 新增后端接口：`POST /api/clash/proxies/delay`。
- 默认测试目标 URL：`http://www.gstatic.com/generate_204`。
- 前端单次测试超时：`5000ms`。
- 批量测试按并发 5 路执行，减少阻塞。
- 节点延迟显示规则：
  - `null` -> `测试中...`
  - `-1` -> `超时`
  - `>=0` -> `${delay} ms`
- 节点切换右上新增手动“测延时”按钮；测试中禁用防重复点击。

## 增量笔记（2026-02-27）

### 路由与启动链路
- `scripts/api_server.py` 已修复结构性问题（缩进错误、重复启动块、初始化位置）。
- 初始化改为 `start_runtime_services()`，兼容 gunicorn 的模块导入方式。
- `entrypoint.sh` 已改为 `\"${PYTHON_BIN}\" -m gunicorn api_server:app`。
- `Dockerfile` 已补充 `gunicorn` 安装。

### 镜像与验证结论
- 接口回归已通过：`/api/health`、`/api/proxy-records*`、`/api/status`、`/`。
- 远程 `ghcr.io/lim12137/clash2web:latest`（`dd4737a2dd4b`）仍是旧入口脚本，容器中实际运行 Flask dev server。
- 本地可用镜像：`nexent:proxy-test`、`nexent:proxy-test-arg`（`621b9f179824`）。
- 本地代理构建脚本：`scripts/build_with_proxy.bat`（会先 pull 镜像站 alpine，再本地 build）。

## 增量笔记（2026-02-27 本地镜像部署回归）

### 关键发现
- 按“下一步”使用 `IMAGE_REF=nexent:proxy-test` 回归时，容器持续重启。
- `docker logs` 报错：`exec /entrypoint.sh: no such file or directory`。
- 根因为 `entrypoint.sh` 被 CRLF 破坏 shebang 解析（`/bin/sh\r`）。

### 修复与防回归
- 将 `entrypoint.sh` 统一为 LF。
- 新增 `.gitattributes`：`*.sh text eol=lf`，防止再次写入 CRLF。
- 重建镜像：`docker build --pull=false -t nexent:proxy-test .`。

### 回归结论
- `docker compose up -d --pull never` 启动成功，容器状态 `healthy`。
- `GET /api/health`、`GET /api/proxy-records`、`POST /api/proxy-records`、`GET /api/proxy-records/stats`、`GET /api/status`、`GET /` 全部 200。
- 容器内 API 进程确认为 `python3 -m gunicorn api_server:app ...`。

## 增量笔记（2026-02-27 连接记录模块化）

### 拆分策略
- 目标是避免 `api_server.py` 继续膨胀，记录与采样能力放入独立模块。
- 新建 `scripts/connection_recorder.py`：
  - `ProxyRecordStore`: 负责 `proxy_records.json` 线程安全读写、筛选、统计。
  - `ClashConnectionRecorder`: 负责轮询 `CLASH_API/connections`，提取连接元数据并合并入库。

### 字段映射（连接 -> 记录）
- 软件：`metadata.process / processName / process_name` -> `app_name`
- 软件路径：`metadata.processPath / process_path` -> `process_path`
- 网址：`metadata.host / sniffHost / sniff_host` -> `host`
- 目标地址：`metadata.remoteDestination` 或 `destinationIP:destinationPort` -> `destination`
- 规则：`rule` / `rulePayload`
- 节点链路：`chains`（末尾作为 `target_node`，首段作为 `group_name`）
- 流量：`upload` / `download`

### 合并去重策略
- 活跃连接去重：按 `connection id + fingerprint` 判断是否变化，未变化不重复落盘。
- 历史记录合并：按 `merge_key` 合并累计（`hit_count`、最大流量、最新时间）。
- 记录总量上限：`MAX_PROXY_RECORDS`（默认 1000）。

### API 接入变化
- `api_server.py` 仅做路由层调用：
  - `GET /api/proxy-records`（支持 keyword / subscription / type / app / host / limit）
  - `POST /api/proxy-records`
  - `DELETE /api/proxy-records/<id>`
  - `POST /api/proxy-records/clear`
  - `GET /api/proxy-records/stats`
  - `POST /api/proxy-records/capture`
  - `GET /api/proxy-records/recorder`

### 前端变化
- `web/index.html`：新增 `软件`、`网址` 两列，类型增加 `connection`。
- `web/app.js`：`connection` 类型显示 `↑upload ↓download`，其他类型继续显示延迟。

## 增量笔记（2026-02-27 重新构建与连接回灌验证）

### 触发原因
- 用户反馈“有更新，要重新构建”，需要在新镜像上执行上一轮待办的容器级联调。

### 执行动作
- 重建镜像：`docker build --pull=false -t nexent:proxy-test .`
- 重新部署：`$env:IMAGE_REF='nexent:proxy-test'; docker compose up -d --pull never`
- 健康检查：
  - `GET /api/health`
  - `GET /api/proxy-records/recorder`
  - `GET /api/proxy-records/stats`

### `/connections` 回灌验证
- 基线：`type=connection` 记录数 `2`。
- 操作：通过本机混合端口 `27890` 代理访问 `httpbin.org` 持续请求。
- 结果：`type=connection` 记录数增至 `3`，`connection_delta=1`。
- 新增记录样本：
  - `host=httpbin.org`
  - `type=connection`
  - `chains=[COMPATIBLE, Free-Auto, Proxy]`

### 结论
- 连接采样器在容器环境中可正常回灌真实连接数据。
- 当前镜像 `nexent:proxy-test` 运行健康，可继续推进镜像发布与远程切换验证。

## 增量笔记（2026-02-27 `api_server.py` 结构化分割调研）

### 基线统计
- 目标文件：`scripts/api_server.py`
- 规模：`3095` 行、`140` 个函数、`62` 个路由处理器
- 路由热点：
  - `actions/*` 约 `553` 行（含 `/api/actions/geo/update`）
  - `clash/*` 约 `466` 行
  - `subscriptions/*` 约 `132` 行
- 超长函数：
  - `action_geo_update`（`471` 行）
  - `provider_auto_recovery_loop`（`124` 行）
  - `_geo_proxy_check`（`112` 行）

### 耦合画像
- 全局常量和运行时状态集中在单文件：
  - `Path` 常量、并发锁、日志队列、`connection_recorder` 指针混合定义。
- HTTP 路由与业务实现混写：
  - 参数解析、调用 Clash API、文件读写、结果聚合在同一函数中完成。
- 导入时副作用：
  - `start_runtime_services()` 在模块导入时启动后台线程，拆分时需确保幂等与单实例语义不变。

### 建议拆分边界
- `common/*`：`json_error`、`require_write_auth`、`emit_log`、`load/save` 工具。
- `services/*`：
  - `kernel_service`（核心更新链路）
  - `merge_service`（merge/reload/scheduler）
  - `provider_service`（provider 查询与自愈）
  - `geo_service`（geo check/update）
  - `file_service`（可编辑文件校验与写入）
- `routes/*`：按 API 域拆蓝图，保持 URL 和 JSON 返回结构不变。

### 迁移顺序（低风险）
1. 抽公共层，不迁移路由。
2. 抽服务层，先 kernel/merge/provider，再处理 geo。
3. 蓝图化路由，按域逐组迁移并逐组回归。
4. `api_server.py` 收敛为兼容入口（保持 `gunicorn api_server:app`）。

### 产出
- 详细调研文档：`api_server_split_research.md`

## 增量笔记（2026-02-27 方案1落地与项目级规则固化）

### 方案1落地（公共层抽离）
- 新增包结构：
  - `scripts/api/common/responses.py`
  - `scripts/api/common/io.py`
  - `scripts/api/common/auth.py`
  - `scripts/api/common/logging.py`
  - `scripts/api/app.py`
  - `scripts/api/settings.py`
- `scripts/api_server.py` 已切换为 import 公共能力：
  - `json_error`
  - `require_write_auth`（含 `configure_write_auth(ADMIN_TOKEN)`）
  - `emit_log` 与日志 SSE 队列读写
  - `load/save/read/write/make_backup`
- 路由仍保持在 `api_server.py`，URL 与响应结构未变。

### 全项目默认执行与验收标准
- 已在 `AGENTS.md` 固化为全项目规则（不再限定方案1）：
  - 默认执行：输入“执行/继续/默认执行”时直接落地改动并自检。
  - 编号执行：`执行1` 优先匹配当轮清单，其次 `task_plan.md` 下一步。
  - 验收按场景分层：通用、merge链路、API、部署、UI。

### 本轮回归结果
- 语法检查：
  - `D:\py311\python.exe -m py_compile ...`（含新增 `scripts/api/*`）通过。
  - `node --check web/app.js` 通过。
- merge 链路：
  - `D:\py311\python.exe scripts/merge.py merge` 成功，`config/config.yaml` 正常生成。
- API 链路（本地 19092）：
  - `GET /api/health` -> `200`, `success=true`
  - `GET /api/status` -> `200`, `success=true`
  - `GET /api/logs` -> `200`, `success=true`
  - `GET /api/files` -> `200`, `success=true`

## 增量笔记（2026-02-27 Phase 2 首刀：`file_service`）

### 目标
- 以最小风险启动服务层拆分，不动 URL，不动路由注册顺序。

### 代码变化
- 新增：
  - `scripts/api/services/file_service.py`
  - `scripts/api/services/__init__.py`
- 迁移：
  - `validate_js_override` 从 `scripts/api_server.py` 挪到 `scripts/api/services/file_service.py`。
  - `api_server.py` 改为 import 并传入 `node_bin=NODE_BIN`、`timeout=JS_VALIDATE_TIMEOUT`。

### 回归结果
- `D:\py311\python.exe -m py_compile ...`（包含 `services/file_service.py`）通过。
- `node --check web/app.js` 通过。
- 基础接口：
  - `GET /api/health` -> `200`, `success=true`
  - `GET /api/status` -> `200`, `success=true`
  - `GET /api/logs` -> `200`, `success=true`
  - `GET /api/files` -> `200`, `success=true`
- 关键变更接口：
  - `PUT /api/override-script`（回写同内容）-> `200`, `success=true`

## 增量笔记（2026-02-27 Phase 2 第二刀：`merge_service` + `clash_client`）

### 拆分目标
- 继续把 `api_server.py` 从“路由 + 业务 + 并发调度”中解耦，优先抽离低风险的 merge/scheduler/reload 能力。
- 维持 `api_server:app` 入口、URL 和 JSON 结构不变。

### 代码变化
- 新增服务模块：
  - `scripts/api/services/merge_service.py`
  - `scripts/api/services/clash_client.py`
- 更新导出：
  - `scripts/api/services/__init__.py`
- `api_server.py` 改造：
  - `clash_headers()` 改为调用 `build_clash_headers(CLASH_SECRET)`。
  - `reload_clash()` 改为调用 `reload_clash_config(...)`。
  - `default_schedule` / `sanitize_schedule` / `load/save_schedule` / `history` / `run_merge_job` / `start_merge_job` / `scheduler_loop` 改为服务层薄封装。

### 行为一致性
- reload 逻辑保持原行为：
  - 先尝试 `CLASH_RELOAD_PATH`
  - 再尝试主 `CONFIG_FILE`
  - 失败时解析 Clash 返回的 `allowed paths` 做安全路径回退
- scheduler 行为保持原行为：
  - 5 秒轮询
  - 运行中冲突返回 `skipped_busy`
  - 继续写入 `schedule_history.json`

### 回归结果
- 语法：
  - `D:\py311\python.exe -m py_compile ...`（覆盖新增服务和改动文件）通过。
  - `node --check web/app.js` 通过。
- merge：
  - `D:\py311\python.exe scripts/merge.py merge` 成功。
- 本地 API（19092）：
  - `GET /api/health|status|logs|files` 均 `200 + success=true`
  - `GET /api/schedule`、`GET /api/schedule/history` 均 `200 + success=true`
  - `POST /api/actions/merge`、`POST /api/actions/reload` 均 `200 + success=true`
- 入口兼容：
  - `import api_server; api_server.app` 可用。
- 容器回归（18080）：
  - `docker build --pull=false -t nexent:proxy-test .`
  - `docker compose up -d --pull never --force-recreate`
  - `GET /api/health|status|logs|files` 均 `200 + success=true`
  - `PUT /api/override-script`（回写同内容）`200 + success=true`
  - `docker top` 确认 gunicorn 进程运行。

## 增量笔记（2026-02-27 Phase 2 第三刀：`provider_service`）

### 拆分目标
- 把 provider 相关“查询 + 自愈循环 + 状态持久化”从 `api_server.py` 下沉到服务层。

### 代码变化
- 新增：
  - `scripts/api/services/provider_service.py`（`ProviderService`）
- 更新：
  - `scripts/api/services/__init__.py`（导出 `ProviderService`）
  - `scripts/api_server.py`（注入 `provider_service` + 薄封装）
- 迁移函数：
  - `normalize_provider_name`
  - `default/sanitize/load/save_provider_recovery_state`
  - `build/fetch_provider_rows`
  - `refresh_provider_subscription`
  - `provider_auto_recovery_loop`

### 行为保持
- `/api/clash/providers` 返回结构不变。
- 自动恢复循环判定逻辑不变：
  - `vehicle_type=http` 才触发刷新
  - 连续 `alive_count=0` 达到阈值后尝试刷新
  - 每 provider 每日刷新次数上限保持 `PROVIDER_AUTO_REFRESH_MAX_PER_DAY`

### 回归结果
- `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/api/services/provider_service.py ...` 通过。
- `node --check web/app.js` 通过。
- `D:\py311\python.exe scripts/merge.py merge` 成功。
- 本地 API（19092）：
  - `GET /api/health|status|logs|files|clash/providers` 均 `200 + success=true`。
- 兼容入口：
  - `import api_server; api_server.app` 可用。
- 容器回归（18080）：
  - `GET /api/health|status|logs|files|clash/providers` 均 `200 + success=true`。
  - 容器 `healthy`，gunicorn 正常运行。

## 增量笔记（2026-02-27：`重构2.txt` 分析）

### 输入与对照
- 分析文件：`重构2.txt`（`3099` 行，`127363` bytes）。
- 与 `scripts/api_server.py` 对照：
  - 路由装饰器数量一致：`62 -> 62`。
  - `git diff --no-index --shortstat`：`1 file changed, 1983 insertions(+), 1901 deletions(-)`。
  - `action_geo_update` 体量对比：
    - 当前：约 `473` 行（含多个内联 helper）
    - 重构稿：约 `57` 行（编排式）

### 结构结论
- `重构2.txt` 核心价值是“流程拆解思路”，不适合直接全量替换：
  - 一次性改动面过大（近 4k 行 churn），回归成本高。
  - 包含命名收口（大量 `_` 私有化），需要兼容策略。
- 适合作为下一阶段拆分蓝图：
  - 先 `kernel_service`，再 `geo` 拆解，再 `geo_service` 下沉。

### 阻塞点
- `重构2.txt` 非纯 Python 文件（含说明文字 + 代码围栏）。
- 提取代码块后语法检查失败：
  - `D:\py311\python.exe -m py_compile tmp_refactor2_extracted.py`
  - 失败点：字符串 `// 自动生成区块：请在管理面板的"订阅集合"里维护，不建议手工改这里。` 引号未转义。

### 产出
- 新增计划文件：`./refactor2_plan.md`
- `task_plan.md` 已更新“下一步”并对齐该计划。

## 增量笔记（2026-02-27 Phase B：`kernel_service`）

### 拆分目标
- 按 `refactor2_plan.md` 将 kernel 更新链路从 `api_server.py` 下沉到服务层。
- 保持 `api_server:app` 入口、路由 URL 和 JSON 响应结构不变。

### 代码变化
- 新增：
  - `scripts/api/services/kernel_service.py`（`KernelService`）
- 更新：
  - `scripts/api/services/__init__.py`（导出 `KernelService`）
  - `scripts/api_server.py`（注入 `kernel_service` + 同名薄封装）
- 下沉函数族：
  - `normalize_core_repo` / `ensure_core_repo_allowed` / `detect_core_arch`
  - `fetch_core_release` / `select_core_release_asset`
  - `read_core_version` / `verify_core_binary`
  - `collect_kernel_status` / `perform_kernel_update`
  - kernel 更新历史读写与重启调度

### 行为保持
- `/api/kernel/status`、`/api/kernel/updates`、`/api/actions/kernel/update` 保持原路径与返回结构。
- `api_server.py` 仍保留同名函数，外部调用兼容性维持。
- kernel 更新锁和重启锁继续由 API 入口注入，线程语义不变。

### 回归结果
- `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/api/services/kernel_service.py scripts/api/services/__init__.py scripts/api/services/merge_service.py scripts/api/services/provider_service.py scripts/api/services/file_service.py` 通过。
- `node --check web/app.js` 通过。
- `D:\py311\python.exe scripts/merge.py merge` 成功。
- 本地 API（19092）：
  - `GET /api/health|status|logs|files|kernel/status|kernel/updates?limit=5` 均 `200 + success=true`。
  - `GET /api/kernel/release/latest` 当前返回 `500`（`unsupported linux arch: unknown`，本地回归环境非 Linux 容器）。
- 入口兼容：
  - `D:\py311\python.exe -c "import api_server; print(bool(api_server.app))"` 输出 `True`。

## 增量笔记（2026-02-27 Phase C：`action_geo_update` 拆解）

### 拆分目标
- 把 `/api/actions/geo/update` 从超长路由函数改为可读的编排式流程。
- 在不改 URL/返回结构的前提下，把 GEO 子步骤拆成独立 helper，降低维护成本。

### 代码变化
- 文件：`scripts/api_server.py`
- 主要调整：
  - `action_geo_update` 收敛为“参数解析 -> 代理检查 -> GEO DB 更新 -> rule-provider 更新 -> 统一结果组装”。
  - GEO 相关步骤抽离为独立 helper（代理检测、变更判断、GEO 文件更新、rule-provider 更新、结果拼装）。
  - 将通用请求重试与错误文本提取逻辑整理为复用 helper，避免重复内联。

### 行为保持
- `POST /api/actions/geo/update` 路由与入参保持不变。
- `success/message/check_proxy/geo_db/rule_providers` 等核心返回字段保持不变。
- 兼容 `check_proxy=false, update_geo_db=false, update_rule_providers=false` 的空操作模式。

### 回归结果
- `D:\py311\python.exe -m py_compile scripts/api_server.py` 通过。
- 本地 API（19092）：
  - `GET /api/health|status|logs|files` 均 `200 + success=true`。
  - `POST /api/actions/geo/update`（空操作参数）返回 `200 + success=true`。

## 增量笔记（2026-02-27 Phase D：`geo_service` 服务化）

### 拆分目标
- 将 Phase C 提取出的 GEO 业务逻辑继续下沉到服务层，进一步减薄 `api_server.py`。
- 保持 `api_server:app` 入口、路由和响应契约不变。

### 代码变化
- 新增：
  - `scripts/api/services/geo_service.py`（`GeoService`）
- 更新：
  - `scripts/api/services/__init__.py`（导出 `GeoService`）
  - `scripts/api_server.py`（注入 `geo_service` 并改为薄封装调用）
- 服务承接内容：
  - Clash delay/request 调用包装与重试。
  - rule-provider 列表读取与更新执行。
  - GEO 数据变更推断、摘要格式化、最终结果组装。

### 兼容策略
- `api_server.py` 中原 GEO helper 名称保留，内部委托到 `geo_service`。
- 保持外部调用面稳定，减少重构期连锁影响。

### 回归结果
- `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/api/services/geo_service.py scripts/api/services/__init__.py` 通过。
- 本地 API（19092）：
  - `GET /api/health|status|logs|files` 均 `200 + success=true`。
  - `POST /api/actions/geo/update`（空操作参数）返回 `200 + success=true`。
- 入口兼容：
  - `D:\py311\python.exe -c "import api_server; print('APP_BOOL', bool(api_server.app))"` 输出 `APP_BOOL True`（伴随初始化日志）。
