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

### Clean up Docker resources

```bash
# Clean up Docker build cache and unused resources
docker builder prune -f && docker system prune -f
```

注意：
- 使用 `--platform linux/amd64,linux/arm64` 参数来指定目标架构
- `--push` 参数会自动将构建好的镜像推送到 Docker Hub
- 确保已经登录到 Docker Hub (`docker login`)
- 如果遇到构建错误，可能需要确保 Docker 的 buildx 功能已启用
- 清理命令说明：
  - `docker builder prune -f`: 清理构建缓存
  - `docker system prune -f`: 清理未使用的数据（包括悬空镜像、网络等）
  - `-f` 参数表示强制执行，不需要确认