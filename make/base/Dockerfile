FROM hub.rat.dev/python:3.10.16

LABEL authors="nexent"

# Set correct permissions as root
USER root
RUN umask 0022

# Configure pip
RUN pip config --user set global.progress_bar off

# Install Node.js
RUN sed -i s@/deb.debian.org/@/mirrors.aliyun.com/@g /etc/apt/sources.list.d/debian.sources
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

# Install Python dependencies
COPY backend/requirements.txt /opt/backend/requirements.txt
COPY sdk /opt/sdk
RUN cd /opt/sdk && pip install . -i https://mirrors.aliyun.com/pypi/simple
RUN pip install --user --no-cache-dir -r /opt/backend/requirements.txt -i https://mirrors.aliyun.com/pypi/simple
