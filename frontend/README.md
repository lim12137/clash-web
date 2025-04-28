# Nexent 前端框架

Nexent 前端框架是一个功能强大的 AI 智能体开发与配置框架，它允许用户快速创建、配置和部署自己的智能问答系统，支持多种数据源和模型。

![Nexent 前端框架](public/brain-favicon.svg)

## 项目概述

Nexent 前端框架平台是一个前端框架，旨在提供直观的界面来配置和使用大语言模型(LLM)智能体。通过本平台，您可以简单地配置智能体、管理知识库、选择合适的模型，并构建出功能强大的问答系统。

## 核心功能

- **智能体配置**：通过直观的界面配置智能体行为和能力
- **互联网搜索**：实时接入互联网数据，提供最新、最全面的信息检索服务
- **企业知识库搜索**：深度整合企业内部知识资源，实现精准的内部信息检索 
- **快速数据处理**：高效处理大规模数据，快速构建和更新企业专属知识库
- **语音对话**：支持语音输入和语音播报，提供自然流畅的人机交互体验
- **知识溯源**：提供完整的信息来源追溯，确保回答的可靠性和可验证性

## 项目结构

- **app/** - Next.js 应用的主要目录
  - **create/** - Agent 配置页面
  - **chat/** - 聊天界面
  - **page.tsx** - 首页(包含项目介绍)
- **components/** - React 组件
  - **frontpage.tsx** - 主页面组件
  - **chatInterface.tsx** - 聊天界面组件
  - **app-config.tsx** - 应用配置组件
  - **data-config.tsx** - 数据准备组件
  - **model-config.tsx** - 模型配置组件
  - **agent-config.tsx** - Agent 配置组件
  - **ui/** - UI 组件库
- **lib/** - 工具库
  - **storage.ts** - 本地存储服务
- **public/** - 静态资源

## 技术栈

- **Next.js** - React 框架
- **React** - 用户界面库
- **TypeScript** - 类型安全的 JavaScript 超集
- **Tailwind CSS** - 实用的 CSS 框架
- **Ant Design** - UI 组件库
- **Lucide Icons** - 图标库


## 安装与使用

### 安装依赖

使用 npm:
```bash
npm install -g pnpm
pnpm install
```

### 启动开发服务器

使用 npm:
```bash
pnpm dev
```

应用将在 http://localhost:3000 启动。

### 构建生产版本

使用 npm:
```bash
npm run build
```

### 启动生产服务器

使用 npm:
```bash
npm run start
```

## 配置 ModelEngine 服务

本应用需要连接到 ModelEngine 后端服务。默认配置下，应用会尝试连接到 `TODO` 进行健康检查。

确保您的 ModelEngine 服务已经启动并且可以正常访问。

## 系统要求

- Node.js 18.0.0 或更高版本
- 现代浏览器（Chrome, Firefox, Safari, Edge）

## 联系我们

如有任何问题或建议，请联系我们。
