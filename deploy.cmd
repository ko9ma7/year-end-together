@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0deploy.ps1" (
  echo ERROR: deploy.ps1 is missing. Extract the complete ZIP first.
  pause
  exit /b 1
)
where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Windows PowerShell was not found.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Deployment stopped. Read the error above.
) else (
  echo Deployment script finished. Check GitHub Actions for Pages status.
)
echo.
pause
exit /b %RESULT%
