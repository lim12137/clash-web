#!/bin/bash

ERROR_OCCURRED=0

set -a
source .env

# Parse arg
MODE_CHOICE=""
IS_MAINLAND=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE_CHOICE="$2"
      shift 2
      ;;
    --is-mainland)
      IS_MAINLAND="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Add deployment mode selection function
select_deployment_mode() {
    echo "🎛️  Please select deployment mode:"
    echo "1) 🛠️  Development mode - Expose all service ports for debugging"
    echo "2) 🏗️  Infrastructure mode - Only start infrastructure services"
    echo "3) 🚀 Production mode - Only expose port 3000 for security"
    echo "4) 🧪 Beta mode - Use develop branch images (from .env.beta)"
    if [ -n "$MODE_CHOICE" ]; then
      mode_choice="$MODE_CHOICE"
      echo "👉 Using mode_choice from argument: $mode_choice"
    else
      read -p "👉 Enter your choice [1/2/3/4] (default: 1): " mode_choice
    fi

    local root_dir="# Root dir"
    case $mode_choice in
        2)
            export DEPLOYMENT_MODE="infrastructure"
            export COMPOSE_FILE="docker-compose.yml"
            echo "✅ Selected infrastructure mode 🏗️"
            ;;
        3)
            export DEPLOYMENT_MODE="production"
            export COMPOSE_FILE_SUFFIX=".prod.yml"
            echo "✅ Selected production mode deployment"
            if ! grep -q "$root_dir" .env; then
              sed -i -e '$a\' .env
              echo "# Root dir" >> .env
              echo "ROOT_DIR=\"$HOME/nexent-production-data\"" >> .env
            fi
            ;;
        4)
            export DEPLOYMENT_MODE="beta"
            export COMPOSE_FILE_SUFFIX=".yml"
            echo "✅ Selected beta mode 🧪"
            ;;
        *)
            export DEPLOYMENT_MODE="development"
            export COMPOSE_FILE_SUFFIX=".yml"
            echo "✅ Selected development mode deployment"
            if ! grep -q "$root_dir" .env; then
              sed -i -e '$a\' .env
              echo "# Root dir" >> .env
              echo "ROOT_DIR=\"$HOME/nexent-development-data\"" >> .env
            fi
            ;;
    esac
    source .env
    echo ""
    echo "--------------------------------"
    echo ""
}

generate_minio_ak_sk() {
  if [ "$(uname -s | tr '[:upper:]' '[:lower:]')" = "mingw" ] || [ "$(uname -s | tr '[:upper:]' '[:lower:]')" = "msys" ]; then
    # Windows
    ACCESS_KEY=$(powershell -Command "[System.Convert]::ToBase64String([System.Guid]::NewGuid().ToByteArray()) -replace '[^a-zA-Z0-9]', '' -replace '=.+$', '' | Select-Object -First 12")
    SECRET_KEY=$(powershell -Command '$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); [System.Convert]::ToBase64String($bytes)')
  else
    # Linux/Mac
    # Generate a random AK (12-character alphanumeric) and clean it
    ACCESS_KEY=$(openssl rand -hex 12 | tr -d '\r\n' | sed 's/[^a-zA-Z0-9]//g')

    # Generate a random SK (32-character high-strength random string) and clean it
    SECRET_KEY=$(openssl rand -base64 32 | tr -d '\r\n' | sed 's/[^a-zA-Z0-9+/=]//g')
  fi

  export MINIO_ACCESS_KEY=$ACCESS_KEY
  export MINIO_SECRET_KEY=$SECRET_KEY

  if grep -q "^MINIO_ACCESS_KEY=" .env; then
    sed -i.bak "s~^MINIO_ACCESS_KEY=.*~MINIO_ACCESS_KEY=$ACCESS_KEY~" .env
    rm .env.bak
  else
    echo "MINIO_ACCESS_KEY=$ACCESS_KEY" >> .env
  fi

  if grep -q "^MINIO_SECRET_KEY=" .env; then
    sed -i.bak "s~^MINIO_SECRET_KEY=.*~MINIO_SECRET_KEY=$SECRET_KEY~" .env
    rm .env.bak
  else
    echo "MINIO_SECRET_KEY=$SECRET_KEY" >> .env
  fi
}

clean() {
  # export MINIO_ACCESS_KEY=
  # export MINIO_SECRET_KEY=
  export DEPLOYMENT_MODE=
  export COMPOSE_FILE_SUFFIX=
}

