@echo off
title Lume - Publicar na Oracle
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Publicar-Lume.ps1" %*
set "LUME_PUBLISH_RESULT=%errorlevel%"
pause
exit /b %LUME_PUBLISH_RESULT%
