#!/bin/bash

root_path=$(dirname "$(realpath "$0")")/../

# 检查 .env 文件是否存在
if [ ! -f "$root_path/.env" ]; then
  API_KEY_JSON=$(curl -s -u "elastic:$ELASTIC_PASSWORD" "$ELASTICSEARCH_HOST/_security/api_key" -H "Content-Type: application/json" -d '{"name":"my_api_key","role_descriptors":{"my_role":{"cluster":["all"],"index":[{"names":["*"],"privileges":["all"]}]}}}')

  # 提取 Key 并写入 .env 文件
  echo "ELASTICSEARCH_API_KEY=$(echo "$API_KEY_JSON" | grep -o '"encoded":"[^"]*"' | awk -F'"' '{print $4}')" > /$root_path/.env
  echo "ELASTICSEARCH_API_KEY generated and saved to .env file"
fi

cd "$root_path"


# 启动后端
python $root_path/backend/main_service.py &

python $root_path/backend/mcp_service.py