# Function to create a directory and set permissions
create_dir_with_permission() {
    local dir_path="$1"
    local permission="$2"

    # Check if parameters are provided
    if [ -z "$dir_path" ] || [ -z "$permission" ]; then
        echo "❌ ERROR Directory path and permission parameters are required." >&2
        ERROR_OCCURRED=1
        return 1
    fi

    # Create the directory if it doesn't exist
    if [ ! -d "$dir_path" ]; then
        mkdir -p "$dir_path"
        if [ $? -ne 0 ]; then
            echo "❌ ERROR Failed to create directory $dir_path." >&2
            ERROR_OCCURRED=1
            return 1
        fi
    fi

    # Set directory permissions
    chmod -R "$permission" "$dir_path"
    if [ $? -ne 0 ]; then
        echo "❌ ERROR Failed to set permissions $permission for directory $dir_path." >&2
        ERROR_OCCURRED=1
        return 1
    fi

    echo "📁 Directory $dir_path has been created and permissions set to $permission."
}

add_permission() {
  # Initialize the sql script permission
  chmod 644 "init.sql"

  create_dir_with_permission "$ROOT_DIR/elasticsearch" 777
  create_dir_with_permission "$ROOT_DIR/postgresql" 777
  create_dir_with_permission "$ROOT_DIR/minio" 777

  cp -rn volumes $ROOT_DIR

  echo ""
  echo "--------------------------------"
  echo ""
}

install() {
  # Start infrastructure services
  docker-compose -p nexent-commercial -f "docker-compose${COMPOSE_FILE_SUFFIX}" up -d nexent-elasticsearch nexent-postgresql nexent-minio redis
  docker-compose -p nexent-commercial -f "docker-compose-supabase${COMPOSE_FILE_SUFFIX}" up -d

  echo ""
  echo "--------------------------------"
  echo ""

  # Always generate a new ELASTICSEARCH_API_KEY for each deployment.
  echo "🔑 Generating ELASTICSEARCH_API_KEY..."
  # Wait for elasticsearch health check
  while ! docker-compose -p nexent-commercial -f "docker-compose${COMPOSE_FILE_SUFFIX}" ps nexent-elasticsearch | grep -q "healthy"; do
    echo "⏳ Waiting for Elasticsearch to become healthy..."
    sleep 10
  done

  # Generate API key
  API_KEY_JSON=$(docker-compose -p nexent-commercial -f "docker-compose${COMPOSE_FILE_SUFFIX}" exec -T nexent-elasticsearch curl -s -u "elastic:$ELASTIC_PASSWORD" "http://localhost:9200/_security/api_key" -H "Content-Type: application/json" -d '{"name":"my_api_key","role_descriptors":{"my_role":{"cluster":["all"],"index":[{"names":["*"],"privileges":["all"]}]}}}')

  # Extract API key and add to .env
  ELASTICSEARCH_API_KEY=$(echo "$API_KEY_JSON" | grep -o '"encoded":"[^"]*"' | awk -F'"' '{print $4}')
  if [ -n "$ELASTICSEARCH_API_KEY" ]; then
    if grep -q "^ELASTICSEARCH_API_KEY=" .env; then
      # Use ~ as a separator in sed to avoid conflicts with special characters in the API key.
      sed -i.bak "s~^ELASTICSEARCH_API_KEY=.*~ELASTICSEARCH_API_KEY=$ELASTICSEARCH_API_KEY~" .env
      rm .env.bak
    else
      echo "" >> .env
      echo "ELASTICSEARCH_API_KEY=$ELASTICSEARCH_API_KEY" >> .env
    fi

    export ELASTICSEARCH_API_KEY
    echo "✅ ELASTICSEARCH_API_KEY generated successfully!"
  else
    echo "❌ ERROR Failed to generate ELASTICSEARCH_API_KEY"
    ERROR_OCCURRED=1
  fi

  echo ""
  echo "--------------------------------"
  echo ""

  # Start core services
  if [ "$DEPLOYMENT_MODE" != "infrastructure" ]; then
    echo "👀 Starting core services..."
    docker-compose -p nexent-commercial -f "docker-compose${COMPOSE_FILE_SUFFIX}" up -d nexent nexent-web nexent-data-process
  fi
  echo "Deploying services in ${DEPLOYMENT_MODE} mode..."
}


