### How to build?

```bash
# Create and use a new builder instance that supports multi-architecture builds
docker buildx create --name nexent_builder --use

# build base image for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t nexent/nexent-base -f make/base/Dockerfile . --push

# build application for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t nexent/nexent -f make/main/Dockerfile . --push

# build data_process for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t nexent/nexent-data-process -f make/dataprocess/Dockerfile . --push
```

注意：
- 使用 `--platform linux/amd64,linux/arm64` 参数来指定目标架构
- `--push` 参数会自动将构建好的镜像推送到 Docker Hub
- 确保已经登录到 Docker Hub (`docker login`)
- 如果遇到构建错误，可能需要确保 Docker 的 buildx 功能已启用