# 实施笔记（管理前端 + 多订阅合并）

## 需求拆解
- 管理前端：可视化管理订阅、节点切换、日志和文件编辑。
- 节点切换：通过 Clash `/proxies` 接口查询组并切换当前节点。
- 脚本覆写：在线编辑 `override.yaml` 与 `site_policy.yaml`，参与合并输出。
- 多订阅合并：从 `subscriptions.json` 拉取多个订阅，清洗后合并写入 `config.yaml`。
- 脚本在线修改：在线编辑 `merge.py`，并支持语法校验与备份。

## 内网单机场景设计
- 对外提供 `80`（管理界面）和 `7890/7891`（代理端口）。
- `9090` Clash API 不对局域网直接暴露，统一由后端与 Nginx 内部访问。
- 预留可选管理令牌 `ADMIN_TOKEN`，默认可不启用，便于纯内网快速使用。

## 文件规划
- 容器与入口: `docker-compose.yml`, `Dockerfile`, `entrypoint.sh`, `nginx.conf`
- 核心脚本: `scripts/api_server.py`, `scripts/merge.py`
- 配置文件: `scripts/subscriptions.json`, `scripts/template.yaml`, `scripts/override.yaml`, `scripts/override.js`, `scripts/site_policy.yaml`
- 前端页面: `web/index.html`, `web/style.css`, `web/app.js`
- 文档: `README.md`

## 新增适配
- 支持 `jiaoben.txt` 风格 JS 覆写脚本（`const main = (config) => { ...; return config; }`）。
- `merge.py` 在输出前执行 `override.js`，可改写 `proxy-providers` / `rule-providers` / `proxy-groups` / `rules`。
- `api_server.py` 新增 `GET/PUT /api/override-script`，保存时做 JS 语法和 `main(config)` 检查。
- 新增两组订阅集合配置：`GET/PUT /api/subscription-sets`，写入 `scripts/subscription_sets.json`。
- 保存订阅集合后，会自动更新 `override.js` 头部常量:
  - `SUB_SET1` / `SUB_SET2`
  - `SUB_SET1_URLS` / `SUB_SET2_URLS`
- 新增定时任务配置：`GET/PUT /api/schedule`，后台线程按间隔触发“合并+重载”。
- 前端订阅集合输入已从“文本框”改为“表格增删行”。
- 新增调度历史：`GET/DELETE /api/schedule/history` + `scripts/schedule_history.json` 持久化。
- `override.js` 已迁移为接近 `jiaoben.txt` 的完整规则架构，并把订阅 URL 常量改为集合变量:
  - 付费: `SUB_SET1` / `SUB_SET1_URLS`
  - 免费: `SUB_SET2` / `SUB_SET2_URLS`

## 增量笔记（2026-02-25 晚间）

### 页面结构与模块归属
- 左侧导航已启用真实页面切换逻辑（非单页堆叠）。
- 未新增模块，仅调整归属。
- “定时执行历史”已从仪表盘迁移到“日志”页。
- “日志”页为双栏：`定时执行历史` + `运行日志`。

### 配置编辑体验
- `#editor` 高度提升，适合长脚本编辑。
- 移动端使用视口高度兜底，避免输入区过矮。

### 延迟测试（非测速）
- 新增后端接口：`POST /api/clash/proxies/delay`。
- 默认测试目标 URL：`http://www.gstatic.com/generate_204`。
- 前端单次测试超时：`5000ms`。
- 批量测试按并发 5 路执行，减少阻塞。
- 节点延迟显示规则：
  - `null` -> `测试中...`
  - `-1` -> `超时`
  - `>=0` -> `${delay} ms`
- 节点切换右上新增手动“测延时”按钮；测试中禁用防重复点击。
