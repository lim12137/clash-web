FROM python:3.10.16
LABEL authors="nexent"

# Set correct permissions as root
USER root
RUN umask 0022

# 安装 uv
RUN pip install --no-cache-dir uv

# 复制 sdk 和 backend 代码到镜像
COPY sdk /opt/sdk
COPY backend /opt/backend

# 创建 venv、安装 sdk（开发模式）、安装 backend 依赖（基础），合并为一层
WORKDIR /opt/backend
RUN uv sync && \
    rm -rf /root/.cache/uv /root/.cache/pip

ENV VIRTUAL_ENV=/opt/backend/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /opt

# Expose the service port
EXPOSE 5010