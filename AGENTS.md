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
