### 2. How to build?

```bash
# build application
docker build -t nexent -f make/Dockerfile .

# build data_process
docker build -t nexent-data-process -f make/dataprocess/Dockerfile .
```