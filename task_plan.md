# 实施计划（内网单机 + 局域网代理）

## 元信息
- 日期: 2026-02-25
- 目标: 落地管理前端、节点切换、脚本覆写、多订阅合并、多网站分节点访问、脚本在线修改
- 场景约束: 内网单机部署，局域网客户端可使用代理
- 使用技能: `planning-with-files`
- 当前状态: 已完成

## 步骤
1. 创建项目骨架与容器启动文件（已完成）
2. 实现合并引擎 `scripts/merge.py`（已完成）
3. 实现管理 API `scripts/api_server.py`（已完成）
4. 实现前端面板 `web/*`（已完成）
5. 补齐默认配置与部署文档（已完成）
6. 执行语法与结构自检并交付（已完成）
7. 新增 JS 覆写脚本 (`main(config)`) 支持（已完成）
8. 新增“定时合并重载 + 订阅集合自动写入脚本头部”能力（已完成）
9. 将 `jiaoben.txt` 逻辑迁移为集合1/集合2可复用模板（已完成）
10. 升级订阅集合为表格编辑 + 新增定时执行历史面板（已完成）

## 执行日志
- 用户确认部署环境为内网单机，且需支持局域网代理访问。
- 已确定保留脚本在线编辑能力，并以计划文件记录全过程。
- 已创建容器骨架文件: `docker-compose.yml`, `Dockerfile`, `entrypoint.sh`, `nginx.conf`。
- 已实现后端与合并核心: `scripts/api_server.py`, `scripts/merge.py`，并补齐默认策略文件。
- 已实现前端页面: `web/index.html`, `web/style.css`, `web/app.js`。
- 已新增部署说明: `README.md`。
- 已执行语法检查: `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/merge.py`。
- 已执行本地合并自检: 生成 `config/config.yaml` 成功。
- 已输出交付文件: `deliverable.md`。
- 用户提供 `jiaoben.txt` 作为 JS 覆写脚本参考，需支持在线编辑并参与合并执行。
- 已支持 `scripts/override.js` 并接入合并流程（执行 `main(config)`）。
- 已新增接口: `GET/PUT /api/override-script`，前端可在线编辑。
- 已完成回归检查: Python 语法通过，`merge.py` 已成功执行 `override.js`。
- 已新增接口: `GET/PUT /api/subscription-sets`，用于可视化维护集合1(付费)/集合2(免费)。
- 已新增接口: `GET/PUT /api/schedule`，用于定时执行“合并并重载”。
- `override.js` 已支持自动区块 `SUB_SET1` / `SUB_SET2` 注入，可直接在脚本后半段使用。
- 已完成 `override.js` 逻辑升级: 按 `jiaoben.txt` 思路构建 `proxy-providers`/`rule-providers`/`proxy-groups`/`rules`，并改为直接消费集合1/集合2。
- 已将订阅集合输入从多行文本升级为表格增删行编辑。
- 已新增执行历史接口: `GET/DELETE /api/schedule/history`，并接入前端历史列表与清空按钮。
- 回归检查通过: `py_compile`、`node --check web/app.js`、`merge.py merge`。

## 下一步计划（2026-02-25）

### 总体目标
- 将本地最新提交 `44b972dd` 稳定推送到 `github/main`。
- 固化“本地直跑 + 重载 + 前端联调”的标准回归流程。
- 补齐最小可用的 GitHub Action 镜像构建能力。

### 当前阻塞
- 访问 `github.com:443` 存在间歇性 TLS 握手失败（`schannel` / `unexpected EOF`）。
- 已验证功能侧无阻塞，当前主要是网络链路问题。

### 任务拆分与优先级
1. P0：完成推送闭环（当天）
   - 目标：把 `44b972dd` 推送到 `https://github.com/lim12137/clash-web` 的 `main`。
   - 动作：优先走可用代理链路；若 HTTPS 不稳定，切 SSH 远程推送。
   - 验收：`github/main` HEAD 与本地 `44b972dd` 一致。

