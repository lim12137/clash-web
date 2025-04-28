#!/bin/bash

root_path=$(dirname "$(realpath "$0")")

generate_minio_ak_sk() {
    # 生成随机 AK（12位字母数字）
  ACCESS_KEY=$(openssl rand -hex 12 | tr -d '\n')

  # 生成随机 SK（32位高强度随机字符串）
  SECRET_KEY=$(openssl rand -base64 32 | tr -d '\n')

  export MINIO_ACCESS_KEY=$ACCESS_KEY
  export MINIO_SECRET_KEY=$SECRET_KEY
}

clean() {
  export MINIO_ACCESS_KEY=
  export MINIO_SECRET_KEY=
  rm -rf "$root_path/docker"
}

add_permission() {
  # sql 初始化脚本权限
  chmod 644 "$root_path/init.sql"

  # 配置elasticsearch挂载目录权限
  if [ ! -d '/opt/nexent/elasticsearch' ]; then
      mkdir -p /opt/nexent/elasticsearch
  fi
  chmod -R 775 /opt/nexent/elasticsearch

  if [ ! -d '/opt/nexent/uploads' ]; then
      mkdir -p /opt/nexent/uploads
  fi
  chmod -R 777 /opt/nexent/uploads
}

install() {
  cd "$root_path"
  docker-compose -f "$root_path/docker-compose.yml" up -d
}

add_permission
generate_minio_ak_sk
install
clean