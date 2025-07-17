FROM python:3.10-slim
ARG MIRROR
LABEL authors="nexent"

# Set correct permissions as root
USER root
RUN umask 0022

RUN pip install --no-cache-dir uv $(test -n "$MIRROR" && echo "-i $MIRROR")
WORKDIR /opt/backend

# Layer 0: install base dependencies
COPY backend/pyproject.toml /opt/backend/pyproject.toml
RUN uv sync --no-cache-dir $(test -n "$MIRROR" && echo "-i $MIRROR")
# Layer 1: install sdk in link mode
COPY sdk /opt/sdk
RUN uv pip install --no-cache-dir -e /opt/sdk $(test -n "$MIRROR" && echo "-i $MIRROR")
# Layer 2: copy backend code
COPY backend /opt/backend

ENV VIRTUAL_ENV=/opt/backend/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
WORKDIR /opt

# Expose the service port
EXPOSE 5010