2. P1：新增最小构建工作流（+1 天）
   - 目标：为当前仓库新增独立 Action，而不是沿用旧 `nexent` 工作流。
   - 动作：新增 `.github/workflows/build-image.yml`，至少覆盖：
     - `workflow_dispatch`
     - `push` 到 `main` 时构建根目录 `Dockerfile`
     - 构建成功/失败可见
   - 验收：Action 首次运行通过，日志可追溯。

3. P1：固化本地运行手册（+1 天）
   - 目标：把“无 Docker 本地重启 + 排错”流程固定下来。
   - 动作：补充 `README.md` 的故障排查小节（端口占用、CLASH_API、SAFE_PATHS）。
   - 验收：按文档可在新环境 15 分钟内完成启动与一次 `merge-and-reload`。

4. P2：前端回归清单化（+2 天）
   - 目标：将手工测试变成可重复执行清单。
   - 动作：沉淀一份 `frontend_smoke_checklist.md`（或并入现有文档），覆盖：
     - 运行操作
     - 订阅 CRUD
     - 配置编辑保存
     - 节点切换
     - 定时任务与历史
   - 验收：每轮发布前可按清单在 10-15 分钟内完成检查。

5. P2：版本收口（+2 天）
   - 目标：形成一次可发布快照。
   - 动作：整理变更说明并打标签（如 `v0.1.0`，按你命名规则）。
   - 验收：仓库含可追溯提交、变更说明、可复现部署步骤。

## 增量记录（2026-02-25 晚间）

### 本轮目标
- 按新版左侧导航重排现有模块，不新增模块。
- 优化“配置编辑”编辑区域高度。
- 将“定时执行历史”迁移到“日志”并改为双栏展示。
- 为“节点切换”增加延迟测试能力，明确显示超时。

### 实施结果
1. 导航重排（已完成）
   - `dashboard`: 运行操作、定时任务
   - `proxy`: 订阅管理、订阅集合
   - `connections`: 节点切换
   - `config`: 配置编辑
   - `logs`: 定时执行历史、运行日志
   - `settings`: 管理访问
2. 配置编辑区高度优化（已完成）
   - `#editor` 调整为更高可视区域，移动端增加适配高度。
3. 日志区布局优化（已完成）
   - “定时执行历史”迁移到日志页。
   - 日志页采用双栏结构（桌面端并排，移动端单列）。
4. 延迟测试能力（已完成）
   - 新增接口 `POST /api/clash/proxies/delay`。
   - 节点切换页支持自动批量测延迟。
   - 新增右上手动“测延时”按钮。
   - 超时状态前端显示为“超时”。

### 验证记录
- `node --check web/app.js` 通过。
- `D:\py311\python.exe -m py_compile scripts/api_server.py` 通过。

### 当前状态
- 状态: 已记录，可进入 `/new`。

## 增量记录（2026-02-26）

### 本轮目标
- 将“节点设置”改为下拉选择，并放到“节点切换”里 `US-Auto · N 个节点 · 当前选择...` 信息栏右侧。
- 缩短文案并限制可选节点来源，仅允许 `US-Auto` 分组下的节点。
- 修复“点击保存后优先1/优先2回到自动”的问题。
- 处理重启后“离线”问题，恢复本地测试内核链路。

### 实施结果
1. 前端交互与布局（已完成）
   - `web/index.html`：移除原“设置页”节点设置块；在 `node-info-bar` 右侧新增 `优先1/优先2/保存` 控件。
   - `web/style.css`：新增 `node-priority-controls` 布局样式，兼容桌面与移动端。
   - `web/app.js`：仅在当前分组为 `US-Auto` 时显示该控件，切到其他分组自动隐藏。
   - 文案已缩短：`优先1`、`优先2`、`保存`、默认项 `自动`。

2. 选项来源与互斥逻辑（已完成）
   - `web/app.js`：下拉选项由“全分组汇总”改为“仅 `US-Auto` 分组的 `all` 节点”。
   - 排除系统节点（如 `DIRECT` / `REJECT` 等）。
   - 增加互斥：优先1与优先2不允许重复，变更时实时刷新候选项。

