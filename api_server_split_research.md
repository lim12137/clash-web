# `scripts/api_server.py` 结构化分割调研（2026-02-27）

## 1. 现状基线

- 目标文件：`scripts/api_server.py`
- 规模：`3095` 行，`140` 个函数，`62` 个路由处理器
- 已存在模块化：`scripts/connection_recorder.py`（代理记录能力）

### 1.1 主要热点（按函数体行数）

- `action_geo_update`：`471` 行（`/api/actions/geo/update`）
- `provider_auto_recovery_loop`：`124` 行
- `_geo_proxy_check`：`112` 行
- `perform_kernel_update`：`95` 行
- `clash_traffic`：`85` 行
- `put_geo_settings`：`81` 行

### 1.2 路由域分布（近似处理器总行数）

- `actions/*`：`553` 行（含最重的 `geo/update`）
- `clash/*`：`466` 行
- `subscriptions/*`：`132` 行
- `proxy-records/*`：`83` 行

## 2. 结构问题与拆分风险

- 全局状态集中：大量 `Path` 常量、锁对象、运行时状态（`merge_lock`、`schedule_lock`、`connection_recorder` 等）集中在单文件。
- 路由与服务混写：HTTP 参数解析、业务逻辑、第三方 API 调用、文件 IO 混杂，单测边界不清晰。
- 导入即副作用：`start_runtime_services()` 在模块导入时启动后台线程，拆分时如果处理不当会导致重复启动风险。
- 高耦合函数：`action_geo_update` 内含重试策略、结果归并、前后状态比对和文案拼装，难以复用和测试。

## 3. 目标结构（保持接口不变）

建议新增包 `scripts/api/`，保留 `scripts/api_server.py` 作为兼容入口（`api_server:app` 不变）：

```text
scripts/
  api_server.py              # 兼容层：from api.app import app
  api/
    __init__.py
    app.py                   # create_app + register_blueprints + runtime init
    settings.py              # Env/Path 配置（dataclass）
    deps.py                  # 依赖容器（store/locks/services）
    common/
      responses.py           # json_error, success helpers
      auth.py                # require_write_auth
      io.py                  # load/save json|yaml|text, backup
      logging.py             # emit_log + SSE queue
    services/
      clash_client.py        # clash_headers + clash http 包装
      merge_service.py       # run_merge_job/start_merge_job/scheduler_loop
      kernel_service.py      # kernel update 全流程
      provider_service.py    # provider rows + auto recovery
      geo_service.py         # geo check/update 核心逻辑
      file_service.py        # editable files 校验与写入
      runtime_service.py     # bootstrap + start_runtime_services
    routes/
      system.py              # /api/health /api/status
      kernel.py              # /api/kernel/* + /api/actions/kernel/update
      subscriptions.py       # /api/subscriptions* /api/subscription-sets*
      schedule.py            # /api/schedule* /api/schedule/history*
      clash.py               # /api/clash/status|traffic|config|groups|providers|delay|select
      geo.py                 # /api/clash/geo/* + /api/actions/geo/update
      files.py               # /api/override* /api/site-policy /api/template /api/merge-script /api/files*
      logs.py                # /api/logs*
      backups.py             # /api/backups*
      proxy_records.py       # /api/proxy-records*（复用现有 recorder 模块）
      web.py                 # / 与静态资源兜底
```

## 4. 分阶段迁移方案（低风险）

### Phase 0：基线冻结

- 不改 API 行为，先产出回归清单（健康检查 + 关键写操作）。
- 固定入口兼容约束：`gunicorn api_server:app` 保持不变。

### Phase 1：抽公共能力（无路由迁移）

- 先抽 `common/io.py`、`common/responses.py`、`common/auth.py`、`common/logging.py`。
- `api_server.py` 改为调用新模块，确保行为一致。

### Phase 2：抽服务层（无 URL 变化）

- 抽 `kernel_service.py`、`merge_service.py`、`provider_service.py`、`file_service.py`。
- 最后抽 `geo_service.py`，先拆 `action_geo_update` 为纯函数流程：
  - 参数解析/默认值
  - 代理连通检查
  - GEO DB 更新
  - Rule Provider 更新与重试
  - 新数据判定与汇总文案

### Phase 3：路由蓝图化

- 按域迁移到 `routes/*.py`，每次迁移一组 URL。
- 每迁移一组即执行一次最小回归（该组 GET/PUT/POST）。

### Phase 4：入口收敛

- `api_server.py` 仅保留兼容入口与启动提示。
- 线程启动和依赖组装集中在 `api/app.py + services/runtime_service.py`。

## 5. 关键落地约束

- URL、请求/响应 JSON 结构不变。
- `ADMIN_TOKEN` 鉴权逻辑不变。
- 日志流（`/api/logs/stream`）语义不变。
- 只在仓库内改动，不触碰外部 FlClash/Ficlash 安装与进程。

## 6. 建议先做的首个 PR（可一天内完成）

- 目标：只做“框架搭建 + 无行为改动”
- 变更：
  - 新建 `scripts/api/{app.py,settings.py,common/*}`
  - `api_server.py` 路由仍在原地，只把 `json_error/load_json/save_json/emit_log/require_write_auth` 改为 import
- 验证：
  - `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/merge.py`
  - `Invoke-WebRequest http://127.0.0.1:19092/api/health`
  - `GET /api/status`, `GET /api/logs`, `GET /api/files`

## 7. 预估收益

- 单文件复杂度显著下降，后续新增接口不再继续堆积。
- `geo`、`kernel`、`scheduler` 可做独立单测与故障定位。
- 蓝图化后可按域并行开发，降低冲突和回归范围。
