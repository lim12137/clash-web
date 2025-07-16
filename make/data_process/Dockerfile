FROM python:3.10-slim
LABEL authors="nexent"

# Set correct permissions as root
USER root

RUN rm -f /etc/apt/sources.list.d/* && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-backports main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list

RUN apt-get update && \
    apt-get install -y --no-install-recommends --fix-missing \
        libmagic1 \
        libmagic-dev \
        libreoffice \
        libgl1 \
        coreutils \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /opt/backend

COPY sdk /opt/sdk
COPY backend/pyproject.toml /opt/backend/pyproject.toml
RUN pip install uv
RUN uv sync --extra data-process && \
    rm -rf /home/notebook-user/.cache/uv /home/notebook-user/.cache/pip && \
    find .venv -type d -name '__pycache__' -exec rm -rf {} + && \
    find .venv -type f -name '*.pyc' -delete

COPY backend /opt/backend
COPY model-assets/clip-vit-base-patch32 /opt/models/clip-vit-base-patch32

ENV VIRTUAL_ENV=/opt/backend/.venv
ENV PATH="$VIRTUAL_ENV/bin:/usr/bin:/bin:/usr/local/bin:$PATH"

WORKDIR /opt

# Expose the service port
EXPOSE 5012