3. 保存回填问题修复（已完成）
   - 发现运行中 API `GET /api/subscription-sets` 返回体不含 `us_auto`，导致前端保存后重新加载时被清空。
   - `web/app.js` 增加兜底：当接口不返回 `us_auto` 时保留当前内存值，不覆盖为 `""`。
   - `saveSubscriptionSets()` / `saveNodeSettings()` 保存前先更新 `currentSubscriptionSets.us_auto`，避免 UI 短暂回退。

4. 离线根因与修复（已完成）
   - 离线根因：`restart_local_api_with_test_kernel.bat` 启动链路中 `merge.py` 执行 `override.js` 报错：
     - `ReferenceError: US_AUTO_PRIORITY1 is not defined`
   - `scripts/override.js` 已增加兼容兜底：
     - 自动区块缺少 `US_AUTO_PRIORITY` / `US_AUTO_PRIORITY1` / `US_AUTO_PRIORITY2` 时回退为空字符串，不再中断 merge。
   - 修复后重新执行重启链路，`19090` 与 `19092` 监听恢复，`/api/clash/status` 返回 `running: true`。

### 验证记录
- `node --check web/app.js` 通过。
- `node --check scripts/override.js` 通过。
- `D:\py311\python.exe scripts/merge.py merge` 成功（退出码 0）。
- `scripts/restart_local_api_with_test_kernel.bat` 成功（退出码 0）。
- `GET /api/health` 正常；`GET /api/clash/status` 为 `running: true`。
- 端口检查：`19090`、`19092` 均处于 `Listen`。

### 当前状态
- 运行状态：已恢复在线，可继续前端联调。
- Git 状态：`git push origin main` 返回 `Everything up-to-date`；当前仍有未提交改动，尚未形成新提交。

## 增量记录（2026-02-26 内核在线更新）

### 本轮目标
- 实现“仅内核在线更新”能力，核心二进制独立到持久卷，不触及配置与脚本数据。
- 升级链路覆盖：查询 release、下载、校验、`mihomo -v`、`mihomo -t`、原子替换、触发容器重启。
- 提供回滚保障：保留 `mihomo.prev`，容器启动时若内核自检失败自动回退。
- 增加安全边界：仅写接口可操作、限制更新源仓库、记录更新日志。

### 执行步骤
1. 入口脚本改造（已完成）
2. API 内核更新接口实现（已完成）
3. Compose 持久卷与环境变量补齐（已完成）
4. 文档更新与语法校验（已完成）

### 验证记录
- `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/merge.py` 通过。
- `node --check web/app.js` 通过。
- `D:\py311\python.exe scripts/merge.py merge` 失败：当前本机环境路径指向 `\\root\\.config\\mihomo\\backups`，写备份权限不足（`PermissionError: [Errno 13] Permission denied`）。
- `sh -n entrypoint.sh` 未执行：当前 PowerShell 环境缺少 `sh` 命令。

### 当前状态
- “仅内核在线更新”功能已完成代码落地（内核独立卷、在线更新 API、校验、自检、原子替换、重启触发、启动回滚、更新审计）。

### 增量实现（前端接入）
- 新增“内核在线更新”设置卡片（仓库输入、检查最新版本、执行更新、更新历史）。
- 前端已接入接口：`/api/kernel/status`、`/api/kernel/release/latest`、`/api/kernel/updates`、`/api/actions/kernel/update`。
- 更新成功后会显示版本变更和重启状态，失败时显示错误原因。
- 内核卡片新增“更新过程日志”，通过 SSE 日志流实时展示内核更新关键阶段。
- 更新过程日志已升级为“阶段标签 + 颜色分级”（请求/准备/下载/校验/自检/完成/重启/失败）。

## 增量记录（2026-02-27 路由与启动链路修复）

