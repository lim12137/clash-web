FROM python:3.10-slim
LABEL authors="nexent"

# Set correct permissions as root
USER root

ARG PYTHON=python3.10
ARG PIP="${PYTHON} -m pip"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libmagic1 \
        libmagic-dev \
        libreoffice \
        libgl1 \
        && rm -rf /var/lib/apt/lists/*

COPY backend /opt/backend
COPY sdk /opt/sdk
COPY model-assets/clip-vit-base-patch32 /opt/models/clip-vit-base-patch32

RUN pip install --no-cache-dir uv

WORKDIR /opt/backend

ARG PYTHON=python3.10
ARG PIP="${PYTHON} -m pip"

RUN pip install --no-cache-dir uv
RUN uv sync --extra data-process && rm -rf /home/notebook-user/.cache/uv /home/notebook-user/.cache/pip

ENV VIRTUAL_ENV=/opt/backend/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /opt

# Expose the service port
EXPOSE 5012
