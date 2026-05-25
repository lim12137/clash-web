# 节点切换修复验证报告

日期：2026-05-25

## 变更范围

- `scripts/api_server.py`
- `web/app.js`

## 修复内容

- 新增 `/api/clash/groups/meta`，按运行中的 `config.yaml` 解析策略组定义。
- 对 `use` 型组使用 provider 明细展开真实节点。
- 前端连接页改为使用真实节点元数据渲染，不再直接把组名当节点渲染/切换。
- 节点切换提交时改为发送正确的切换目标，而不是盲目提交当前卡片文案。

## 执行命令

1. `D:\py311\python.exe -m py_compile scripts/api_server.py`
2. `node --check web/app.js`
3. `scripts\restart_local_api.bat`
4. 轮询 `http://127.0.0.1:19092/api/health`
5. `GET /api/clash/groups/meta`
6. `POST /api/clash/groups/Proxy/select`，将 `Proxy` 从 `Free-Auto` 切到 `US-Auto`

## 结果摘要

- Python 语法检查：通过
- 前端 JS 语法检查：通过
- 本地 API 重启：成功
- `GET /api/health`：HTTP 200
- `GET /api/clash/groups/meta`：HTTP 200
- `POST /api/clash/groups/Proxy/select`：HTTP 200，返回 `{"success":true}`

## 环境说明

- 本地测试内核使用的是 `config-test/config.yaml`，其中 provider URL 仍为 `example.com` 示例地址。
- 因为本地 provider 本身没有真实订阅数据，`US-Auto`、`US1`、`US2`、`Free-Auto` 在本地回归时仍可能展开为空列表。
- 本次代码修复的目标是：当运行环境存在真实 provider 节点时，前端能够正确展开并切换真实节点，而不是把 `US1`、`Free-Auto`、`COMPATIBLE` 误当成节点。
