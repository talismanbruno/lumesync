@echo off
title Lume - Desenvolvimento
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Lume.ps1" dev
if errorlevel 1 pause
