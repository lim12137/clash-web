### 🏗️ Build and Push Images

```bash
# 🛠️ Create and use a new builder instance that supports multi-architecture builds
docker buildx create --name nexent_builder --use

# 🚀 build application for multiple architectures
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t nexent/nexent-commercial -f make/main/Dockerfile . --push
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t ccr.ccs.tencentyun.com/nexent-hub/nexent -f make/web/Dockerfile . --push

# 📊 build data_process for multiple architectures
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t nexent/nexent-data-process-commercial -f make/data_process/Dockerfile . --push
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t ccr.ccs.tencentyun.com/nexent-hub/nexent-data-process -f make/web/Dockerfile . --push

# 🌐 build web frontend for multiple architectures
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t nexent/nexent-web-commercial -f make/web/Dockerfile . --push
docker buildx build --progress=plain --platform linux/amd64,linux/arm64 -t ccr.ccs.tencentyun.com/nexent-hub/nexent-web -f make/web/Dockerfile . --push
```

### 💻 Local Development Build

```bash
# 🚀 Build application image (current architecture only)
docker build -t nexent/nexent-commercial -f make/main/Dockerfile .

# 📊 Build data process image (current architecture only)
docker build -t nexent/nexent-data-process-commercial -f make/data_process/Dockerfile .

# 🌐 Build web frontend image (current architecture only)
docker build -t nexent/nexent-web-commercial -f make/web/Dockerfile .
```

### 🧹 Clean up Docker resources

```bash
# 🧼 Clean up Docker build cache and unused resources
docker builder prune -f && docker system prune -f
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
- 📊 Use `--progress=plain` to see detailed build and push progress
- 📈 Use `--build-arg MIRROR=...` to set up a pip mirror to accelerate your build-up progress