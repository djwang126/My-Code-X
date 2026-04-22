@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "APP_ROOT=%%~fI"
if not exist "%APP_ROOT%\scripts\my-code-x-launcher.mjs" (
  for %%I in ("%SCRIPT_DIR%..") do set "APP_ROOT=%%~fI"
)
set "NODE_BIN=%APP_ROOT%\node\node.exe"

if not exist "%NODE_BIN%" set "NODE_BIN=node"

"%NODE_BIN%" "%APP_ROOT%\scripts\my-code-x-launcher.mjs" stop %*
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