### 本轮目标
- 审核并修复 `proxy-records` 改造后的关键回归风险。
- 修复 API 启动链路，确保容器场景使用 gunicorn。
- 完成接口回归：`/api/health`、`/api/proxy-records*`、`/api/status`、`/`。

### 实施结果
1. 代码问题定位（已完成）
   - 发现 `scripts/api_server.py` 存在 `IndentationError`，导致文件无法解析。
   - 发现 `entrypoint.sh` 已改用 `gunicorn`，但 `Dockerfile` 未安装 `gunicorn`。
   - 发现新增路由位置和 `__main__` 启动逻辑耦合，存在脚本模式下路由未注册风险。

2. 代码修复（已完成）
   - `scripts/api_server.py`：
     - 清理损坏的重复 gunicorn 启动片段并修复缩进。
     - 新增 `start_runtime_services()`，将 `bootstrap_files` 与后台线程初始化从 `__main__` 中抽离，兼容 gunicorn 模块导入。
     - 本地脚本启动改为 `threaded=False`，规避 Flask 内置 threaded 路由异常风险。
     - 保留并修正 `proxy-records` 路由及 `web_entry` 兜底匹配逻辑。
   - `entrypoint.sh`：
     - API 启动改为 `\"${PYTHON_BIN}\" -m gunicorn api_server:app ...`。
   - `Dockerfile`：
     - `pip3 install` 增加 `gunicorn`。

3. 运行与回归（已完成）
   - 语法检查通过：
     - `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/merge.py`
     - `node --check web/app.js`
   - 容器接口回归通过（HTTP 200）：
     - `GET /api/health`
     - `GET /api/proxy-records`
     - `POST /api/proxy-records`
     - `GET /api/proxy-records/stats`
     - `GET /api/status`
     - `GET /`

### 当前阻塞与结论
- 远程镜像 `ghcr.io/lim12137/clash2web:latest`（`dd4737a2dd4b`）仍为旧启动逻辑：
  - 容器内 `/entrypoint.sh` 仍是 `\"${PYTHON_BIN}\" /scripts/api_server.py`。
  - 运行日志显示 Flask dev server，而非 gunicorn。
- 已定位本机构建脚本：`scripts/build_with_proxy.bat`。
- 已确认本地镜像存在：`nexent:proxy-test`、`nexent:proxy-test-arg`（`621b9f179824`）。

### 下一步
- 使用本地镜像（如 `IMAGE_REF=nexent:proxy-test`）进行部署回归，或先将最新镜像推送后再切回远程 `latest`。

## 增量记录（2026-02-27 本地镜像部署回归）

### 本轮目标
- 执行上一轮“下一步”，基于本地镜像 `nexent:proxy-test` 完成部署回归。

### 问题定位
- 首次启动容器持续重启，日志报错：`exec /entrypoint.sh: no such file or directory`。
- 根因为 `entrypoint.sh` 使用 CRLF，容器 shebang 解析为 `/bin/sh\r` 导致启动失败。

### 修复动作
1. 将 `entrypoint.sh` 换行统一为 LF（已完成）。
2. 新增 `.gitattributes` 规则 `*.sh text eol=lf`，防止后续再次引入 CRLF（已完成）。
3. 重建镜像并回归：
   - `docker build --pull=false -t nexent:proxy-test .`
   - `IMAGE_REF=nexent:proxy-test docker compose up -d --pull never`

### 回归验证
- 容器状态：`clash-meta-manager` 为 `healthy`。
- 接口回归（HTTP 200）：
  - `GET /api/health`
  - `GET /api/proxy-records`
  - `POST /api/proxy-records`
  - `GET /api/proxy-records/stats`
  - `GET /api/status`
  - `GET /`
- 进程验证：容器内 API 进程为 `python3 -m gunicorn api_server:app ...`（非 Flask dev server）。

### 当前状态
- 本地镜像部署回归已闭环，可继续“推送最新镜像到远程并切回 `ghcr.io/lim12137/clash2web:latest`”。
