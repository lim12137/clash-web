# Repository Guidelines

## Project Structure & Module Organization
- `web/`: static frontend (`index.html`, `style.css`, `app.js`) for the admin panel UI.
- `scripts/`: backend and config pipeline logic:
  - `api_server.py` (Flask management API)
  - `merge.py` (subscription merge and config generation)
  - `*.yaml`, `*.json`, `override.js` (editable policy and runtime inputs)
- `config/`: runtime output (`config.yaml`) and backups under `config/backups/`.
- Root deployment files: `docker-compose.yml`, `Dockerfile`, `entrypoint.sh`, `nginx.conf`.

## Build, Test, and Development Commands
- `docker compose up -d --build`: build and run full stack (nginx + API + mihomo) in Docker.
- `scripts\restart_local_api.bat`: local Windows restart for API only; stops old API port, runs merge once, starts `api_server.py`.
- `D:\py311\python.exe scripts/merge.py merge`: run merge manually and regenerate `config/config.yaml`.
- `Invoke-WebRequest http://127.0.0.1:19092/api/health`: quick API health check.
- `D:\py311\python.exe -m py_compile scripts/api_server.py scripts/merge.py`: Python syntax check.
- `node --check web/app.js`: frontend JS syntax check.

## Coding Style & Naming Conventions
- Python: 4-space indentation, `snake_case` for functions/variables, `UPPER_SNAKE_CASE` for constants, keep type hints where present.
- JavaScript: 2-space indentation, `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for config constants.
- YAML/JSON: keep keys stable and explicit; avoid implicit schema changes in policy files.
- Prefer small, focused edits; preserve existing comments and Chinese UI strings.

## Testing Guidelines
- There is currently no dedicated automated test directory in this repo.
- Minimum validation before PR:
  - run Python and JS syntax checks above
  - run one merge (`merge.py merge`)
  - verify `/api/health` and one key UI/API flow you changed
- For UI changes, include before/after screenshots in PR.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat(scope): ...`, `fix: ...`, `docs: ...`.
- Keep commit messages imperative and specific (example: `fix(proxy): handle 405 fallback for delay test`).
- PRs should include:
  - purpose and impact
  - changed files/areas
  - verification steps and outputs
  - linked issue/task ID when available.

## Security & Configuration Tips
- Do not commit real secrets; use environment variables (`ADMIN_TOKEN`, `CLASH_SECRET`).
- Validate edited config files before reload to avoid breaking runtime.
- Keep backup artifacts (`.bak.*`, `config/backups/`) intact for rollback and troubleshooting.
- Scope boundary: do not modify any FlClash/Ficlash installation, runtime config, or process state.
- Only edit files inside this repository (`M:\Agent\nexent`); external paths (for example `C:\Users\...\com.follow\clash\`) are out of scope.

## Plan File Maintenance
- When working with plan files (for example `task_plan.md`), check the line count before appending large updates.
- If a plan file is longer than 200 lines, process in this order: archive old sections first into a dedicated archive file under the same directory (for example `task_plan.archive.20260227.md`).
- After archiving, clean the original plan file by removing or condensing the archived old sections.
- Then write back an upfront section named `前期摘要` near the top of the original plan file, and include a clear archive link (for example `归档：./task_plan.archive.20260227.md`) so historical details remain traceable.

## 默认执行约定（全项目）
- 当用户输入“执行 / 继续 / 默认执行”且未附加限定时，默认直接落地实现当前上下文中的任务，不停留在纯方案说明。
- 当用户只给编号（如“执行1”）时，按当前任务清单中的对应编号执行；优先级依次为：当轮对话已明确的清单 > `task_plan.md` 当前“下一步”清单。
- 默认在仓库内完成“改动 + 自检 + 回报”，除非用户明确要求只修改不验证。
- 若本地 API 回归需要 `19092` 端口但不可达，默认先执行 `scripts\restart_local_api.bat` 再验证。
- 回报结果必须包含：执行命令、关键状态（成功/失败）、以及失败时的阻塞点。

## 验收标准（全项目）
- 通用必选：
  - Python 相关改动后，运行 `D:\py311\python.exe -m py_compile` 覆盖被改动的 Python 文件并通过。
  - 前端 JS 改动后，运行 `node --check web/app.js` 并通过。
  - 结果回报中必须写明实际执行过的验证命令与结论。
- 配置/合并链路改动（`scripts/merge.py`、`*.yaml`、`*.json`、`override.js`、模板/策略）：
  - 至少执行一次 `D:\py311\python.exe scripts/merge.py merge` 成功。
  - 校验输出文件 `config/config.yaml` 可生成且无异常报错。
- API 改动（`scripts/api_server.py` 或其拆分模块）：
  - `GET /api/health` 返回 HTTP `200` 且 `success=true`。
  - 至少回归一个本次改动涉及的关键接口；涉及系统基础能力时，回归 `GET /api/status`、`GET /api/logs`、`GET /api/files`。
  - 若声明兼容入口不变，需验证 `import api_server; api_server.app` 可用。
- 部署链路改动（`Dockerfile`、`entrypoint.sh`、`docker-compose.yml`、`nginx.conf`）：
  - 至少完成一次容器启动验证（`docker compose up -d --build` 或等效命令）。
  - 校验容器健康状态与 `GET /api/health` 可达。
- UI 改动（`web/*`）：
  - 至少验证一个受影响的 UI/API 关键流程。
  - 交付时附 before/after 截图（按仓库规范执行）。
- 任一适用项未满足，视为未完成。
