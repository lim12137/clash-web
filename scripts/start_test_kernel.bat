@echo off
setlocal enableextensions

set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start_test_kernel.ps1"
set "RC=%ERRORLEVEL%"
exit /b %RC%
