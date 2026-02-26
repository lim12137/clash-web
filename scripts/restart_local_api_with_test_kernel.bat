@echo off
setlocal enableextensions enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

if "%SCRIPTS_DIR%"=="" set "SCRIPTS_DIR=%PROJECT_ROOT%\scripts"
if "%PYTHON_BIN%"=="" set "PYTHON_BIN=D:\py311\python.exe"
if not exist "%PYTHON_BIN%" set "PYTHON_BIN=python"
if "%API_HOST%"=="" set "API_HOST=0.0.0.0"
if "%API_PORT%"=="" set "API_PORT=19092"

if "%TEST_CONTROLLER_PORT%"=="" set "TEST_CONTROLLER_PORT=19090"
if "%TEST_MIXED_PORT%"=="" set "TEST_MIXED_PORT=17890"
if "%TEST_SOCKS_PORT%"=="" set "TEST_SOCKS_PORT=0"
if "%TEST_MIHOMO_DIR%"=="" set "TEST_MIHOMO_DIR=%PROJECT_ROOT%\config-test"
if "%TEST_CORE_DIR%"=="" set "TEST_CORE_DIR=%PROJECT_ROOT%\tools\mihomo-test"

set "CLASH_API=http://127.0.0.1:%TEST_CONTROLLER_PORT%"
if "%MIHOMO_DIR%"=="" set "MIHOMO_DIR=%TEST_MIHOMO_DIR%"
if "%SKIP_MERGE%"=="" set "SKIP_MERGE=1"
set "SKIP_TEST_KERNEL=1"

echo == clash-web local API restart (with test kernel) ==
echo Project             : %PROJECT_ROOT%
echo API listen          : %API_HOST%:%API_PORT%
echo CLASH_API           : %CLASH_API%
echo MIHOMO_DIR          : %MIHOMO_DIR%
echo TEST_CONTROLLER_PORT: %TEST_CONTROLLER_PORT%

echo.
echo [1/2] Start dedicated test kernel...
call "%SCRIPTS_DIR%\start_test_kernel.bat"
if errorlevel 1 (
  echo failed to start dedicated test kernel.
  exit /b 1
)

echo.
echo [2/2] Restart local API...
call "%SCRIPTS_DIR%\restart_local_api.bat"
if errorlevel 1 (
  echo failed to restart local API.
  exit /b 1
)

echo.
echo Local test environment is ready.
echo API       : http://127.0.0.1:%API_PORT%/api/health
echo Clash API : %CLASH_API%
exit /b 0
