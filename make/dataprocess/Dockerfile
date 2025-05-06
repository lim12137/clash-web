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
RUN pip config --user set global.progress_bar off
RUN pip install --user --no-cache-dir -r backend/requirements.txt -i https://mirrors.aliyun.com/pypi/simple
RUN cd /opt/sdk && pip install .

# Expose the service port
EXPOSE 5002

# 设置启动入口
ENTRYPOINT ["python", "/opt/backend/data_process_service.py"]