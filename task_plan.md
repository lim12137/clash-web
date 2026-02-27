# 实施计划（内网单机 + 局域网代理）

## 元信息
- 最近更新: 2026-02-27
- 当前状态: 进行中（`api_server` 服务层拆分已完成至 `geo_service`，Phase E 文档收尾与回归已完成，待整理提交说明）
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
1. 准备提交说明：整理本轮 Phase C~E 的改动范围、兼容性声明与回归证据。
2. 若继续结构化拆分，进入下一阶段路由蓝图化（按域迁移并逐组回归）。
