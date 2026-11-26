@echo off
where node >nul 2>nul || (echo The uninstaller needs Node.js. Install it from https://nodejs.org & exit /b 1)
node "%~dp0scripts\uninstall.mjs" %*
