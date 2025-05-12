et -e

# 生成密钥
JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d '\n')
VAULT_ENC_KEY=$(openssl rand -base64 32 | tr -d '\n')

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

ANON_KEY=$(generate_jwt "anon")
SERVICE_ROLE_KEY=$(generate_jwt "service_role")

cat > .env << 'EOL'
############
# Secrets
############
EOL

echo "JWT_SECRET=\"$JWT_SECRET\"" >> .env
echo "ANON_KEY=\"$ANON_KEY\"" >> .env
echo "SERVICE_ROLE_KEY=\"$SERVICE_ROLE_KEY\"" >> .env
echo "SECRET_KEY_BASE=\"$SECRET_KEY_BASE\"" >> .env
echo "VAULT_ENC_KEY=\"$VAULT_ENC_KEY\"" >> .env

cat >> .env << 'EOL'

EOL

echo "Token Generated Successfully"
echo "============================================"
echo "ANON_KEY: $ANON_KEY"
echo "============================================"
echo "SERVICE_ROLE_KEY: $SERVICE_ROLE_KEY"
echo "====================DONE===================="
echo "请使用docker-compose启动Supabase:"
echo "docker-compose up -d"
