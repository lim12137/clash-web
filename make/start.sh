#!/bin/bash
root_path=$(dirname "$(realpath "$0")")/../

# Check if environment variable is already set
if [ -z "$ELASTICSEARCH_API_KEY" ]; then
  API_KEY_JSON=$(curl -s -u "elastic:$ELASTIC_PASSWORD" "$ELASTICSEARCH_HOST/_security/api_key" -H "Content-Type: application/json" -d '{"name":"my_api_key","role_descriptors":{"my_role":{"cluster":["all"],"index":[{"names":["*"],"privileges":["all"]}]}}}')

  # Extract Key and set as environment variable
  export ELASTICSEARCH_API_KEY=$(echo "$API_KEY_JSON" | grep -o '"encoded":"[^"]*"' | awk -F'"' '{print $4}')

  # Write to .env file
  echo "ELASTICSEARCH_API_KEY=$ELASTICSEARCH_API_KEY" > /opt/deployment/.env
fi

# Start backend services
python $root_path/backend/mcp_service.py &
python $root_path/backend/main_service.py
