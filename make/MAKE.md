### 2. How to build?

```bash
# build application
docker build -t nexent -f make/Dockerfile .

# build dataclean
docker build -t nexent-dataclean -f make/dataclean/Dockerfile .
```