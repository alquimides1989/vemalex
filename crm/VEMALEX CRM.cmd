@echo off
setlocal
title VEMALEX CRM
cd /d "%~dp0"

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Se ha creado el archivo .env de configuracion.
  echo Revisa la clave maestra y la contrasena antes del primer uso real.
  notepad ".env"
)

set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%NODE_EXE%" (
  start "VEMALEX CRM Servidor" "%NODE_EXE%" "server.js"
) else (
  start "VEMALEX CRM Servidor" node "server.js"
)

timeout /t 2 >nul
start "" "http://127.0.0.1:8787"
