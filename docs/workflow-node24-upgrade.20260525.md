# GitHub Actions Node 24 升级验证报告

日期：2026-05-25

## 变更范围

- `.github/workflows/ci-build-image.yml`
- `.github/workflows/on-image-built.yml`

## 升级内容

- `actions/checkout@v4` -> `actions/checkout@v5`
- `actions/setup-python@v5` -> `actions/setup-python@v6`
- `actions/setup-node@v4` -> `actions/setup-node@v6`
- `actions/upload-artifact@v4` -> `actions/upload-artifact@v6`
- `actions/github-script@v7` -> `actions/github-script@v8`
- `docker/setup-buildx-action@v3` -> `docker/setup-buildx-action@v4`
- `docker/login-action@v3` -> `docker/login-action@v4`
- `docker/metadata-action@v5` -> `docker/metadata-action@v6`
- `CI Build and Trigger` 的 `push.branches` 新增 `rebuid`

## 执行命令

1. `Get-Content .github\workflows\ci-build-image.yml`
2. `Get-Content .github\workflows\on-image-built.yml`
3. `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/merge.py`
4. `node --check web/app.js`
5. `git diff -- .github/workflows/ci-build-image.yml .github/workflows/on-image-built.yml docs/workflow-node24-upgrade.20260525.md`

## 结果摘要

- 工作流引用已升级到当前可用的 Node 24 对应主版本。
- `rebuid` 分支后续推送将自动触发 `CI Build and Trigger`，不再依赖手动 `workflow_dispatch`。
- `docker/setup-qemu-action@v3` 保持不变；若 GitHub 后续仍提示“部分 action 使用 Node.js 20”，高概率来源于该 action 仍未发布新的 Node 24 主版本。
- Python 语法检查：通过
- 前端 JS 语法检查：通过

## 风险说明

- 升级后的 action 依赖 GitHub 托管 runner 的较新运行环境，`ubuntu-latest` 正常情况下满足要求。
- `actions/github-script@v8` 仅运行时升级，当前脚本逻辑无需额外兼容改造。
