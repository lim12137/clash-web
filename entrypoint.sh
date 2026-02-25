#!/bin/sh
set -eu

echo "== Clash manager bootstrap =="

PYTHON_BIN="${PYTHON_BIN:-/usr/bin/python3}"
API_PORT="${API_PORT:-19092}"
case "${API_PORT}" in
  ''|*[!0-9]*)
    API_PORT="19092"
    ;;
esac
export API_PORT
MIHOMO_DIR="/root/.config/mihomo"

mkdir -p "${MIHOMO_DIR}/subs" "${MIHOMO_DIR}/backups" /scripts /web

if [ ! -f /scripts/subscriptions.json ]; then
  cat > /scripts/subscriptions.json << 'EOF'
{
  "subscriptions": []
}
EOF
fi

if [ ! -f /scripts/site_policy.yaml ]; then
  cat > /scripts/site_policy.yaml << 'EOF'
groups:
  - name: AI
    type: select
    use_all_proxies: true
rules:
  - "DOMAIN-SUFFIX,openai.com,AI"
  - "DOMAIN-SUFFIX,chatgpt.com,AI"
EOF
fi

if [ ! -f /scripts/override.yaml ]; then
  cat > /scripts/override.yaml << 'EOF'
dns:
  enable: true
  listen: 0.0.0.0:1053
  enhanced-mode: fake-ip
EOF
fi

if [ ! -f /scripts/override.js ]; then
  cat > /scripts/override.js << 'EOF'
// === AUTO-SUB-SETS:START ===
// 自动生成区块：请在管理面板的“订阅集合”里维护，不建议手工改这里。
const SUB_SET1 = [];
const SUB_SET2 = [];
const SUB_SET1_URLS = SUB_SET1.map((x) => x.url).filter(Boolean);
const SUB_SET2_URLS = SUB_SET2.map((x) => x.url).filter(Boolean);
// === AUTO-SUB-SETS:END ===

const main = (config) => {
  config ??= {};
  config.mode = config.mode || "rule";
  return config;
};
EOF
fi

if [ ! -f /scripts/subscription_sets.json ]; then
  cat > /scripts/subscription_sets.json << 'EOF'
{
  "set1": [],
  "set2": []
}
EOF
fi

if [ ! -f /scripts/schedule.json ]; then
  cat > /scripts/schedule.json << 'EOF'
{
  "enabled": false,
  "interval_minutes": 60,
  "next_run": null,
  "last_run": null,
  "last_status": ""
}
EOF
fi

if [ ! -f /scripts/schedule_history.json ]; then
  cat > /scripts/schedule_history.json << 'EOF'
{
  "items": []
}
EOF
fi

if [ ! -f /scripts/template.yaml ]; then
  cat > /scripts/template.yaml << 'EOF'
mixed-port: 17890
socks-port: 7891
allow-lan: true
bind-address: "*"
mode: rule
log-level: info
external-controller: 0.0.0.0:9090
external-ui: /ui
secret: ""
proxies: []
proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - AUTO
      - DIRECT
  - name: AUTO
    type: url-test
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
    proxies: []
rules:
  - MATCH,PROXY
EOF
fi

if [ ! -f "${MIHOMO_DIR}/config.yaml" ]; then
  cp /scripts/template.yaml "${MIHOMO_DIR}/config.yaml"
fi

if [ -f /etc/nginx/http.d/default.conf ]; then
  sed -i \
    -e "s#http://127.0.0.1:[0-9][0-9]*/api/#http://127.0.0.1:${API_PORT}/api/#g" \
    -e "s#http://127.0.0.1:[0-9][0-9]*/api/logs/stream#http://127.0.0.1:${API_PORT}/api/logs/stream#g" \
    /etc/nginx/http.d/default.conf
fi

if [ -f /scripts/merge.py ]; then
  "${PYTHON_BIN}" /scripts/merge.py merge || true
fi

if [ -f /scripts/api_server.py ]; then
  "${PYTHON_BIN}" /scripts/api_server.py &
  echo "[ok] api server started on ${API_PORT}"
fi

nginx
echo "[ok] nginx started on 80"

echo "[ok] starting mihomo"
exec mihomo -d "${MIHOMO_DIR}"
