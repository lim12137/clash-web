#!/bin/bash

root_path=$(dirname "$(realpath "$0")")/../

# Check if environment variable is already set
if [ -z "$ELASTICSEARCH_API_KEY" ]; then
  API_KEY_JSON=$(curl -s -u "elastic:$ELASTIC_PASSWORD" "$ELASTICSEARCH_HOST/_security/api_key" -H "Content-Type: application/json" -d '{"name":"my_api_key","role_descriptors":{"my_role":{"cluster":["all"],"index":[{"names":["*"],"privileges":["all"]}]}}}')

  # Extract Key and set as environment variable
  export ELASTICSEARCH_API_KEY=$(echo "$API_KEY_JSON" | grep -o '"encoded":"[^"]*"' | awk -F'"' '{print $4}')
  
  # Write to .bashrc file
  if ! grep -q "export ELASTICSEARCH_API_KEY" ~/.bashrc; then
    echo "export ELASTICSEARCH_API_KEY=$ELASTICSEARCH_API_KEY" >> ~/.bashrc
    echo "ELASTICSEARCH_API_KEY has been set as environment variable and added to ~/.bashrc"
  fi
fi

# Start backend services
python $root_path/backend/mcp_service.py &
python $root_path/backend/main_service.py
