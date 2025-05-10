FROM nexent/nexent-base

# Set correct permissions as root
USER root
COPY frontend /opt/frontend
COPY backend /opt/backend
COPY make/start.sh /opt/deployment/start.sh

WORKDIR /opt

RUN cd /opt/frontend && npm install -f --registry=https://registry.npmmirror.com && npm run build

# Expose the service port
EXPOSE 3000

# 设置启动入口
RUN chmod +x /opt/deployment/start.sh
ENTRYPOINT ["sh", "-c", "umask 0022 && /opt/deployment/start.sh"]