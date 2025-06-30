FROM downloads.unstructured.io/unstructured-io/unstructured:latest
LABEL authors="nexent"

# Set correct permissions as root
USER root
COPY backend /opt/backend
COPY sdk /opt/sdk

# Copy pre-downloaded model from workflow
COPY model-assets/clip-vit-base-patch32 /opt/models/clip-vit-base-patch32

RUN chown -R notebook-user:notebook-user /opt/backend
RUN chown -R notebook-user:notebook-user /opt/sdk
RUN chown -R notebook-user:notebook-user /opt/models
RUN chmod +x /opt/backend/data_process_service.py

USER notebook-user
WORKDIR /opt/backend
RUN uv sync --extra data-process && rm -rf /home/notebook-user/.cache/uv /home/notebook-user/.cache/pip

ENV VIRTUAL_ENV=/opt/backend/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /opt

# Expose the service port
EXPOSE 5012
