FROM alpine:3.20 AS downloader

RUN apk add --no-cache ca-certificates curl jq

ARG TARGETARCH=amd64
RUN set -eux; \
    LATEST="$(curl -fLsS --retry 5 --retry-delay 2 --retry-all-errors https://api.github.com/repos/MetaCubeX/mihomo/releases/latest | jq -r '.tag_name')"; \
    case "${TARGETARCH}" in \
      arm64) ARCH="arm64" ;; \
      *) ARCH="amd64" ;; \
    esac; \
    curl -fLsS --retry 5 --retry-delay 2 --retry-all-errors "https://github.com/MetaCubeX/mihomo/releases/download/${LATEST}/mihomo-linux-${ARCH}-${LATEST}.gz" -o /tmp/mihomo.gz; \
    gunzip /tmp/mihomo.gz; \
    mv /tmp/mihomo /tmp/mihomo-bin; \
    chmod +x /tmp/mihomo-bin

ARG GEOIP_METADB_URL="https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip.metadb"
RUN set -eux; \
    mkdir -p /tmp/mihomo-share; \
    curl -fLsS --retry 5 --retry-delay 2 --retry-all-errors "${GEOIP_METADB_URL}" -o /tmp/mihomo-share/geoip.metadb; \
    test -s /tmp/mihomo-share/geoip.metadb

FROM alpine:3.20

RUN apk add --no-cache \
    nginx tzdata ca-certificates nodejs \
    python3 py3-yaml py3-requests \
    && apk add --no-cache --virtual .pip-build py3-pip \
    && pip3 install --no-cache-dir --break-system-packages flask flask-cors gunicorn \
    && apk del .pip-build \
    && rm -rf /root/.cache

COPY --from=downloader /tmp/mihomo-bin /usr/local/bin/mihomo
COPY --from=downloader /tmp/mihomo-share/geoip.metadb /usr/local/share/mihomo/geoip.metadb

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY entrypoint.sh /entrypoint.sh
COPY scripts/ /scripts/
COPY web/ /web/
RUN chmod +x /entrypoint.sh

RUN mkdir -p /root/.config/mihomo/subs /root/.config/mihomo/backups /scripts /web /usr/local/share/mihomo

EXPOSE 80 7890 7891 9090

ENTRYPOINT ["/entrypoint.sh"]
