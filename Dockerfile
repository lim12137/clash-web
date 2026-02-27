FROM alpine:3.20

RUN apk add --no-cache \
    bash curl jq nginx tzdata ca-certificates wget nodejs \
    python3 py3-pip py3-yaml py3-requests

RUN pip3 install --break-system-packages flask flask-cors gunicorn

ARG TARGETARCH=amd64
RUN set -eux; \
    LATEST="$(curl -sL https://api.github.com/repos/MetaCubeX/mihomo/releases/latest | jq -r '.tag_name')"; \
    case "${TARGETARCH}" in \
      arm64) ARCH="arm64" ;; \
      *) ARCH="amd64" ;; \
    esac; \
    curl -fL "https://github.com/MetaCubeX/mihomo/releases/download/${LATEST}/mihomo-linux-${ARCH}-${LATEST}.gz" -o /tmp/mihomo.gz; \
    gunzip /tmp/mihomo.gz; \
    mv /tmp/mihomo /usr/local/bin/mihomo; \
    chmod +x /usr/local/bin/mihomo

ARG GEOIP_METADB_URL="https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip.metadb"
RUN set -eux; \
    mkdir -p /usr/local/share/mihomo; \
    curl -fL "${GEOIP_METADB_URL}" -o /usr/local/share/mihomo/geoip.metadb; \
    test -s /usr/local/share/mihomo/geoip.metadb

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY entrypoint.sh /entrypoint.sh
COPY scripts/ /scripts/
COPY web/ /web/
RUN chmod +x /entrypoint.sh

RUN mkdir -p /root/.config/mihomo/subs /root/.config/mihomo/backups /scripts /web /usr/local/share/mihomo

EXPOSE 80 7890 7891 9090

ENTRYPOINT ["/entrypoint.sh"]
