FROM quay.io/unstructured-io/base-images:wolfi-base-latest
LABEL authors="nexent"

# Set correct permissions as root
USER root
COPY backend /opt/backend
COPY sdk /opt/sdk
COPY model-assets/clip-vit-base-patch32 /opt/models/clip-vit-base-patch32

RUN pip install --no-cache-dir uv

RUN chown -R notebook-user:notebook-user /opt/backend
RUN chown -R notebook-user:notebook-user /opt/sdk
RUN chown -R notebook-user:notebook-user /opt/models
RUN chmod +x /opt/backend/data_process_service.py

USER notebook-user
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
