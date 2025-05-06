FROM hub.rat.dev/python:3.10.16

LABEL authors="nexent"

# Set correct permissions as root
USER root
RUN umask 0022
COPY frontend /opt/frontend
COPY backend /opt/backend
COPY make/start.sh /opt/deployment/start.sh
COPY assets/test.wav /opt/assets/test.wav

# Install nodejs
RUN sed -i s@/deb.debian.org/@/mirrors.aliyun.com/@g /etc/apt/sources.list.d/debian.sources
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
RUN chmod +x /opt/deployment/start.sh
RUN pip config --user set global.progress_bar off
RUN wget -q https://gh.llkk.cc/https://raw.githubusercontent.com/goto456/stopwords/master/baidu_stopwords.txt -O /opt/assets/baidu_stopwords.txt
ENV STOPWORDS_PATH=/opt/assets/baidu_stopwords.txt

WORKDIR /opt

RUN pip install --user --no-cache-dir -r backend/requirements.txt -i https://mirrors.aliyun.com/pypi/simple

RUN cd /opt/frontend && npm install -f --registry=https://registry.npmmirror.com && npm run build

# Expose the service port
EXPOSE 3000

# 设置启动入口
ENTRYPOINT ["/opt/deployment/start.sh"]