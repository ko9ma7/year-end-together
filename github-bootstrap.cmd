@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

rem ===== Modify only these variables if needed =====
set "REPO_NAME=year-end-together"
set "REPO_VISIBILITY=public"
set "REPO_DESCRIPTION=연말 모임 날짜를 함께 조율하는 GitHub Pages 웹사이트"
set "REPO_TOPICS=github-pages,google-sheets,apps-script,scheduling,korean"
set "INITIAL_TAG=v1.0.0"
rem ================================================

rem Direct checks avoid batch parsing errors in subroutines.
echo [CHECK] git
where git.exe >nul 2>nul
if errorlevel 1 goto :missing_git
git --version
if errorlevel 1 goto :missing_git
echo [OK] Git is available.

echo [CHECK] gh
where gh.exe >nul 2>nul
if errorlevel 1 goto :missing_gh
gh --version
if errorlevel 1 goto :missing_gh
echo [OK] GitHub CLI is available.

where node >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%V in ('node --version') do echo [OK] Node.js %%V (optional)
  node --check app.js || goto :fail
) else (
  echo [OK] Node.js not required for this static HTML project.
)

 echo [CHECK] GitHub CLI login
 gh auth status >nul 2>nul
 if errorlevel 1 (
   echo [WARN] Not logged in. GitHub login will start.
   gh auth login || goto :fail
 )
 for /f "delims=" %%U in ('gh api user --jq .login 2^>nul') do set "GH_OWNER=%%U"
 if not defined GH_OWNER (
   echo [ERROR] Cannot identify GitHub account. Run: gh auth login
   goto :fail
 )
 echo [OK] GitHub account: !GH_OWNER!

 echo [CHECK] Initialize Git repository
 if not exist ".git" (
   git init
   if errorlevel 1 goto :fail
 )
 git branch -M main
 if errorlevel 1 goto :fail

 echo [CHECK] Git identity
 for /f "delims=" %%N in ('git config user.name') do set "GIT_NAME=%%N"
 if not defined GIT_NAME (
   set /p "GIT_NAME=Git display name: "
   if not defined GIT_NAME goto :fail
   git config --local user.name "!GIT_NAME!" || goto :fail
 )
 for /f "delims=" %%E in ('git config user.email') do set "GIT_EMAIL=%%E"
 if not defined GIT_EMAIL (
   set /p "GIT_EMAIL=Git email: "
   if not defined GIT_EMAIL goto :fail
   git config --local user.email "!GIT_EMAIL!" || goto :fail
 )

 echo [CHECK] Stage and commit files
 git add -A || goto :fail
 git diff --cached --quiet
 if errorlevel 1 (
   git rev-parse --verify HEAD >nul 2>nul
   if errorlevel 1 (
     git commit -m "feat: launch year-end scheduling website" || goto :fail
   ) else (
     git commit -m "chore: update year-end scheduling website" || goto :fail
   )
 ) else (
   echo [OK] No new changes to commit.
 )

 echo [CHECK] GitHub repository !GH_OWNER!/%REPO_NAME%
 gh repo view "!GH_OWNER!/%REPO_NAME%" >nul 2>nul
 if errorlevel 1 (
   echo [CHECK] Creating GitHub repository
   if /i "%REPO_VISIBILITY%"=="private" (
     gh repo create "!GH_OWNER!/%REPO_NAME%" --private --description "%REPO_DESCRIPTION%" || goto :fail
   ) else (
     gh repo create "!GH_OWNER!/%REPO_NAME%" --public --description "%REPO_DESCRIPTION%" || goto :fail
   )
 ) else (
   echo [OK] Repository already exists.
 )

 git remote get-url origin >nul 2>nul
 if errorlevel 1 (
   git remote add origin "https://github.com/!GH_OWNER!/%REPO_NAME%.git" || goto :fail
 ) else (
   for /f "delims=" %%R in ('git remote get-url origin') do set "ORIGIN_URL=%%R"
   echo !ORIGIN_URL! | findstr /I /C:"!GH_OWNER!/%REPO_NAME%" >nul
   if errorlevel 1 (
     echo [ERROR] The existing origin remote points to a different repository: !ORIGIN_URL!
     echo [WARN] For safety, it was not changed. Fix with: git remote set-url origin https://github.com/!GH_OWNER!/%REPO_NAME%.git
     goto :fail
   )
 )
 echo [CHECK] Pushing main
 git push -u origin main || goto :fail

 set "PAGES_URL=https://!GH_OWNER!.github.io/%REPO_NAME%/"
 echo [CHECK] Set repository homepage and topics
 gh repo edit "!GH_OWNER!/%REPO_NAME%" --description "%REPO_DESCRIPTION%" --homepage "!PAGES_URL!" >nul 2>nul
 if errorlevel 1 echo [WARN] Could not apply Description/Homepage; configure manually in repository settings.
 gh repo edit "!GH_OWNER!/%REPO_NAME%" --add-topic %REPO_TOPICS% >nul 2>nul
 if errorlevel 1 echo [WARN] Could not apply topics; configure manually.

 echo [CHECK] Enable GitHub Pages with Actions
 gh api "repos/!GH_OWNER!/%REPO_NAME%/pages" --jq .build_type >nul 2>nul
 if errorlevel 1 (
   gh api -X POST "repos/!GH_OWNER!/%REPO_NAME%/pages" -f "build_type=workflow" >nul 2>nul
   if errorlevel 1 echo [WARN] Pages activation via API failed. Set: Settings - Pages - Source = GitHub Actions.
 ) else (
   gh api -X PUT "repos/!GH_OWNER!/%REPO_NAME%/pages" -f "build_type=workflow" >nul 2>nul
 )

 echo [CHECK] Run Pages deployment
 gh workflow run deploy.yml --ref main --repo "!GH_OWNER!/%REPO_NAME%" >nul 2>nul
 if errorlevel 1 echo [WARN] Dispatch unavailable; waiting for automatic push-triggered run.
 timeout /t 7 /nobreak >nul
 set "RUN_ID="
 for /f "delims=" %%I in ('gh run list --repo "!GH_OWNER!/%REPO_NAME%" --workflow deploy.yml --limit 1 --json databaseId --jq ".[0].databaseId" 2^>nul') do set "RUN_ID=%%I"
 if not defined RUN_ID (
   echo [WARN] No Actions run found yet. Inspect: https://github.com/!GH_OWNER!/%REPO_NAME%/actions
   goto :manual
 )
 echo [CHECK] Watching Actions run !RUN_ID!
 gh run watch !RUN_ID! --exit-status --repo "!GH_OWNER!/%REPO_NAME%"
 if errorlevel 1 (
   echo [WARN] Deployment failed. Inspect: gh run view !RUN_ID! --log-failed --repo !GH_OWNER!/%REPO_NAME%
   goto :manual
 )
 echo [OK] GitHub Pages deployment completed.

 git rev-parse "refs/tags/%INITIAL_TAG%" >nul 2>nul
 if errorlevel 1 (
   git tag "%INITIAL_TAG%" || goto :manual
   git push origin "%INITIAL_TAG%" || goto :manual
   echo [OK] Initial tag %INITIAL_TAG% pushed.
 ) else (
   echo [OK] Initial tag already exists.
 )
 echo.
 echo [OK] Project URL: !PAGES_URL!
 echo [WARN] Google Sheets writes require Apps Script deployment and config.js URL setup.
 goto :end

