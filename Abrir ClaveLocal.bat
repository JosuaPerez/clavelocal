@echo off
title ClaveLocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo ClaveLocal necesita Node.js instalado en este PC.
  echo Descargalo desde https://nodejs.org y vuelve a intentarlo.
  pause
  exit /b 1
)
node server.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
