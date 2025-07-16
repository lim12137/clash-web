FROM python:3.10-slim
LABEL authors="nexent"

# Set correct permissions as root
USER root
RUN umask 0022

# 安装 uv
RUN pip install uv

# 创建 venv、安装 sdk（开发模式）、安装 backend 依赖（基础），合并为一层
WORKDIR /opt/backend

COPY backend/pyproject.toml /opt/backend/pyproject.toml
COPY sdk /opt/sdk
RUN uv sync && \
    rm -rf /root/.cache/uv /root/.cache/pip && \
    find .venv -type d -name '__pycache__' -exec rm -rf {} + && \
    find .venv -type f -name '*.pyc' -delete

COPY backend /opt/backend

ENV VIRTUAL_ENV=/opt/backend/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /opt

# Expose the service port
EXPOSE 5010