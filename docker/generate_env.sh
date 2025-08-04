#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

ERROR_OCCURRED=0
echo "ℹ️  Script location: docker/generate_env.sh"
echo "📁 Target .env location: Root directory (../)"
echo ""

# Function to generate MinIO access keys
generate_minio_ak_sk() {
  # Check if MinIO keys are already set in environment (e.g., from deploy.sh)
  if [ -n "$MINIO_ACCESS_KEY" ] && [ -n "$MINIO_SECRET_KEY" ]; then
    echo "🔑 Using existing MinIO access keys from environment..."
    return 0
  fi
  
  echo "🔑 Generating MinIO access keys..."
  
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

  if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ]; then
    echo "❌ ERROR Failed to generate MinIO access keys"
    ERROR_OCCURRED=1
    return 1
  fi

  export MINIO_ACCESS_KEY=$ACCESS_KEY
  export MINIO_SECRET_KEY=$SECRET_KEY

  echo "✅ MinIO access keys generated successfully"
  echo "   MINIO_ACCESS_KEY: $ACCESS_KEY"
  echo "   MINIO_SECRET_KEY: $SECRET_KEY"
}

# Function to generate Elasticsearch API key
generate_elasticsearch_api_key() {
  echo "🔑 Generating ELASTICSEARCH_API_KEY..."
  
  # Check if docker-compose is available
  if ! command -v docker-compose &> /dev/null; then
    echo "❌ ERROR docker-compose is not available"
    ERROR_OCCURRED=1
    return 1
  fi

  # Check if Elasticsearch container is running and healthy
  if ! docker-compose -p nexent ps nexent-elasticsearch | grep -q "healthy"; then
    echo "⚠️  WARNING: Elasticsearch container is not running or not healthy"
    echo "   Please make sure Elasticsearch is running first by executing:"
    echo "   docker-compose -p nexent up -d nexent-elasticsearch"
    echo "   Then wait for it to become healthy before running this script again."
    echo ""
    echo "   Alternatively, you can manually set ELASTICSEARCH_API_KEY in the .env file"
    echo "   after starting the services."
    ERROR_OCCURRED=1
    return 1
  fi
  
  # Generate API key - use the same method as in deploy.sh
  # First, source the .env file to get ELASTIC_PASSWORD
  if [ -f "../.env" ]; then
    source ../.env
  elif [ -f ".env" ]; then
    source .env
  else
    echo "❌ ERROR .env file not found, cannot get ELASTIC_PASSWORD"
    ERROR_OCCURRED=1
    return 1
  fi
  
  # Generate API key
  API_KEY_JSON=$(docker-compose -p nexent exec -T nexent-elasticsearch curl -s -u "elastic:$ELASTIC_PASSWORD" "http://localhost:9200/_security/api_key" -H "Content-Type: application/json" -d '{"name":"nexent_api_key","role_descriptors":{"nexent_role":{"cluster":["all"],"index":[{"names":["*"],"privileges":["all"]}]}}}')
  
  # Extract API key
  ELASTICSEARCH_API_KEY=$(echo "$API_KEY_JSON" | grep -o '"encoded":"[^"]*"' | awk -F'"' '{print $4}')
  
  if [ -n "$ELASTICSEARCH_API_KEY" ]; then
    export ELASTICSEARCH_API_KEY
    echo "✅ ELASTICSEARCH_API_KEY generated successfully"
  else
    echo "❌ ERROR Failed to generate ELASTICSEARCH_API_KEY"
    echo "   Response: $API_KEY_JSON"
    ERROR_OCCURRED=1
    return 1
  fi
}

# Function to copy and prepare .env file
prepare_env_file() {
  echo "📝 Preparing .env file..."
  
  # Check if .env already exists in root directory (parent directory)
  if [ -f "../.env" ]; then
    echo "⚠️  .env file already exists in root directory"
    read -p "   Do you want to overwrite it? [Y/N] (default: N): " overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
      echo "   Using existing .env file"
      return 0
    fi
  fi
  
  # Check if .env exists in current docker directory
  if [ -f ".env" ]; then
    echo "📋 Copying .env to root directory..."
    cp ".env" "../.env"
    echo "✅ Copied docker/.env to ../.env"
  elif [ -f ".env.example" ]; then
    echo "📋 .env not found, copying .env.example to root directory..."
    cp ".env.example" "../.env"
    echo "✅ Copied docker/.env.example to ../.env"
  else
    echo "❌ ERROR Neither .env nor .env.example exists in docker directory"
    ERROR_OCCURRED=1
    return 1
  fi
}