:manual
 echo [WARN] Check deployment status and permissions manually:
 echo        https://github.com/!GH_OWNER!/%REPO_NAME%/actions
 echo        https://github.com/!GH_OWNER!/%REPO_NAME%/settings/pages
 echo        Expected URL: !PAGES_URL!
 goto :end

:missing_git
 echo.
 echo [ERROR] Git is not installed or is not on PATH.
 echo [HELP] Install Git for Windows: https://git-scm.com/download/win
 echo [HELP] Or run this in PowerShell: winget install --id Git.Git -e --source winget
 echo [HELP] Close and reopen the terminal, then run github-bootstrap.cmd again.
 goto :fail

:missing_gh
 echo.
 echo [ERROR] GitHub CLI - gh - is not installed or is not on PATH.
 echo [HELP] Install GitHub CLI: https://cli.github.com/
 echo [HELP] Or run this in PowerShell: winget install --id GitHub.cli -e --source winget
 echo [HELP] Close and reopen the terminal, then run github-bootstrap.cmd again.
 goto :fail

:fail
 echo.
 echo [ERROR] Bootstrap could not finish. Read the message above and retry.
 echo [HELP] If Git and gh are installed: check git --version and gh --version.
 echo [HELP] Check GitHub login: gh auth status
:end
 echo.
 pause
 endlocal
