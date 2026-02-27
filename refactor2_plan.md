# `重构2.txt` 分析与重构落地计划（2026-02-27）

## 1. 输入与结论

- 输入文件：`重构2.txt`（`127363` bytes，`3099` 行）。
- 与当前 `scripts/api_server.py` 对比：
  - 路由数量一致：`62 -> 62`（接口面基本不变）。
  - 差异规模很大：`+1983 / -1901`（不适合一次性替换）。
- 关键结构变化（来自 `重构2.txt`）：
  - 增加 `_env_int/_env_bool/_env_float` 环境变量解析助手。
  - `action_geo_update` 从超长流程改为编排函数，拆分为 `_perform_geo_db_update`、`_update_rule_providers`、`_compose_geo_update_result` 等。
  - `clash_request_with_retry`、`response_error_text` 上移为模块级复用函数。
  - 大量内部 helper 改为 `_` 前缀私有命名。
- 风险结论：
  - 不建议直接全量替换 `api_server.py`。
  - 应采用“按域拆分 + 行为对齐回归”的渐进迁移。

## 2. 发现的阻塞点（必须先处理）

- `重构2.txt` 是“说明 + ```python 代码块”的混合文档，不可直接作为 `.py` 文件。
- 提取代码块后语法检查失败（`line 1157`）：
  - 字符串中包含未转义引号：`"订阅集合"`，导致 `SyntaxError`。
- 结论：`重构2.txt` 可作为“重构蓝图”，不能作为“可直接落地代码”。

## 3. 落地原则

- 保持 API 入口兼容：`import api_server; api_server.app` 不变。
- 保持 URL 与响应结构不变（先结构重构，后行为增强）。
- 每阶段只改一个能力域，单阶段可独立回滚。
- 每阶段完成后按项目验收标准执行回归。

## 4. 分阶段计划

### Phase A：基线冻结与对照样本（0.5 天）

- 固化当前行为样本（重点接口）：
  - `/api/health`、`/api/status`、`/api/logs`、`/api/files`
  - `/api/clash/geo/check`、`/api/actions/geo/update`
  - `/api/kernel/status`、`/api/actions/kernel/update`
- 产物：
  - 回归命令清单 + 关键响应字段快照。

### Phase B：Kernel 服务层拆分（1 天）

- 新增 `scripts/api/services/kernel_service.py`。
- 迁移函数族：
  - `normalize_core_repo`、`ensure_core_repo_allowed`、`detect_core_arch`
  - `fetch_core_release`、`select_core_release_asset`
  - `read_core_version`、`verify_core_binary`
  - `collect_kernel_status`、`perform_kernel_update`、kernel 更新历史读写
- `api_server.py` 保留同名薄封装；路由不改。

### Phase C：Geo 更新流程拆解（1~1.5 天）

- 以 `重构2.txt` 为参考，先在现有文件内完成函数拆解（不先做跨模块迁移）：
  - 提取 `_infer_geo_new_data`
  - 提取 `_perform_geo_db_update`
  - 提取 `_update_rule_providers`
  - 提取 `_compose_geo_update_result`
- 将 `action_geo_update` 收敛为参数解析 + 4 步编排。
- 将 `clash_request_with_retry`、`response_error_text` 提升为可复用 helper。

### Phase D：Geo 服务化与命名收口（1 天）

- 新增 `scripts/api/services/geo_service.py`，承接 Phase C 提取函数。
- 对 `_` 私有命名做渐进改造，必要时保留兼容别名，避免外部调用断裂。
- 统一常量位置（例如 `RETRYABLE_STATUS_CODES`）并去除路由内重复定义。

### Phase E：收尾与文档（0.5 天）

- 更新 `api_server_split_research.md` 与 `task_plan.md` 的完成状态。
- 准备 PR 说明：迁移范围、行为不变声明、回归证据。

## 5. 每阶段验收（执行模板）

- Python 语法：
  - `D:\py311\python.exe -m py_compile scripts/api_server.py <本阶段新增/改动的服务文件>`
- 如涉及前端则执行：
  - `node --check web/app.js`
- API 回归（API 改动必跑）：
  - `GET /api/health`（`200` + `success=true`）
  - 本阶段关键接口至少 1 条（Kernel/Geo 分别回归）
  - 系统能力接口：`GET /api/status`、`GET /api/logs`、`GET /api/files`
- 兼容入口：
  - `D:\py311\python.exe -c "import api_server; print(bool(api_server.app))"`

## 6. 建议执行顺序（可直接按编号执行）

1. 先做 Phase B（kernel_service），完成后单独回归并提交。
2. 再做 Phase C（`action_geo_update` 拆解），仅做函数级重构。
3. 完成 C 回归后再做 Phase D（geo_service 下沉 + 命名收口）。
