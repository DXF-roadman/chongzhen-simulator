@echo off
cd /d "%~dp0"
if exist "%~dp0runtime\node.exe" (
  "%~dp0runtime\node.exe" "%~dp0launcher.mjs" --stop
  if errorlevel 1 pause
  exit /b
)
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  echo Download the Windows x64 package with runtime from GitHub Releases,
  echo or install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
node.exe "%~dp0launcher.mjs" --stop
if errorlevel 1 pause
