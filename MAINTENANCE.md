# Nexent 网站运维指南

本文档提供了维护 Nexent 网站基础设施的重要信息。

## 目录
- [Nginx 配置](#nginx-配置)
- [前端管理](#前端管理)
- [故障排除](#故障排除)

## Nginx 配置

Nginx 配置文件位于 `/etc/nginx/sites-available/default`。以下是当前配置：

```nginx
# 主站配置
server {
    listen 80;
    server_name nexent.tech www.nexent.tech;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# try.nexent.tech 子域名配置
server {
    listen 80;
    server_name try.nexent.tech;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 重要说明
- 主站运行在 3001 端口
- try.nexent.tech 运行在 3000 端口
- 两个配置都使用了代理设置以确保正确的请求头转发

## 前端管理

### 启动网站
```bash
cd nexent-website
nohup npm run start > nohup.out 2>&1 &
```

### 进程管理

#### 查找运行中的进程
要查找特定端口上运行的进程：
```bash
# 检查 3001 端口（主站）
netstat -tulpn | grep :3001

# 检查 3000 端口（try.nexent.tech）
netstat -tulpn | grep :3000
```

#### 终止进程
要终止特定端口上运行的进程：
```bash
# 终止 3001 端口的进程
kill $(netstat -tulpn | grep :3001 | awk '{print $7}' | cut -d'/' -f1)

# 终止 3000 端口的进程
kill $(netstat -tulpn | grep :3000 | awk '{print $7}' | cut -d'/' -f1)
```

### 日志
- 前端日志存储在 nexent-website 目录下的 `nohup.out` 文件中
- Nginx 日志位于：
  - `/var/log/nginx/access.log`
  - `/var/log/nginx/error.log`

## 故障排除

### 常见问题

1. **网站无响应**
   - 检查前端进程是否运行：`netstat -tulpn | grep :3001`
   - 检查 Nginx 状态：`systemctl status nginx`
   - 检查 Nginx 错误日志：`tail -f /var/log/nginx/error.log`

2. **Nginx 配置问题**
   - 测试 Nginx 配置：`nginx -t`
   - 重新加载 Nginx：`systemctl reload nginx`

3. **前端进程问题**
   - 检查进程日志：`tail -f nohup.out`
   - 如需重启前端进程

### 维护命令

```bash
# 重启 Nginx
sudo systemctl restart nginx

# 检查 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 配置
sudo nginx -T

# 检查前端进程
ps aux | grep node
```

## 安全注意事项

1. 保持 Nginx 和所有依赖项更新
2. 定期检查日志中的可疑活动
3. 监控系统资源使用情况
4. 保持 SSL 证书更新（实施后）

## 备份流程

1. Nginx 配置备份：
```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
```

2. 前端代码备份：
```bash
cd nexent-website
git checkout -b backup-$(date +%Y%m%d)
git push origin backup-$(date +%Y%m%d)
``` 