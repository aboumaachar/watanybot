@echo off
setlocal
set "PACKAGE_ROOT=%~dp0"
set "POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%POWERSHELL_EXE%" exit /b 11
if not exist "%PACKAGE_ROOT%controller.ps1" exit /b 12
if not exist "%PACKAGE_ROOT%preflight.ps1" exit /b 13
if "%~1"=="" exit /b 15
if "%~2"=="" exit /b 16
if "%~3"=="" exit /b 17
"%POWERSHELL_EXE%" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%PACKAGE_ROOT%controller.ps1" -ProjectRoot "%~1" -Mode "%~2" -OwnerApprovalToken "%~3"
exit /b %ERRORLEVEL%
