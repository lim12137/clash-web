### 🏗️ Build and Push Images

```bash
# 🛠️ Create and use a new builder instance that supports multi-architecture builds
docker buildx create --name nexent_builder --use

# 🔨 build base image for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t nexent/nexent-base -f make/base/Dockerfile . --push

# 🚀 build application for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t nexent/nexent -f make/main/Dockerfile . --push

# 📊 build data_process for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t nexent/nexent-data-process -f make/data_process/Dockerfile . --push

# 🌐 build web frontend for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t nexent/nexent-web -f make/web/Dockerfile . --push
```

### 💻 Local Development Build

```bash
# 🔨 Build base image (current architecture only)
docker build -t nexent/nexent-base -f make/base/Dockerfile .

# 🚀 Build application image (current architecture only)
docker build -t nexent/nexent -f make/main/Dockerfile .

# 📊 Build data process image (current architecture only)
docker build -t nexent/nexent-data-process -f make/data_process/Dockerfile .

# 🌐 Build web frontend image (current architecture only)
docker build -t nexent/nexent-web -f make/web/Dockerfile .
```

### 🧹 Clean up Docker resources

```bash
# 🧼 Clean up Docker build cache and unused resources
docker builder prune -f && docker system prune -f
```

### 💾 Local Build and Load

```bash
# 🔨 Build and load base image (auto-detect local architecture)
docker buildx build -t nexent/nexent-base -f make/base/Dockerfile . --load

# 🚀 Build and load application image (auto-detect local architecture)
docker buildx build -t nexent/nexent -f make/main/Dockerfile . --load

# 📊 Build and load data process image (auto-detect local architecture)
docker buildx build -t nexent/nexent-data-process -f make/data_process/Dockerfile . --load

# 🌐 Build and load web frontend image (auto-detect local architecture)
docker buildx build -t nexent/nexent-web -f make/web/Dockerfile . --load
```

Notes:
- 🔧 Use `--platform linux/amd64,linux/arm64` to specify target architectures
- 📤 The `--push` flag automatically pushes the built images to Docker Hub
- 🔑 Make sure you are logged in to Docker Hub (`docker login`)
- ⚠️ If you encounter build errors, ensure Docker's buildx feature is enabled
- 🧹 Cleanup commands explanation:
  - `docker builder prune -f`: Cleans build cache
  - `docker system prune -f`: Cleans unused data (including dangling images, networks, etc.)
  - The `-f` flag forces execution without confirmation
- 🔧 The `--load` flag loads the built image into the local Docker images list
- ⚠️ `--load` can only be used with single architecture builds
- 📝 Use `docker images` to verify the images are loaded locally