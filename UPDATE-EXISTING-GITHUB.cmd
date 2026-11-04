@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "SOURCE=%CD%"
set "REPOSITORY=ko9ma7/year-end-together"
set "TARGET=C:\YE\year-end-live"

echo ===============================================
echo Year-End Together: Update EXISTING GitHub repo

echo ===============================================
if not exist "%SOURCE%\config.js" (
  echo [ERROR] config.js not found in project folder.
  pause
  exit /b 1
)
where git >nul 2>&1 || (echo [ERROR] Install Git for Windows.& pause & exit /b 1)
where gh >nul 2>&1 || (echo [ERROR] Install GitHub CLI.& pause & exit /b 1)
gh auth status >nul 2>&1 || (echo [ERROR] Run: gh auth login& pause & exit /b 1)
findstr /C:"appsScriptUrl: ''" "%SOURCE%\config.js" >nul 2>&1
if not errorlevel 1 (
  echo [WARN] Google Sheets Apps Script URL is EMPTY in config.js.
  echo [WARN] The site will NOT save events until /exec URL is configured.
  choice /C YN /M "Continue deploying without Google Sheets connection"
  if errorlevel 2 exit /b 2
)
if not exist "C:\YE" mkdir "C:\YE"
if exist "%TARGET%" if not exist "%TARGET%\.git" (
  echo [ERROR] %TARGET% exists and is not a Git repository.
  echo [HELP] Rename the folder, then retry. No files were removed.
  pause
  exit /b 1
)
if not exist "%TARGET%\.git" (
  echo [CHECK] Cloning existing repository into short path
  gh repo clone "%REPOSITORY%" "%TARGET%" || (echo [ERROR] Clone failed.& pause & exit /b 1)
) else (
  echo [CHECK] Updating existing clone
  git -C "%TARGET%" pull --ff-only || (echo [ERROR] Pull failed: resolve Git conflict manually.& pause & exit /b 1)
)
echo [CHECK] Copying source files into the existing repository
robocopy "%SOURCE%" "%TARGET%" /E /XD .git _site __pycache__ .pytest_cache /XF *.zip *.pyc >nul
if errorlevel 8 (echo [ERROR] File copy failed.& pause & exit /b 1)
cd /d "%TARGET%"
git config core.longpaths true
git add -A || (echo [ERROR] git add failed.& pause & exit /b 1)
git diff --cached --quiet
if not errorlevel 1 (
 echo [OK] No changed files to publish.
) else (
 git commit -m "feat: connect shared year-end events and organizer passwords" || (echo [ERROR] Commit failed.& pause & exit /b 1)
)
echo [CHECK] Pushing main without --force
git push origin main || (echo [ERROR] Push rejected. Remote changed; retry after pull.& pause & exit /b 1)
echo [OK] Source pushed. Confirm GitHub Actions status:
echo https://github.com/ko9ma7/year-end-together/actions
echo [SITE] https://ko9ma7.github.io/year-end-together/
pause
exit /b 0
