# Clash Web Docker 部署

## 项目结构

```
clash-web/
├── Dockerfile              # 多阶段构建 Dockerfile
├── docker-compose.yml     # Docker Compose 配置
├── .github/
│   └── workflows/
│       └── auto-update.yml # 自动更新检查 Action
├── config/
│   ├── mihomo/
│   │   └── config.yaml    # Mihomo 配置文件
│   └── nginx/
│       └── nginx.conf      # Nginx 反向代理配置
├── README.md
└── .gitignore
```

## 快速开始

### 1. 环境准备

```bash
# 克隆仓库
git clone https://github.com/lim12137/clash-web.git
cd clash-web

# 创建配置目录
mkdir -p config/mihomo config/nginx
```

### 2. 配置 Mihomo

编辑 `config/mihomo/config.yaml`，添加你的订阅配置和代理规则。

### 3. 构建并启动

```bash
# 使用 Docker Compose 启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 4. 访问服务

- **Metacubexd Dashboard**: http://localhost:8080
- **Sub-Store**: http://localhost:8080/sub
- **Mihomo API**: http://localhost:9090

## 服务说明

### 包含的组件

1. **Mihomo** - 代理核心引擎
   - 端口: 7890 (HTTP), 7891 (SOCKS5), 9090 (REST API)
   - 配置目录: `./config/mihomo`

2. **Metacubexd** - Mihomo Web UI
   - 端口: 8080
   - 自动连接到本地 Mihomo

3. **Sub-Store** - 订阅转换前端
   - 端口: 8080/sub
   - 后端需要单独配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| TZ | Asia/Shanghai | 时区设置 |
| MIHOMO_CONFIG_DIR | /config/mihomo | Mihomo 配置目录 |
| METACUBEXD_URL | http://localhost:9090 | Mihomo API 地址 |

## 更新日志

### v1.0.0 (2025-02-06)
- 初始版本
- 集成 Mihomo, Metacubexd, Sub-Web
- 支持自动更新检查
