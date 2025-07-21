#!/bin/bash

ERROR_OCCURRED=0

set -a
source .env

# Add deployment mode selection function
select_deployment_mode() {
    echo "🎛️  Please select deployment mode:"
    echo "1) 🛠️  Development mode - Expose all service ports for debugging"
    echo "2) 🏗️  Infrastructure mode - Only start infrastructure services"
    echo "3) 🚀 Production mode - Only expose port 3000 for security"
    echo "4) 🧪 Beta mode - Use develop branch images (from .env.beta)"
    read -p "👉 Enter your choice [1/2/3/4] (default: 1): " mode_choice

    case $mode_choice in
        2)
            export DEPLOYMENT_MODE="infrastructure"
            export COMPOSE_FILE="docker-compose.yml"
            echo "✅ Selected infrastructure mode 🏗️"
            ;;
        3)
            export DEPLOYMENT_MODE="production"
            export COMPOSE_FILE="docker-compose.prod.yml"
            echo "✅ Selected production mode 🚀"
            ;;
        4)
            export DEPLOYMENT_MODE="beta"
            export COMPOSE_FILE="docker-compose.yml"
            echo "✅ Selected beta mode 🧪"
            ;;
        *)
            export DEPLOYMENT_MODE="development"
            export COMPOSE_FILE="docker-compose.yml"
            echo "✅ Selected development mode 🛠️"
            ;;
    esac
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
  export COMPOSE_FILE=
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

  create_dir_with_permission "elasticsearch" 775
  create_dir_with_permission "postgresql" 775
  create_dir_with_permission "minio" 775

  echo ""
  echo "--------------------------------"
  echo ""
}

install() {
  # Start infrastructure services
  echo "🔌 Starting infrastructure services..."
  docker-compose -p nexent -f "${COMPOSE_FILE}" up -d nexent-elasticsearch nexent-postgresql nexent-minio redis

  echo ""
  echo "--------------------------------"
  echo ""
  
  # Always generate a new ELASTICSEARCH_API_KEY for each deployment.
  echo "🔑 Generating ELASTICSEARCH_API_KEY..."
  # Wait for elasticsearch health check
  while ! docker-compose -p nexent -f "${COMPOSE_FILE}" ps nexent-elasticsearch | grep -q "healthy"; do
    echo "⏳ Waiting for Elasticsearch to become healthy..."
    sleep 10
  done
  
  # Generate API key
  API_KEY_JSON=$(docker-compose -p nexent -f "${COMPOSE_FILE}" exec -T nexent-elasticsearch curl -s -u "elastic:$ELASTIC_PASSWORD" "http://localhost:9200/_security/api_key" -H "Content-Type: application/json" -d '{"name":"my_api_key","role_descriptors":{"my_role":{"cluster":["all"],"index":[{"names":["*"],"privileges":["all"]}]}}}')
  
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
    echo "👀  Starting core services..."
    docker-compose -p nexent -f "${COMPOSE_FILE}" up -d nexent nexent-web nexent-data-process
  fi

  echo ""
  echo "--------------------------------"
  echo ""
}

choose_image_env() {
  read -p "🌏 Is your server network located in mainland China? [Y/N] (default N): " is_mainland
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
generate_minio_ak_sk

if [ "$DEPLOYMENT_MODE" = "beta" ]; then
  choose_beta_env
else
  choose_image_env
fi

install

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