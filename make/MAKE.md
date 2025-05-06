### How to build?

```bash
# build base image first
docker build -t nexent/nexent-base -f make/base/Dockerfile .

# build application
docker build -t nexent/nexent -f make/main/Dockerfile .

# build data_process
docker build -t nexent/nexent-data-process -f make/dataprocess/Dockerfile .

# push images to Docker Hub
docker push nexent/nexent-base
docker push nexent/nexent
docker push nexent/nexent-data-process
```