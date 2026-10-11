@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0app-updater.ps1" -SourceDirectory "%~dp0." -Interactive
if errorlevel 1 pause
