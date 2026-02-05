# 多阶段构建 Dockerfile
# 将 Sub-Store + Mihomo + Metacubexd 构建到一个镜像中

# 阶段 1: 构建 Sub-Store (sub-web)
FROM node:20-alpine AS sub-web-builder

WORKDIR /app

# 克隆并构建 sub-web
RUN apk add --no-cache git && \
    git clone https://github.com/CareyWang/sub-web.git . && \
    npm install && \
    npm run build

# 阶段 2: 准备 Mihomo 二进制文件
FROM alpine:3.19 AS mihomo-prep

WORKDIR /tmp

# 下载最新的 Mihomo release
ARG MIHO_VERSION=v1.18.8
RUN apk add --no-cache wget unzip && \
    wget -q https://github.com/MetaCubeX/mihomo/releases/download/${MIHO_VERSION}/mihomo-linux-amd64-${MIHO_VERSION}.gz && \
    gunzip mihomo-linux-amd64-${MIHO_VERSION}.gz && \
    chmod +x mihomo-linux-amd64-${MIHO_VERSION} && \
    mv mihomo-linux-amd64-${MIHO_VERSION} /usr/local/bin/mihomo

# 阶段 3: 准备 Metacubexd
FROM alpine:3.19 AS metacubexd-prep

WORKDIR /var/www/metacubexd

# 下载最新的 Metacubexd release
ARG METACUBEXD_VERSION=v1.176.2
RUN apk add --no-cache wget unzip && \
    wget -q https://github.com/MetaCubeX/metacubexd/releases/download/${METACUBEXD_VERSION}/metacubexd-linux-amd64.zip && \
    unzip -q metacubexd-linux-amd64.zip && \
    rm metacubexd-linux-amd64.zip && \
    chmod +x metacubexd

# 阶段 4: 最终镜像
FROM node:20-alpine

LABEL maintainer="lim12137"
LABEL description="Sub-Store + Mihomo + Metacubexd Docker Image"

# 安装必要软件
RUN apk add --no-cache \
    nginx \
    curl \
    wget \
    unzip \
    bash \
    ca-certificates \
    tini

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 创建目录结构
RUN mkdir -p \
    /var/www/sub-web \
    /var/www/metacubexd \
    /var/log/nginx \
    /var/cache/nginx \
    /run \
    /config/mihomo

# 从构建阶段复制文件
COPY --from=sub-web-builder /app/dist /var/www/sub-web
COPY --from=mihomo-prep /usr/local/bin/mihomo /usr/local/bin/mihomo
COPY --from=metacubexd-prep /var/www/metacubexd /var/www/metacubexd

# 复制配置文件
COPY config/mihomo/ /config/mihomo/
COPY config/nginx/nginx.conf /etc/nginx/nginx.conf

# 若仅提供示例配置，则生成默认配置文件
RUN if [ ! -f /config/mihomo/config.yaml ] && [ -f /config/mihomo/config.yaml.example ]; then \
      cp /config/mihomo/config.yaml.example /config/mihomo/config.yaml; \
    fi

# 设置权限
RUN chown -R nobody:nobody /var/www /var/log /var/cache /config

# 创建启动脚本
COPY <<'EOF' /start.sh
#!/bin/bash
set -e

echo "Starting Clash Web Stack..."

# 启动 Mihomo (后台)
echo "Starting Mihomo..."
mihomo -d /config/mihomo &
MIHOMO_PID=$!

# 等待 Mihomo 启动
sleep 3

# 启动 Nginx (前台)
echo "Starting Nginx..."
exec nginx -g 'daemon off;'
EOF

RUN chmod +x /start.sh

# 暴露端口
EXPOSE 80 443 8080 9090 7890 7891

# 使用 tini 作为 init 系统
ENTRYPOINT ["/sbin/tini", "--"]

# 启动脚本
CMD ["/start.sh"]
