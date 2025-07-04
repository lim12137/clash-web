FROM python:3.10-slim
LABEL authors="nexent"

# Set correct permissions as root
USER root

RUN cp /etc/apt/sources.list /etc/apt/sources.list.backup && \
    sed -i 's|http://deb.debian.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list && \
    sed -i 's|http://security.debian.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list && \
    sed -i 's|http://ftp.debian.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends --fix-missing \
        libmagic1 \
        libmagic-dev \
        libreoffice \
        libgl1 \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY backend /opt/backend
COPY sdk /opt/sdk
COPY model-assets/clip-vit-base-patch32 /opt/models/clip-vit-base-patch32

WORKDIR /opt/backend

RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ uv
RUN uv sync --extra data-process && \
    rm -rf /home/notebook-user/.cache/uv /home/notebook-user/.cache/pip && \
    find .venv -type d -name '__pycache__' -exec rm -rf {} + && \
    find .venv -type f -name '*.pyc' -delete

ENV VIRTUAL_ENV=/opt/backend/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /opt

# Expose the service port
EXPOSE 5012
