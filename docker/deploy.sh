#!/bin/bash

source .env

generate_minio_ak_sk() {
  # Generate a random AK (12-character alphanumeric)
  ACCESS_KEY=$(openssl rand -hex 12 | tr -d '\n')

  # Generate a random SK (32-character high-strength random string)
  SECRET_KEY=$(openssl rand -base64 32 | tr -d '\n')

  export MINIO_ACCESS_KEY=$ACCESS_KEY
  export MINIO_SECRET_KEY=$SECRET_KEY
}

clean() {
  export MINIO_ACCESS_KEY=
  export MINIO_SECRET_KEY=
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

  create_dir_with_permission "elasticsearch" 775
  create_dir_with_permission "postgresql" 775
  create_dir_with_permission "minio" 775
  create_dir_with_permission "uploads" 777
}

install() {
  cd "$root_path"
  docker-compose -p nexent -f "docker-compose.yml" up -d
}

add_permission
generate_minio_ak_sk
install
clean