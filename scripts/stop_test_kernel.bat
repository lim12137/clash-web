@echo off
setlocal enableextensions enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

if "%TEST_MIHOMO_DIR%"=="" set "TEST_MIHOMO_DIR=%PROJECT_ROOT%\config-test"
if "%TEST_CORE_DIR%"=="" set "TEST_CORE_DIR=%PROJECT_ROOT%\tools\mihomo-test"
if "%TEST_CONTROLLER_PORT%"=="" set "TEST_CONTROLLER_PORT=19090"

set "PID_FILE=%TEST_CORE_DIR%\mihomo-test.pid"
set "STOPPED_ANY=0"

echo == stop clash-web test kernel ==
echo TEST_MIHOMO_DIR : %TEST_MIHOMO_DIR%
echo PID_FILE        : %PID_FILE%

if exist "%PID_FILE%" (
  set "PID_FROM_FILE="
  set /p PID_FROM_FILE=<"%PID_FILE%"
  if defined PID_FROM_FILE (
    tasklist /FI "PID eq !PID_FROM_FILE!" | find "!PID_FROM_FILE!" >nul
    if not errorlevel 1 (
      taskkill /f /pid !PID_FROM_FILE! >nul 2>nul
      if not errorlevel 1 (
        echo   stopped pid !PID_FROM_FILE! ^(pid file^)
        set "STOPPED_ANY=1"
      )
    )
  )
  del /q "%PID_FILE%" >nul 2>nul
)

for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$target = '%TEST_MIHOMO_DIR%'; Get-CimInstance Win32_Process | Where-Object { $_.Name -ieq 'mihomo.exe' -and $_.CommandLine -like ('*' + $target + '*') } | ForEach-Object { $_.ProcessId }"`) do (
  taskkill /f /pid %%P >nul 2>nul
  if not errorlevel 1 (
    echo   stopped pid %%P ^(path match^)
    set "STOPPED_ANY=1"
  )
)

if "%STOPPED_ANY%"=="0" (
  echo   no running test kernel found
)

echo done.
exit /b 0
