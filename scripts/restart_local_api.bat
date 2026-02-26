@echo off
setlocal enableextensions enabledelayedexpansion

REM Resolve project root from this script path.
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

REM Default runtime env (can be overridden by system/user env before calling).
if "%PYTHON_BIN%"=="" set "PYTHON_BIN=D:\py311\python.exe"
if not exist "%PYTHON_BIN%" set "PYTHON_BIN=python"
if "%TEST_CONTROLLER_PORT%"=="" set "TEST_CONTROLLER_PORT=19090"
if "%TEST_MIHOMO_DIR%"=="" set "TEST_MIHOMO_DIR=%PROJECT_ROOT%\config-test"
if "%CLASH_API%"=="" set "CLASH_API=http://127.0.0.1:%TEST_CONTROLLER_PORT%"
if /I not "%CLASH_API%"=="http://127.0.0.1:%TEST_CONTROLLER_PORT%" (
  echo [warn] CLASH_API was set to "%CLASH_API%"
  echo [warn] Force to project test kernel: http://127.0.0.1:%TEST_CONTROLLER_PORT%
  set "CLASH_API=http://127.0.0.1:%TEST_CONTROLLER_PORT%"
)
if "%API_HOST%"=="" set "API_HOST=0.0.0.0"
if "%API_PORT%"=="" set "API_PORT=19092"
if "%SKIP_TEST_KERNEL%"=="" set "SKIP_TEST_KERNEL=0"

if "%MIHOMO_DIR%"=="" set "MIHOMO_DIR=%TEST_MIHOMO_DIR%"
if "%SCRIPTS_DIR%"=="" set "SCRIPTS_DIR=%PROJECT_ROOT%\scripts"

if not exist "%MIHOMO_DIR%" mkdir "%MIHOMO_DIR%"
if not exist "%MIHOMO_DIR%\subs" mkdir "%MIHOMO_DIR%\subs"
if not exist "%MIHOMO_DIR%\backups" mkdir "%MIHOMO_DIR%\backups"

echo == clash-web local API restart ==
echo Project    : %PROJECT_ROOT%
echo Python     : %PYTHON_BIN%
echo MIHOMO_DIR : %MIHOMO_DIR%
echo SCRIPTS_DIR: %SCRIPTS_DIR%
echo CLASH_API  : %CLASH_API%
echo API listen : %API_HOST%:%API_PORT%

echo.
if "%SKIP_TEST_KERNEL%"=="1" (
  echo [1/4] Skip test kernel startup, SKIP_TEST_KERNEL=1
) else (
  echo [1/4] Ensure project test kernel on %TEST_CONTROLLER_PORT%...
  call "%SCRIPTS_DIR%\start_test_kernel.bat"
  if errorlevel 1 (
    echo test kernel startup failed, restart aborted.
    exit /b 1
  )
)

echo.
echo [2/4] Stop existing listener on port %API_PORT% (if any)...
set "KILLED_ANY=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%API_PORT% .*LISTENING"') do (
  if not "%%P"=="0" (
    taskkill /f /pid %%P >nul 2>nul
    set "KILLED_ANY=1"
    echo   killed pid %%P
  )
)
if "%KILLED_ANY%"=="0" echo   no existing listener found

echo.
if "%SKIP_MERGE%"=="1" (
  echo [3/4] Skip merge, SKIP_MERGE=1
) else (
  echo [3/4] Run merge once...
  "%PYTHON_BIN%" "%SCRIPTS_DIR%\merge.py" merge
  if errorlevel 1 (
    echo merge failed, restart aborted.
    exit /b 1
  )
)

echo.
echo [4/4] Start api_server.py...
start "clash-web-api" /d "%PROJECT_ROOT%" cmd /c ""%PYTHON_BIN%" "%SCRIPTS_DIR%\api_server.py""
if errorlevel 1 (
  echo failed to start api_server.py
  exit /b 1
)

echo.
echo Restart complete.
echo Health URL: http://127.0.0.1:%API_PORT%/api/health
exit /b 0
