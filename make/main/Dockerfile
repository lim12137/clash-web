FROM nexent/nexent-base-commercial
LABEL authors="nexent"

# Set correct permissions as root
USER root
COPY backend /opt/backend

# Update SDK
COPY sdk /opt/sdk
RUN cd /opt/sdk && pip install --user --no-cache-dir . -i https://mirrors.aliyun.com/pypi/simple

WORKDIR /opt

# Expose the service port
EXPOSE 5010