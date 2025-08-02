import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/doc/',
  title: "Nexent",
  description: "A zero-code platform for auto-generating agents — no orchestration, no complex drag-and-drop required.",
  
  // Ignore localhost links as they are meant for local deployment access
  ignoreDeadLinks: [
    // Ignore localhost links
    /^http:\/\/localhost:3000/
  ],
  
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Home', link: 'http://nexent.tech' },
          { text: 'Docs', link: '/en/getting-started/overview' }
        ],
        sidebar: [
          {
            text: 'Getting Started',
            items: [
              { text: 'Overview', link: '/en/getting-started/overview' },
              { text: 'Installation & Setup', link: '/en/getting-started/installation' },
              { text: 'Model Providers', link: '/en/getting-started/model-providers' },
              { text: 'Key Features', link: '/en/getting-started/features' },
              { text: 'Development Guide', link: '/en/getting-started/development-guide' },
              { text: 'FAQ', link: '/en/faq' }
            ]
          },
          {
            text: 'SDK Documentation',
            items: [
              { text: 'SDK Overview', link: '/en/sdk/overview' },
              { 
                text: 'Core Modules',
                items: [
                  { text: 'Tools', link: '/en/sdk/core/tools' },
                  { text: 'Models', link: '/en/sdk/core/models' }
                ]
              },
              { text: 'Vector Database', link: '/en/sdk/vector-database' },
              { text: 'Data Processing', link: '/en/sdk/data-process' }
            ]
          },
          {
            text: 'Frontend Development',
            items: [
              { text: 'Frontend Overview', link: '/en/frontend/overview' }
            ]
          },
          {
            text: 'Backend Development',
            items: [
              { text: 'Backend Overview', link: '/en/backend/overview' },
              { text: 'API Reference', link: '/en/backend/api-reference' },
              {
                text: 'Tools Integration',
                items: [
                  { text: 'LangChain Tools', link: '/en/backend/tools/langchain' },
                  { text: 'MCP Tools', link: '/en/backend/tools/mcp' }
                ]
              }
            ]
          },
          {
            text: 'AI Agents',
            items: [
              { text: 'Agent Overview', link: '/en/agents/overview' }
            ]
          },
          {
            text: 'Deployment',
            items: [
              { text: 'Docker Build', link: '/en/deployment/docker-build' },
              { text: 'Dev Container', link: '/en/deployment/devcontainer' }
            ]
          },
          {
            text: 'MCP Ecosystem',
            items: [
              { text: 'Overview', link: '/en/mcp-ecosystem/overview' },
              { text: 'Use Cases', link: '/en/mcp-ecosystem/use-cases' }
            ]
          },
          {
            text: 'Community',
            items: [
              { text: 'Contributing', link: '/en/contributing' },
              { text: 'Code of Conduct', link: '/en/code-of-conduct' },
              { text: 'Known Issues', link: '/en/known-issues' },
              { text: 'License', link: '/en/license' }
            ]
          }
        ],
        socialLinks: [
          { icon: 'github', link: 'https://github.com/ModelEngine-Group/nexent' }
        ]
      }
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: '首页', link: 'http://nexent.tech' },
          { text: '文档', link: '/zh/getting-started/overview' }
        ],
        sidebar: [
          {
            text: '快速开始',
            items: [
              { text: '项目概览', link: '/zh/getting-started/overview' },
              { text: '安装与配置', link: '/zh/getting-started/installation' },
              { text: '模型提供商', link: '/zh/getting-started/model-providers' },
              { text: '核心特性', link: '/zh/getting-started/features' },
              { text: '开发指南', link: '/zh/getting-started/development-guide' },
              { text: '常见问题', link: '/zh/faq' }
            ]
          },
          {
            text: 'SDK 文档',
            items: [
              { text: 'SDK 概览', link: '/zh/sdk/overview' },
              { 
                text: '核心模块',
                items: [
                  { text: '工具模块', link: '/zh/sdk/core/tools' },
                  { text: '模型模块', link: '/zh/sdk/core/models' }
                ]
              },
              { text: '向量数据库', link: '/zh/sdk/vector-database' },
              { text: '数据处理', link: '/zh/sdk/data-process' }
            ]
          },
          {
            text: '前端开发',
            items: [
              { text: '前端概览', link: '/zh/frontend/overview' }
            ]
          },
          {
            text: '后端开发',
            items: [
              { text: '后端概览', link: '/zh/backend/overview' },
              { text: 'API 文档', link: '/zh/backend/api-reference' },
              {
                text: '工具集成',
                items: [
                  { text: 'LangChain 工具', link: '/zh/backend/tools/langchain' },
                  { text: 'MCP 工具', link: '/zh/backend/tools/mcp' }
                ]
              }
            ]
          },
          {
            text: 'AI 智能体',
            items: [
              { text: '智能体概览', link: '/zh/agents/overview' }
            ]
          },
          {
            text: '部署指南',
            items: [
              { text: 'Docker 构建', link: '/zh/deployment/docker-build' },
              { text: '开发容器', link: '/zh/deployment/devcontainer' }
            ]
          },
          {
            text: 'MCP 生态系统',
            items: [
              { text: '概览', link: '/zh/mcp-ecosystem/overview' },
              { text: '用例场景', link: '/zh/mcp-ecosystem/use-cases' }
            ]
          },
          {
            text: '社区',
            items: [
              { text: '贡献指南', link: '/zh/contributing' },
              { text: '行为准则', link: '/zh/code-of-conduct' },
              { text: '已知问题', link: '/zh/known-issues' },
              { text: '许可证', link: '/zh/license' }
            ]
          }
        ],
        socialLinks: [
          { icon: 'github', link: 'https://github.com/ModelEngine-Group/nexent' }
        ]
      }
    }
  },

  themeConfig: {
    logo: '/Nexent Logo.jpg',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ModelEngine-Group/nexent' }
    ]
  }
})
