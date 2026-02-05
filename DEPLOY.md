# 🚀 部署指南

## 准备工作

### 1. 安装 Docker 和 Docker Compose

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 添加当前用户到 docker 组
sudo usermod -aG docker $USER
```

### 2. 配置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets：

#### 访问 [https://github.com/lim12137/clash-web/settings/secrets/actions](https://github.com/lim12137/clash-web/settings/secrets/actions)

添加以下 Secrets：

| Secret Name | 说明 | 示例值 |
|------------|------|--------|
| `SERVER_HOST` | 服务器 IP 地址 | `192.168.1.100` |
| `SERVER_USER` | SSH 用户名 | `root` 或 `ubuntu` |
| `SERVER_SSH_KEY` | SSH 私钥 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_DEPLOY_PATH` | 部署路径 | `/opt/clash-web` |

#### 生成 SSH 密钥

```bash
# 本地生成 SSH 密钥
ssh-keygen -t ed25519 -C "github-actions@your-email.com"

# 查看公钥并添加到服务器的 ~/.ssh/authorized_keys
cat ~/.ssh/id_ed25519.pub

# 将私钥添加到 GitHub Secrets
cat ~/.ssh/id_ed25519
```

### 3. 配置 GitHub Packages 访问权限

镜像将推送到 GitHub Container Registry (ghcr.io)

1. 访问 [https://github.com/users/lim12137/packages/container/clash-web/settings](https://github.com/users/lim12137/packages/container/clash-web/settings)
2. 设置 Package visibility 为 **Public**
3. 如果需要，添加 GitHub Actions 权限

## 首次部署

### 方式 1: 手动部署

```bash
# 克隆仓库
git clone https://github.com/lim12137/clash-web.git
cd clash-web

# 创建配置
cp config/mihomo/config.yaml.example config/mihomo/config.yaml
nano config/mihomo/config.yaml

# 编辑配置，添加你的节点和订阅信息

# 构建镜像
docker build -t ghcr.io/lim12137/clash-web:latest .

# 运行容器
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f clash-web
```

### 方式 2: 使用 GitHub Actions 自动部署

推送代码到 main 分支后，GitHub Actions 会自动：

1. ✅ 检查三个组件的更新
2. 🔨 构建 Docker 镜像
3. 📦 推送到 GitHub Packages
4. 🚀 部署到你的服务器

## 更新部署

### 自动更新

GitHub Actions 会每天 UTC 0:00 自动检查更新：

- **Sub-Store**: 检查 CareyWang/sub-web releases
- **Mihomo**: 检查 MetaCubeX/mihomo releases  
- **Metacubexd**: 检查 MetaCubeX/metacubexd releases

如果有更新，会自动构建并部署。

### 手动触发更新

1. 访问 [https://github.com/lim12137/clash-web/actions/workflows/auto-update.yml](https://github.com/lim12137/clash-web/actions/workflows/auto-update.yml)
2. 点击 **Run workflow**
3. 选择分支并运行

### 强制更新所有组件

```bash
# 在服务器上执行
cd /opt/clash-web
docker-compose pull
docker-compose up -d
```

## 常用命令

### 服务管理

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 查看实时状态
docker-compose top
```

### 更新组件版本

编辑 `Dockerfile` 中的版本号：

```dockerfile
ARG MIHO_VERSION=v1.18.8
ARG METACUBEXD_VERSION=v1.176.2
```

然后提交并推送。

## 故障排除

### 1. 容器启动失败

```bash
# 查看详细错误
docker-compose logs clash-web

# 检查配置文件
docker exec -it clash-web cat /config/mihomo/config.yaml
```

### 2. 无法连接 Mihomo API

```bash
# 检查 Mihomo 是否运行
docker exec -it clash-web ps aux | grep mihomo

# 测试 API
curl http://localhost:9090/proxies
```

### 3. 磁盘空间不足

```bash
# 清理未使用的镜像
docker image prune -a

# 清理所有未使用的数据
docker system prune -a

# 查看磁盘使用
df -h
```

### 4. 更新后配置丢失

确保你的配置保存在 `./config/mihomo/` 目录中，不要修改容器内部的配置。

## 性能优化

### 1. 使用 Docker 缓存

```yaml
# docker-compose.yml
services:
  clash-web:
    build:
      cache_from:
        - ghcr.io/lim12137/clash-web:latest
```

### 2. 限制资源使用

```yaml
services:
  clash-web:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

### 3. 配置日志轮转

```yaml
services:
  clash-web:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 监控

### 健康检查

访问以下端点检查服务状态：

- **Nginx**: `http://localhost:80`
- **Mihomo API**: `http://localhost:9090/version`
- **Metacubexd**: `http://localhost:80`

### 查看容器资源使用

```bash
docker stats
```

## 安全建议

1. **配置 HTTPS**: 使用 nginx 反向代理并配置 SSL
2. **设置密码**: 在 Mihomo 配置中设置 `external-controller` 密码
3. **限制端口**: 只暴露必要的端口
4. **定期更新**: 保持组件最新版本
5. **备份配置**: 定期备份 `config/` 目录

## 相关链接

- **Mihomo Wiki**: https://wiki.metacubex.top/
- **Metacubexd**: https://github.com/MetaCubeX/metacubexd
- **Sub-Web**: https://github.com/CareyWang/sub-web
- **Docker Docs**: https://docs.docker.com/
