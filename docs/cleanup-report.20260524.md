# 项目清理报告

日期：2026-05-24

## 目标

- 清理本轮会话留下的半成品与临时视觉稿。
- 修正会误导后续协作者或 AI 的项目文档失真项。
- 把本次检查命令与结论落盘到 `docs/`。

## 执行内容

### 1. 回收本轮半成品

- 删除未准备纳入仓库的视觉稿：
  - `assets/ui-mock-desktop.svg`
  - `assets/ui-mock-mobile.svg`
- 撤回 `web/index.html` 中未完成的订阅/连接页结构草改，避免页面处于半落地状态。

### 2. 修正文档失真

- `README.md`
  - 将前端技术栈从 `Vue.js` 改为实际使用的原生 `HTML / CSS / JS`。
  - 将 API 结构描述从仅 `api_server.py` 更新为 `api_server.py + scripts/api/*`。
  - 将目录结构中的前端说明从“Vue.js 风格”改为实际实现。
  - 给 `scripts/` 目录补充 `api/` 子目录说明。
  - 移除对未纳入仓库的 `schedule.json` 静态存在假设，改成“运行过程中生成”说明。
- `AGENTS.md`
  - 修正仓库边界路径，避免后续代理按错误目录执行。

## 检查命令

```powershell
git status --short
Get-ChildItem -Recurse -File -Filter *.md | Select-Object FullName
rg -n "Vue|schedule.json|api_server.py|Vue.js风格" README.md scripts web
```

## 结果摘要

- 已清理本轮新增的非正式产物。
- 已回退未完成的前端结构性改动，工作区不再残留半落地页面。
- 已修正 README 和 AGENTS 中确认失真的项目事实。

## 未处理项

- 仓库中仍存在多份历史型根目录文档，如 `deliverable.md`、`notes.md`、`todo_review.md`、`tmp_*.log`。
- 这些文件目前是已跟踪文件，且无法仅凭当前上下文安全判断哪些应删除、哪些应归档重写，因此本次未做破坏性清理。
- 如果后续要继续做“历史文档瘦身”，建议单独按“保留 / 归档 / 删除”做一次专门清点。
