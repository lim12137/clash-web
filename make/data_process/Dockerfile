FROM downloads.unstructured.io/unstructured-io/unstructured:latest
LABEL authors="nexent"

# Set correct permissions as root
USER root
COPY backend /opt/backend
COPY sdk /opt/sdk
RUN chown -R notebook-user:notebook-user /opt/backend
RUN chown -R notebook-user:notebook-user /opt/sdk
RUN chmod +x /opt/backend/data_process_service.py

WORKDIR /opt
USER notebook-user
EXPOSE 5002
ENTRYPOINT ["python", "/opt/backend/data_process_service.py"]
