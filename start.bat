@echo off
REM Mint - Windows launcher. No npm, no downloads, no dependencies.
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed or not on PATH.
  echo   Install it from https://nodejs.org  ^(version 18 or newer^), then run this again.
  echo.
  pause
  exit /b 1
)
echo.
echo   Starting Mint on http://localhost:3000
echo   Press Ctrl+C to stop.
echo.
node server.js
pause
