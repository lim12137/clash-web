### How to build?

```bash
# build base image first
docker build -t nexent-base -f make/base/Dockerfile .

# build application
docker build -t nexent -f make/main/Dockerfile .

# build data_process
docker build -t nexent-data-process -f make/dataprocess/Dockerfile .
```