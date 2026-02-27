@echo off
setlocal enableextensions
cd /d "%~dp0"

docker version >nul 2>nul
if errorlevel 1 (
  echo [error] Docker daemon is not reachable.
  exit /b 1
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo [info] .env created from .env.example
)
set "WEB_PORT=18080"
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if /I "%%A"=="WEB_PORT" set "WEB_PORT=%%B"
)

echo [1/2] Load local image tar...
if not exist "nexent-local.tar" (
  echo [error] Missing image tar: nexent-local.tar
  exit /b 1
)
docker load -i "nexent-local.tar"
if errorlevel 1 (
  echo [error] docker load failed.
  exit /b 1
)

echo.
echo [2/2] Start containers...
docker compose up -d --pull never
if errorlevel 1 (
  echo [error] docker compose up failed.
  exit /b 1
)

echo.
docker compose ps
echo.
echo [ok] Open http://127.0.0.1:%WEB_PORT%
echo [ok] Health check: run check_health.bat
exit /b 0