# Function to update .env file with generated keys
update_env_file() {
  echo "📝 Updating .env file with generated keys..."
  
  if [ ! -f "../.env" ]; then
    echo "❌ ERROR .env file does not exist in root directory"
    ERROR_OCCURRED=1
    return 1
  fi
  
  # Update or add MINIO_ACCESS_KEY
  if grep -q "^MINIO_ACCESS_KEY=" ../.env; then
    sed -i.bak "s~^MINIO_ACCESS_KEY=.*~MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY~" ../.env
  else
    echo "" >> ../.env
    echo "# Generated MinIO Keys" >> ../.env
    echo "MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY" >> ../.env
  fi

  # Update or add MINIO_SECRET_KEY
  if grep -q "^MINIO_SECRET_KEY=" ../.env; then
    sed -i.bak "s~^MINIO_SECRET_KEY=.*~MINIO_SECRET_KEY=$MINIO_SECRET_KEY~" ../.env
  else
    echo "MINIO_SECRET_KEY=$MINIO_SECRET_KEY" >> ../.env
  fi

  # Update or add ELASTICSEARCH_API_KEY (only if it was generated successfully)
  if [ -n "$ELASTICSEARCH_API_KEY" ]; then
    if grep -q "^ELASTICSEARCH_API_KEY=" ../.env; then
      sed -i.bak "s~^ELASTICSEARCH_API_KEY=.*~ELASTICSEARCH_API_KEY=$ELASTICSEARCH_API_KEY~" ../.env
    else
      echo "" >> ../.env
      echo "# Generated Elasticsearch API Key" >> ../.env
      echo "ELASTICSEARCH_API_KEY=$ELASTICSEARCH_API_KEY" >> ../.env
    fi
  fi
  
  # Remove backup file
  rm -f ../.env.bak
  
  echo "✅ .env file updated successfully"
}

# Function to show summary
show_summary() {
  echo "🎉 Environment generation completed!"

  echo ""
  echo "--------------------------------"
  echo ""
  
  echo "Generated keys:"
  echo "  ✅ MINIO_ACCESS_KEY: $MINIO_ACCESS_KEY"
  echo "  ✅ MINIO_SECRET_KEY: $MINIO_SECRET_KEY"
  if [ -n "$ELASTICSEARCH_API_KEY" ]; then
    echo "  ✅ ELASTICSEARCH_API_KEY: $ELASTICSEARCH_API_KEY"
  else
    echo "  ⚠️  ELASTICSEARCH_API_KEY: Not generated (Elasticsearch not available)"
  fi
  echo ""
  echo "📁 .env file location: $(cd .. && pwd)/.env"
  echo ""
  if [ -z "$ELASTICSEARCH_API_KEY" ]; then
    echo "⚠️  Note: To generate ELASTICSEARCH_API_KEY later, please:"
    echo "   1. Start Elasticsearch: docker-compose -p nexent up -d nexent-elasticsearch"
    echo "   2. Wait for it to become healthy"
    echo "   3. Run this script again or manually generate the API key"
  fi
}

# Main execution
main() {
  # Step 1: Prepare .env file
  prepare_env_file || { echo "❌ Failed to prepare .env file"; exit 1; }
  
  # Step 2: Generate MinIO keys
  generate_minio_ak_sk || { echo "❌ Failed to generate MinIO keys"; exit 1; }
  
  # Step 3: Try to generate Elasticsearch API key (optional)
  echo ""
  generate_elasticsearch_api_key || {
    echo "⚠️  Warning: Elasticsearch API key generation failed"
    echo "   Continuing with MinIO keys only..."
    ERROR_OCCURRED=0  # Reset error flag for optional step
  }
  
  # Step 4: Update .env file
  echo ""
  update_env_file || { echo "❌ Failed to update .env file"; exit 1; }
  
  # Step 5: Show summary
  show_summary
}

# Run main function
main "$@"