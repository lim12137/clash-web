### How to build?

```bash
# build application
docker build -t nexent:latest -f make/Dockerfile .

# build data_process
docker build -t nexent-data-process:latest -f make/dataprocess/Dockerfile .
```