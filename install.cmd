@echo off
where node >nul 2>nul || (echo devenv needs Node.js 26 ^(the current LTS^) or newer. Install it from https://nodejs.org & exit /b 1)
node "%~dp0scripts\install.mjs" %*
