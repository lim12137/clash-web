@echo off
setlocal enableextensions enabledelayedexpansion

REM Resolve project root from this script path.
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

REM Defaults (can be overridden by environment variables).
if "%PROXY_URL%"=="" (
  if "%PROXY_HOST%"=="" set "PROXY_HOST=192.168.8.103"
  if "%PROXY_PORT%"=="" set "PROXY_PORT=17890"
)
if "%PROXY_URL%"=="" set "PROXY_URL=http://%PROXY_HOST%:%PROXY_PORT%"
if "%NO_PROXY%"=="" set "NO_PROXY=localhost,127.0.0.1"
if "%MIRROR_IMAGE%"=="" set "MIRROR_IMAGE=docker.m.daocloud.io/library/alpine:3.20"
if "%BASE_IMAGE%"=="" set "BASE_IMAGE=alpine:3.20"
if "%IMAGE_TAG%"=="" set "IMAGE_TAG=%~1"
if "%IMAGE_TAG%"=="" set "IMAGE_TAG=nexent:proxy-test"

echo == docker build with proxy ==
echo Project      : %PROJECT_ROOT%
echo Proxy        : %PROXY_URL%
echo NO_PROXY     : %NO_PROXY%
echo Mirror image : %MIRROR_IMAGE%
echo Base image   : %BASE_IMAGE%
echo Image tag    : %IMAGE_TAG%
echo BuildKit     : disabled (DOCKER_BUILDKIT=0)
echo.

docker version >nul 2>nul
if errorlevel 1 (
  echo [error] Docker daemon is not reachable.
  exit /b 1
)

echo [1/4] Pull mirror base image...
docker pull "%MIRROR_IMAGE%"
if errorlevel 1 (
  echo [error] Failed to pull mirror image: %MIRROR_IMAGE%
  exit /b 1
)

echo.
echo [2/4] Tag mirror as %BASE_IMAGE%...
docker tag "%MIRROR_IMAGE%" "%BASE_IMAGE%"
if errorlevel 1 (
  echo [error] Failed to tag %MIRROR_IMAGE% to %BASE_IMAGE%
  exit /b 1
)

echo.
echo [3/4] Build image...
set "DOCKER_BUILDKIT=0"
set "HTTP_PROXY=%PROXY_URL%"
set "HTTPS_PROXY=%PROXY_URL%"
set "http_proxy=%PROXY_URL%"
set "https_proxy=%PROXY_URL%"
set "no_proxy=%NO_PROXY%"

docker build --pull=false ^
  --build-arg HTTP_PROXY=%PROXY_URL% ^
  --build-arg HTTPS_PROXY=%PROXY_URL% ^
  --build-arg NO_PROXY=%NO_PROXY% ^
  --build-arg http_proxy=%PROXY_URL% ^
  --build-arg https_proxy=%PROXY_URL% ^
  --build-arg no_proxy=%NO_PROXY% ^
  -t "%IMAGE_TAG%" .
if errorlevel 1 (
  echo [error] docker build failed.
  exit /b 1
)

echo.
echo [4/4] Verify image quickly...
docker run --rm --entrypoint /bin/sh "%IMAGE_TAG%" -lc "mihomo -v | head -n 1 && ls -lh /usr/local/share/mihomo/geoip.metadb"
if errorlevel 1 (
  echo [error] Image verification failed.
  exit /b 1
)

echo.
echo Build completed: %IMAGE_TAG%
exit /b 0
