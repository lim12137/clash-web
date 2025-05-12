FROM nexent/nexent-base

# Set correct permissions as root
USER root
COPY backend /opt/backend
COPY make/start.sh /opt/deployment/start.sh

WORKDIR /opt

# Expose the service port
EXPOSE 5010

# 设置启动入口
RUN chmod +x /opt/deployment/start.sh
ENTRYPOINT ["sh", "-c", "umask 0022 && /opt/deployment/start.sh"]