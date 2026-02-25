# Modern SaaS Dashboard (Glassmorphism)

这是一个基于 Vue 3 + Vite 构建的现代化 Dashboard 项目模板，集成了自动生成的 Glassmorphism (毛玻璃) 设计系统。

## 🛠️ 技术栈

- **框架内核**: [Vue 3](https://vuejs.org/) (Composition API + `<script setup>`)
- **构建工具**: [Vite](https://vitejs.dev/)
- **开发语言**: [TypeScript](https://www.typescriptlang.org/)
- **样式引擎**: [Tailwind CSS v3](https://tailwindcss.com/)
- **状态管理**: [Pinia](https://pinia.vuejs.org/)
- **路由管理**: [Vue Router](https://router.vuejs.org/)
- **图标组件**: [Lucide Vue](https://lucide.dev/guide/packages/lucide-vue-next)

## 🎨 设计系统 (Glassmorphism)

本项目遵循 `ui-ux-pro-max` 生成的现代 SaaS 设计规范：

- **视觉风格**: Glassmorphism (半透明背景、背景模糊、光感边框)
- **字体**: `Plus Jakarta Sans` (Google Fonts)
- **核心配色**:
  - Primary: `#6366F1` (Indigo)
  - CTA: `#10B981` (Emerald)
  - Background: `#F5F3FF`
- **基础组件**: 预置了 Button, Card 等遵循设计规范的 UI 组件。

## 🚀 快速开始

### 1. 环境要求
- Node.js version 20.19+ or 22.12+ (推荐)
- *注意: 旧版本 Node (如 20.15.0) 可能会收到 Vite 的警告，但通常仍可运行构建。*

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 构建生产版本

```bash
npm run build
```

## 📂 项目结构

```
src/
├── assets/
│   └── css/
│       └── main.css        # 全局样式与 CSS 变量定义
├── components/
│   └── ui/                 # 核心 UI 组件 (Button, Card 等)
├── layouts/
│   └── MainLayout.vue      # 应用主布局 (Navbar + Content)
├── router/
│   └── index.ts            # 路由配置
├── views/
│   └── Dashboard.vue       # 示例页面
├── App.vue                 # 根组件
└── main.ts                 # 入口文件
```

## ✨最近更新
- 初始化项目结构
- 集成 Tailwind CSS 并配置设计系统变量
- 实现基础 Glassmorphism 组件
- 配置 TypeScript 与 Vite
