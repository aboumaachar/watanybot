@echo off
rem apex_native_file_redirect_runner_v1.cmd - safe, fixed runner
setlocal EnableExtensions DisableDelayedExpansion

:: args: %1=CMDTYPE %2=stdoutPath %3=stderrPath %4=exitCodePath %5=markerPath
if "%~1"=="" goto usage
set "CMDTYPE=%~1"
set "STDOUT=%~2"
set "STDERR=%~3"
set "EXITCODE=%~4"
set "MARKER=%~5"

if /I "%CMDTYPE%"=="FAST" (
  >"%STDOUT%" echo APEX_LIFECYCLE_FAST_PASS
  >"%STDERR%" (call ) 2>nul
  set EXIT=0
) else if /I "%CMDTYPE%"=="OUTERR" (
  >"%STDOUT%" echo APEX_LIFECYCLE_OUT_PASS
  >"%STDERR%" echo APEX_LIFECYCLE_ERR_PASS
  set EXIT=0
) else if /I "%CMDTYPE%"=="DELAYED" (
  >"%STDOUT%" echo APEX_LIFECYCLE_FIRST
  ping -n 1 -w 500 127.0.0.1 >nul
  >>"%STDOUT%" echo APEX_LIFECYCLE_LAST
  >"%STDERR%" (call ) 2>nul
  set EXIT=0
) else if /I "%CMDTYPE%"=="HIGHVOLUME" (
  if exist "%STDOUT%" del /f /q "%STDOUT%" >nul 2>nul
  if exist "%STDERR%" del /f /q "%STDERR%" >nul 2>nul
  for /L %%i in (1,1,1000) do @echo LINE%%i>>"%STDOUT%"
  for /L %%j in (1,1,100) do @echo ERR%%j>>"%STDERR%"
  set EXIT=0
) else if /I "%CMDTYPE%"=="FAIL" (
  >"%STDOUT%" echo APEX_LIFECYCLE_FAIL_OUT
  >"%STDERR%" echo APEX_LIFECYCLE_FAIL_ERR
  set EXIT=7
) else (
  >"%STDERR%" echo UNKNOWN_CMDTYPE
  set EXIT=255
)

> "%EXITCODE%" echo %EXIT%
> "%MARKER%" echo CHILD_FINAL.marker
endlocal & exit /b %EXIT%

:usage
echo Usage: %~nx0 CMDTYPE stdoutPath stderrPath exitCodePath markerPath
endlocal & exit /b 2
