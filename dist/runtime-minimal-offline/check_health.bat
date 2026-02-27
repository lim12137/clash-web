@echo off
setlocal
cd /d "%~dp0"
set "WEB_PORT=18080"
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /I "%%A"=="WEB_PORT" set "WEB_PORT=%%B"
  )
)

powershell -NoProfile -Command "$resp=Invoke-WebRequest ('http://127.0.0.1:%WEB_PORT%/api/health') -UseBasicParsing; Write-Output ('StatusCode=' + $resp.StatusCode); Write-Output $resp.Content"
if errorlevel 1 (
  echo [error] health check failed.
  exit /b 1
)
exit /b 0
