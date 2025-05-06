FROM nexent/nexent-base

# Set correct permissions as root
USER root
RUN umask 0022
COPY frontend /opt/frontend
COPY backend /opt/backend
COPY sdk /opt/sdk
COPY make/start.sh /opt/deployment/start.sh
COPY assets/test.wav /opt/assets/test.wav

# Download stopwords
RUN wget -q https://gh.llkk.cc/https://raw.githubusercontent.com/goto456/stopwords/master/baidu_stopwords.txt -O /opt/assets/baidu_stopwords.txt
ENV STOPWORDS_PATH=/opt/assets/baidu_stopwords.txt

WORKDIR /opt

RUN cd /opt/sdk && pip install .
RUN cd /opt/frontend && npm install -f --registry=https://registry.npmmirror.com && npm run build

# Expose the service port
EXPOSE 3000

# 设置启动入口
RUN chmod +x /opt/deployment/start.sh
ENTRYPOINT ["/opt/deployment/start.sh"]