# 生成JWT的函数
generate_jwt() {
  local role=$1
  local secret=$JWT_SECRET
  local now=$(date +%s)
  local exp=$((now + 157680000))

  local header='{"alg":"HS256","typ":"JWT"}'
  local header_base64=$(echo -n "$header" | base64 | tr -d '\n=' | tr '/+' '_-')

  local payload="{\"role\":\"$role\",\"iss\":\"supabase\",\"iat\":$now,\"exp\":$exp}"
  local payload_base64=$(echo -n "$payload" | base64 | tr -d '\n=' | tr '/+' '_-')

  local signature=$(echo -n "$header_base64.$payload_base64" | openssl dgst -sha256 -hmac "$secret" -binary | base64 | tr -d '\n=' | tr '/+' '_-')

  echo "$header_base64.$payload_base64.$signature"
}

# Function to update or add a key-value pair to .env
update_env_var() {
  local key="$1"
  local value="$2"
  local env_file=".env"

  # Ensure the .env file exists
  touch "$env_file"

  if grep -q "^${key}=" "$env_file"; then
    # Key exists, so update it. Escape \ and & for sed's replacement string.
    # Use ~ as the separator to avoid issues with / in the value.
    local escaped_value=$(echo "$value" | sed -e 's/\\/\\\\/g' -e 's/&/\\&/g')
    sed -i.bak "s~^${key}=.*~${key}=\"${escaped_value}\"~" "$env_file"
  else
    # Key doesn't exist, so add it
    echo "${key}=\"${value}\"" >> "$env_file"
  fi

  echo ""
  echo "--------------------------------"
  echo ""
}

choose_image_env() {
  if [ -n "$IS_MAINLAND" ]; then
    is_mainland="$IS_MAINLAND"
    echo "🌏 Using is_mainland from argument: $is_mainland"
  else
    read -p "🌏 Is your server network located in mainland China? [Y/N] (default N): " is_mainland
  fi
  if [[ "$is_mainland" =~ ^[Yy]$ ]]; then
    echo "🌐 Detected mainland China network, using .env.mainland for image sources."
    source .env.mainland
  else
    echo "🌐 Using general image sources from .env.general."
    source .env.general
  fi

  echo ""
  echo "--------------------------------"
  echo ""
}

choose_beta_env() {
  echo "🌐 Beta mode selected, using .env.beta for image sources."
  source .env.beta
  echo ""
  echo "--------------------------------"
  echo ""
}

add_jwt_to_env() {
  echo "Generating and updating Supabase secrets..."
  # Generate fresh keys on every run for security
  export JWT_SECRET=$(openssl rand -base64 32 | tr -d '[:space:]')
  export SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d '[:space:]')
  export VAULT_ENC_KEY=$(openssl rand -base64 32 | tr -d '[:space:]')

  # Generate JWT-dependent keys using the new JWT_SECRET
  local anon_key=$(generate_jwt "anon")
  local service_role_key=$(generate_jwt "service_role")

  # Update or add all keys to the .env file
  update_env_var "JWT_SECRET" "$JWT_SECRET"
  update_env_var "SECRET_KEY_BASE" "$SECRET_KEY_BASE"
  update_env_var "VAULT_ENC_KEY" "$VAULT_ENC_KEY"
  update_env_var "ANON_KEY" "$anon_key"
  update_env_var "SUPABASE_KEY" "$anon_key"
  update_env_var "SERVICE_ROLE_KEY" "$service_role_key"

  # Reload the environment variables from the updated .env file
  source .env
}


# Main execution flow
echo ""
echo "================================"
echo ""
echo "🚀  Nexent Deployment Script"
echo ""
echo "================================"
echo ""

# Start deployment
select_deployment_mode
add_permission
add_jwt_to_env
generate_minio_ak_sk

if [ "$DEPLOYMENT_MODE" = "beta" ]; then
  choose_beta_env
else
  choose_image_env
fi

install
clean

# echo "Creating admin user..."
# docker exec -d nexent bash -c "curl -X POST http://kong:8000/auth/v1/signup -H \"apikey: ${SUPABASE_KEY}\" -H \"Authorization: Bearer ${SUPABASE_KEY}\" -H \"Content-Type: application/json\" -d '{\"email\":\"admin@example.com\",\"password\":\"123123\",\"email_confirm\":true,\"data\":{\"role\":\"admin\"}}'"

if [ "$ERROR_OCCURRED" -eq 1 ]; then
  echo "❌ Deployment did not complete successfully. Please review the logs and have a try again."
else
  echo "🎉  Deployment completed!"
  if [ "$DEPLOYMENT_MODE" != "infrastructure" ]; then
    echo "🌐  You can now access the application at http://localhost:3000"
  else
    echo "📦  You can now start the core services manually using dev containers"
  fi
fi