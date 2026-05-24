# 2026-05-25 UI 可视化回归报告

## 目标
- 对本轮 `gstack` 风格的界面美化进行真实页面截图回归
- 同时检查桌面端与移动端导航、层次、留白和卡片观感

## 预览环境
- API：`http://127.0.0.1:19092`
- 临时预览页：`http://127.0.0.1:19093`
- 预览方式：
  - 静态资源来自 `web/`
  - `/api/*` 代理到 `19092`

## 执行命令

### 1. 健康检查
```powershell
Invoke-WebRequest http://127.0.0.1:19092/api/health -TimeoutSec 10
```

结果摘要：
- 成功
- 返回 `HTTP 200`

### 2. 预览页检查
```powershell
Invoke-WebRequest http://127.0.0.1:19093/ -TimeoutSec 10
```

结果摘要：
- 成功
- 返回 `HTTP 200`

### 3. 前端语法检查
```powershell
node --check web\app.js
```

结果摘要：
- 成功

### 4. Chrome 截图回归
执行方式：
- 使用本机 Chrome Headless 打开预览页
- 分别生成桌面端与移动端截图

输出文件：
- [dashboard-desktop.png](/M:/AI/1work/clash-web/docs/screens/visual-qa-20260525/dashboard-desktop.png)
- [settings-desktop.png](/M:/AI/1work/clash-web/docs/screens/visual-qa-20260525/settings-desktop.png)
- [dashboard-mobile.png](/M:/AI/1work/clash-web/docs/screens/visual-qa-20260525/dashboard-mobile.png)
- [dashboard-desktop-v2.png](/M:/AI/1work/clash-web/docs/screens/visual-qa-20260525/dashboard-desktop-v2.png)
- [dashboard-mobile-v2.png](/M:/AI/1work/clash-web/docs/screens/visual-qa-20260525/dashboard-mobile-v2.png)

## 发现与处理

### 已修正
- 页头只有主标题，信息层次不足
  - 已增加按页面动态切换的副标题
- 移动端底部导航仍保留桌面品牌块与静态按钮，视觉上拥挤
  - 已在移动端隐藏 `sidebar-logo` 与静态“更多”按钮
- 导航切换与页面语义不够一致
  - 已补齐地址栏 hash、前进后退同步与 `aria-current`

### 截图观察
- 桌面端：
  - 仪表盘主卡与功能卡片层次清晰
  - 页头状态区已形成明显视觉焦点
  - 操作区和定时任务区的控制台感比上一轮更强
- 移动端：
  - 顶部标题和状态带结构更清楚
  - 底部导航已去掉重复高亮品牌块，信息密度更合理
  - 卡片圆角、间距和按钮节奏保持一致

## 第二轮精修（设计师视角）

### 本轮新增截图
- [settings-desktop-v2.png](/M:/AI/1work/clash-web/docs/screens/visual-qa-20260525/settings-desktop-v2.png)
- [proxy-records-desktop-v1.png](/M:/AI/1work/clash-web/docs/screens/visual-qa-20260525/proxy-records-desktop-v1.png)
- [logs-desktop-v1.png](/M:/AI/1work/clash-web/docs/screens/visual-qa-20260525/logs-desktop-v1.png)

### 本轮改动摘要
- 仪表盘“运行操作”与“定时任务”卡片改成更明确的指令面板样式
- 设置页各块统一为配置面板语言，抬高表单区和运行信息区的节奏感
- 内核更新、GEO 更新等长内容区加入更清晰的容器分组
- 代理记录、执行历史、运行日志、配置编辑统一为控制台风格容器
- 表格筛选区、状态条、日志窗口增加更强的操作面板感

### 第二轮观察
- 设置页：
  - 顶部两张小卡与下方宽卡之间的层级更顺
  - 大块功能区不再像普通表单，而更像运维控制台
- 代理记录页：
  - 筛选区、统计条、表格主区已经形成稳定的阅读顺序
  - 记录行虽然仍然密，但整体专业感明显提升
- 日志页：
  - 左右双卡布局清楚
  - 日志黑底窗口已经和全局风格统一

## 结论
- 本轮界面美化已完成一次真实页面截图回归。
- 桌面端整体观感已达到统一、稳定、可继续细抛光的状态。
- 移动端导航拥挤问题已明显改善，当前可进入下一轮局部精修，而不是大改结构。
