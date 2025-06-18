#!/bin/bash

source .env
# 生成密钥
JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d '\n')
VAULT_ENC_KEY=$(openssl rand -base64 32 | tr -d '\n')

# Add deployment mode selection function
select_deployment_mode() {
    echo "Please select deployment mode:"
    echo "1) Development mode - Expose all service ports for debugging"
    echo "2) Production mode - Only expose port 3000 for security"
    read -p "Enter your choice [1/2] (default: 1): " mode_choice

    local root_dir="# Root dir"
    case $mode_choice in
        2)
            export DEPLOYMENT_MODE="production"
            export COMPOSE_FILE_SUFFIX=".prod.yml"
            echo "Selected production mode deployment"
            if ! grep -q "$root_dir" .env; then
              echo "# Root dir" >> .env
              echo "ROOT_DIR=\"$HOME/nexent-production-data\"" >> .env
            fi
            ;;
        *)
            export DEPLOYMENT_MODE="development"
            export COMPOSE_FILE_SUFFIX=".yml"
            echo "Selected development mode deployment"
            if ! grep -q "$root_dir" .env; then
              echo "# Root dir" >> .env
              echo "ROOT_DIR=\"$HOME/nexent-development-data\"" >> .env
            fi
            ;;
    esac
    source .env
}

generate_minio_ak_sk() {
  # Generate a random AK (12-character alphanumeric) and clean it
  ACCESS_KEY=$(openssl rand -hex 12 | tr -d '\r\n' | sed 's/[^a-zA-Z0-9]//g')

  # Generate a random SK (32-character high-strength random string) and clean it
  SECRET_KEY=$(openssl rand -base64 32 | tr -d '\r\n' | sed 's/[^a-zA-Z0-9+/=]//g')

  export MINIO_ACCESS_KEY=$ACCESS_KEY
  export MINIO_SECRET_KEY=$SECRET_KEY
}

clean() {
  export MINIO_ACCESS_KEY=
  export MINIO_SECRET_KEY=
  export DEPLOYMENT_MODE=
  export COMPOSE_FILE_SUFFIX=
}

# Function to create a directory and set permissions
create_dir_with_permission() {
    local dir_path="$1"
    local permission="$2"

    # Check if parameters are provided
    if [ -z "$dir_path" ] || [ -z "$permission" ]; then
        echo "Error: Directory path and permission parameters are required." >&2
        return 1
    fi

    # Create the directory if it doesn't exist
    if [ ! -d "$dir_path" ]; then
        mkdir -p "$dir_path"
        if [ $? -ne 0 ]; then
            echo "Error: Failed to create directory $dir_path." >&2
            return 1
        fi
    fi

    # Set directory permissions
    chmod -R "$permission" "$dir_path"
    if [ $? -ne 0 ]; then
        echo "Error: Failed to set permissions $permission for directory $dir_path." >&2
        return 1
    fi

    echo "Directory $dir_path has been created and permissions set to $permission."
}

add_permission() {
  # Initialize the sql script permission
  chmod 644 "init.sql"

  create_dir_with_permission "$ROOT_DIR/elasticsearch" 777
  create_dir_with_permission "$ROOT_DIR/postgresql" 777
  create_dir_with_permission "$ROOT_DIR/minio" 777
  create_dir_with_permission "$ROOT_DIR/uploads" 777
}

install() {
  cd "$root_path"
  echo "Deploying services in ${DEPLOYMENT_MODE} mode..."
  docker-compose -p nexent-commercial -f "docker-compose-supabase${COMPOSE_FILE_SUFFIX}" up -d
  docker-compose -p nexent-commercial -f "docker-compose${COMPOSE_FILE_SUFFIX}" up -d
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

add_jwt_to_env() {
  # define Supabase secrets comment
  local supabase_secrets_comment="# Supabase secrets"

  # check if .env file contains "# Supabase secrets"
  if grep -q "$supabase_secrets_comment" .env; then
    echo ".env file already contains Supabase secrets. Skipping..."
    return
  fi

  local anon_key=$(generate_jwt "anon")
  local service_role_key=$(generate_jwt "service_role")

  echo "# Supabase secrets" >> .env
  echo "JWT_SECRET=\"$JWT_SECRET\"" >> .env
  echo "ANON_KEY=\"$anon_key\"" >> .env
  echo "SUPABASE_KEY=\"$anon_key\"" >> .env
  echo "SERVICE_ROLE_KEY=\"$service_role_key\"" >> .env
  echo "SECRET_KEY_BASE=\"$SECRET_KEY_BASE\"" >> .env
  echo "VAULT_ENC_KEY=\"$VAULT_ENC_KEY\"" >> .env
}


# Main execution flow
echo "🚀 Nexent Deployment Script 🚀"
select_deployment_mode
add_permission
add_jwt_to_env
generate_minio_ak_sk
install
clean

echo "Creating admin user..."
docker exec -d nexent bash -c 'curl -X POST http://kong:8000/auth/v1/admin/users -H "apikey: ${SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" -H "Content-Type: application/json" -d "{\"email\":\"admin@example.com\",\"password\": \"123123\",\"role\": \"admin\",\"email_confirm\":true}"'

echo "🚀 Deployment completed!"
echo "🔗 You can access the application at http://localhost:3000"