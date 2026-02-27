# 交付结果

日期: 2026-02-25

## 已实现功能

1. 管理前端
- 文件: `web/index.html`, `web/style.css`, `web/app.js`
- 功能: 订阅管理、节点切换、覆写编辑、站点策略编辑、脚本在线编辑、日志查看、合并与重载按钮。

2. 多订阅合并
- 文件: `scripts/merge.py`
- 功能: 拉取多订阅、过滤、去重、写入 `config/config.yaml`（容器内为 `/root/.config/mihomo/config.yaml`）。

3. 脚本覆写与站点分流
- 文件: `scripts/override.js`, `scripts/override.yaml`, `scripts/site_policy.yaml`, `scripts/template.yaml`
- 功能: 支持 `main(config)` JS 覆写（参考 `jiaoben.txt`）；覆写 DNS/代理组等配置；按域名规则绑定代理组。

4. 节点切换
- 文件: `scripts/api_server.py`
- 接口: `/api/clash/groups`, `/api/clash/groups/<group>/select`
- 功能: 查询可切换组并在线切换。

5. 脚本在线修改
- 文件: `scripts/api_server.py`
- 接口: `/api/override-script`, `/api/merge-script`, `/api/files/*`
- 功能: 在线编辑 `override.js` / `merge.py`，保存前语法校验并自动备份。

6. 两组订阅集合（付费/免费）可视化维护
- 文件: `scripts/subscription_sets.json`, `scripts/override.js`, `web/index.html`, `web/app.js`
- 接口: `/api/subscription-sets`
- 功能: 页面填写两组订阅，自动写入 `override.js` 头部，后续脚本可直接使用集合变量。

7. 定时合并重载
- 文件: `scripts/schedule.json`, `scripts/api_server.py`, `web/index.html`, `web/app.js`
- 接口: `/api/schedule`
- 功能: 启用后按分钟间隔自动执行“合并并重载”。

8. `jiaoben.txt` 逻辑模板化迁移
- 文件: `scripts/override.js`
- 功能: 将原“固定 SUB_A/SUB_B/SUB_C”改造为“集合1/集合2”输入，后续脚本直接引用集合变量生成 provider 与规则。

9. 订阅集合表格化与调度历史
- 文件: `web/index.html`, `web/app.js`, `web/style.css`, `scripts/api_server.py`, `scripts/schedule_history.json`
- 功能:
  - 集合1/集合2 从文本框升级为可视化表格增删行编辑。
  - 新增定时执行历史列表（状态、触发源、结果说明）与清空能力。

## 部署文件

- `docker-compose.yml`
- `Dockerfile`
- `entrypoint.sh`
- `nginx.conf`
- `README.md`

## 自检结果

1. Python 语法检查:
- `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/merge.py`
- 结果: 通过

2. 合并脚本本地链路:
- `D:\py311\python.exe scripts/merge.py merge`
- 结果: 成功生成 `config/config.yaml`

## 增量交付（2026-02-25 晚间）

10. 左侧导航分页面重排（无新增模块）
- 文件: `web/index.html`, `web/app.js`, `web/style.css`
- 功能:
  - 现有模块已按左侧导航映射到对应页面。
  - 点击导航切换页面标题与卡片可见性。

11. 配置编辑区高度优化
- 文件: `web/style.css`
- 功能:
  - 提升编辑器可视高度，桌面与移动端均优化。

12. 日志页双栏与历史迁移
- 文件: `web/index.html`
- 功能:
  - “定时执行历史”迁移到“日志”页。
  - “日志”页采用双栏并排显示（移动端保持单列响应式）。

13. 节点延迟测试能力增强
- 文件: `scripts/api_server.py`, `web/app.js`, `web/index.html`, `web/style.css`, `README.md`
- 接口: `POST /api/clash/proxies/delay`
- 功能:
  - 支持基于 Clash delay API 的节点延迟测试（非测速）。
  - 节点切换页支持自动批量测延迟。
  - 右上新增手动“测延时”按钮。
  - 超时明确显示为“超时”。

## 增量交付（2026-02-27 路由与启动链路修复）

14. 后端启动与路由稳定性修复
- 文件: `scripts/api_server.py`, `entrypoint.sh`, `Dockerfile`
- 目标:
  - 修复 `proxy-records` 相关改造后的结构性问题与启动链路风险。
  - 让容器路径使用 gunicorn，避免 Flask threaded 模式潜在异常。

- 变更:
  - `scripts/api_server.py`
    - 修复尾部损坏代码（缩进错误、重复 gunicorn 启动段）。
    - 新增 `start_runtime_services()`，将 `bootstrap_files` 和后台线程初始化从 `__main__` 抽离，兼容 gunicorn `api_server:app` 导入模式。
    - 脚本直跑模式改为 `threaded=False`。
    - 保留并修正 `proxy-records` 路由与 `web_entry` 兜底规则。
  - `entrypoint.sh`
    - API 启动改为 `\"${PYTHON_BIN}\" -m gunicorn api_server:app -b 0.0.0.0:${API_PORT} -w 1 --threads 4 --timeout 120 --keep-alive 5 &`。
  - `Dockerfile`
    - `pip3 install` 增加 `gunicorn`。

- 验证:
  - 语法检查通过：
    - `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/merge.py`
    - `node --check web/app.js`
  - 接口回归通过（HTTP 200）：
    - `GET /api/health`
    - `GET /api/proxy-records`
    - `POST /api/proxy-records`
    - `GET /api/proxy-records/stats`
    - `GET /api/status`
    - `GET /`

- 额外结论:
  - 远程镜像 `ghcr.io/lim12137/clash2web:latest`（当前拉取到 `dd4737a2dd4b`）仍包含旧版 `/entrypoint.sh`（`python /scripts/api_server.py`），运行时仍为 Flask dev server。
  - 本地已存在可测镜像：`nexent:proxy-test`、`nexent:proxy-test-arg`（`621b9f179824`）。
  - 本地构建脚本：`scripts/build_with_proxy.bat`。

## 增量交付（2026-02-27 本地镜像部署回归闭环）

15. 本地镜像部署回归与启动故障修复
- 文件: `entrypoint.sh`, `.gitattributes`
- 问题:
  - 使用本地镜像 `nexent:proxy-test` 部署时，容器重启并报错 `exec /entrypoint.sh: no such file or directory`。
  - 根因为 `entrypoint.sh` 为 CRLF，容器 shebang 被解析为 `/bin/sh\r`。
- 修复:
  - 将 `entrypoint.sh` 统一为 LF。
  - 新增 `.gitattributes`，固定 `*.sh text eol=lf`，防止回归。
  - 重建镜像：`docker build --pull=false -t nexent:proxy-test .`。
- 回归:
  - `docker compose up -d --pull never` 启动后容器 `healthy`。
  - 以下接口均返回 200：
    - `GET /api/health`
    - `GET /api/proxy-records`
    - `POST /api/proxy-records`
    - `GET /api/proxy-records/stats`
    - `GET /api/status`
    - `GET /`
  - 容器内 API 进程确认为 gunicorn：`python3 -m gunicorn api_server:app ...`。
