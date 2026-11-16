#requires -Version 5.1
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DbName = 'year-end-together-db'
$DbId = '8f929a39-713a-49cf-9270-1f7c187b9148' # Existing D1 UUID from the user's dashboard URL
$ExpectedAccountId = '664c91383c10ee31b141903364c13c7d' # Account ID shown by wrangler whoami
$WorkerName = 'floral-thunder-c7b0'
$WorkerUrl = 'https://floral-thunder-c7b0.mullimulli-api.workers.dev'
$RepoUrl = 'https://github.com/ko9ma7/year-end-together.git'
$RepoDir = Join-Path $env:LOCALAPPDATA 'YearEndTogetherDeployRepo'
$SchemaPath = Join-Path $ProjectRoot 'cloudflare\schema.sql'
$WorkerSource = Join-Path $ProjectRoot 'cloudflare\worker.js'
Set-Location $ProjectRoot

function Fail([string]$Message) { throw $Message }
function Write-Step([string]$Message) {
  Write-Host "`n============================================================" -ForegroundColor DarkCyan
  Write-Host $Message -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkCyan
}
function Invoke-Npx([string[]]$NpxArgs, [string]$Label) {
  Write-Host "`n> $Label" -ForegroundColor Yellow
  & $script:NpxPath @NpxArgs
  $code = $LASTEXITCODE
  if ($code -ne 0) { Fail "$Label 실패 (종료 코드: $code)" }
}
function Invoke-Git([string[]]$GitArgs, [string]$Label) {
  Write-Host "`n> $Label" -ForegroundColor Yellow
  & $script:GitPath -C $RepoDir @GitArgs
  $code = $LASTEXITCODE
  if ($code -ne 0) { Fail "$Label 실패 (종료 코드: $code)" }
}

try {
  Write-Host '모두의 연말 V2 자동 배포' -ForegroundColor Green
  Write-Host '대상 D1: year-end-together-db'
  Write-Host '대상 Worker: floral-thunder-c7b0'
  Write-Host '대상 GitHub: ko9ma7/year-end-together (main)'
  Write-Host '기존 DB 행은 삭제하지 않습니다.' -ForegroundColor Green

  foreach ($file in @($SchemaPath, $WorkerSource, (Join-Path $ProjectRoot 'index.html'), (Join-Path $ProjectRoot 'app.js'), (Join-Path $ProjectRoot 'maps.js'), (Join-Path $ProjectRoot 'styles.css'), (Join-Path $ProjectRoot 'config.js'), (Join-Path $ProjectRoot 'scripts\prepare-site.py'))) {
    if (-not (Test-Path -LiteralPath $file)) { Fail "필수 파일이 없습니다: $file`n전체 ZIP을 한 폴더에 압축 해제한 뒤 deploy.cmd를 실행하세요." }
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js LTS가 필요합니다: https://nodejs.org/' }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Fail 'npm을 찾을 수 없습니다. Node.js LTS를 다시 설치해 주세요.' }
  $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
  if (-not $npxCommand) { $npxCommand = Get-Command npx -ErrorAction SilentlyContinue }
  if (-not $npxCommand) { Fail 'npx를 찾을 수 없습니다. Node.js LTS를 설치한 뒤 새 명령창에서 다시 실행해 주세요.' }
  $script:NpxPath = if ($npxCommand.Source) { $npxCommand.Source } else { $npxCommand.Definition }
  $gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
  if (-not $gitCommand) { $gitCommand = Get-Command git -ErrorAction SilentlyContinue }
  if (-not $gitCommand) { Fail 'Git for Windows가 필요합니다: https://git-scm.com/download/win' }
  $script:GitPath = if ($gitCommand.Source) { $gitCommand.Source } else { $gitCommand.Definition }

  Write-Step '1/7. Cloudflare 로그인 확인'
  $whoamiOutput = & $script:NpxPath --yes wrangler@4 whoami 2>&1
  $whoamiExit = $LASTEXITCODE
  $whoamiText = ($whoamiOutput | Out-String).Trim()
  $whoamiOutput | ForEach-Object { Write-Host $_ }
  if ($whoamiExit -ne 0) {
    Write-Host '브라우저에서 Cloudflare 로그인을 진행해 주세요.' -ForegroundColor Yellow
    Invoke-Npx @('--yes','wrangler@4','login') 'Cloudflare 로그인'
    $whoamiOutput = & $script:NpxPath --yes wrangler@4 whoami 2>&1
    $whoamiExit = $LASTEXITCODE
    $whoamiText = ($whoamiOutput | Out-String).Trim()
    $whoamiOutput | ForEach-Object { Write-Host $_ }
    if ($whoamiExit -ne 0) { Fail 'Cloudflare 로그인 확인에 실패했습니다.' }
  }
  if ($whoamiText -notmatch [regex]::Escape($ExpectedAccountId)) {
    Fail "로그인된 Cloudflare 계정이 예상 계정과 다릅니다. 기대 계정 ID: $ExpectedAccountId`n아무것도 변경하지 않았습니다."
  }

  Write-Step '2/7. 기존 D1 데이터베이스 확인'
  Write-Host '대시보드에서 확인된 기존 D1 UUID를 사용합니다.' -ForegroundColor Yellow
  $infoOutput = & $script:NpxPath --yes wrangler@4 d1 info $DbName 2>&1
  $infoExit = $LASTEXITCODE
  $infoText = ($infoOutput | Out-String).Trim()
  $infoOutput | ForEach-Object { Write-Host $_ }
  if ($infoExit -ne 0) { Fail "기존 D1 '$DbName' 조회에 실패했습니다. 계정과 D1 이름을 확인하세요.`n$infoText" }
  if ($DbId -notmatch '^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$') {
    Fail '배포 스크립트에 저장된 D1 UUID 형식이 올바르지 않습니다. 아무것도 변경하지 않았습니다.'
  }
  $reportedIds = [regex]::Matches($infoText, '(?i)\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b')
  foreach ($reportedId in $reportedIds) {
    if ($reportedId.Value -ne $DbId) {
      Fail "Cloudflare D1 조회 결과 ID와 대시보드에서 확인한 ID가 다릅니다.`n조회 결과: $($reportedId.Value)`n확인된 ID: $DbId`n아무것도 변경하지 않았습니다."
    }
  }
  Write-Host "기존 D1 확인 완료: $DbName / $DbId" -ForegroundColor Green

  Write-Step '3/7. 배포 전 백업 파일 자동 생성'
  $backupDir = Join-Path $env:USERPROFILE 'Documents\YearEndTogetherBackups'
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupPath = Join-Path $backupDir "year-end-together-db-$stamp.sql"
  Invoke-Npx @('--yes','wrangler@4','d1','export',$DbName,'--remote','--output',$backupPath,'--skip-confirmation') '기존 D1 원격 백업'
  if (-not (Test-Path -LiteralPath $backupPath) -or (Get-Item -LiteralPath $backupPath).Length -lt 20) { Fail 'D1 백업 파일이 생성되지 않았습니다. 안전을 위해 배포를 중단했습니다.' }
  Write-Host "백업 저장 위치: $backupPath" -ForegroundColor Green
  $confirm = Read-Host '백업이 생성되었습니다. 계속 배포하려면 DEPLOY 입력'
  if ($confirm -ne 'DEPLOY') { Fail '사용자가 취소했습니다. 백업만 생성했고 DB/Worker/GitHub는 변경하지 않았습니다.' }

  Write-Step '4/7. 기존 D1에 장소 기능 테이블만 추가'
  $schemaText = Get-Content -Raw -LiteralPath $SchemaPath
  if ($schemaText -match '(?im)^\s*(DROP|DELETE|TRUNCATE|ALTER)\s+') { Fail '안전 검사 실패: SQL에 삭제/변경 명령이 있어 중단했습니다.' }
  Invoke-Npx @('--yes','wrangler@4','d1','execute',$DbName,'--remote','--file',$SchemaPath,'--yes') '장소 기능용 테이블 추가'

  Write-Step '5/7. GitHub 저장소 준비'
  if (-not (Test-Path (Join-Path $RepoDir '.git'))) {
    if (Test-Path $RepoDir) { Fail "기존 배포 폴더가 Git 저장소가 아닙니다: $RepoDir`n폴더 이름을 바꾼 뒤 다시 실행하세요." }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $RepoDir) | Out-Null
    Write-Host 'GitHub 로그인 창이 나타나면 인증해 주세요.' -ForegroundColor Yellow
    & $script:GitPath clone --branch main $RepoUrl $RepoDir
    if ($LASTEXITCODE -ne 0) { Fail 'GitHub 저장소 복제에 실패했습니다. GitHub 접근 권한을 확인하세요.' }
  } else {
    $origin = (& $script:GitPath -C $RepoDir remote get-url origin 2>$null | Out-String).Trim()
    if ($origin -notmatch 'github\.com[:/]ko9ma7/year-end-together(?:\.git)?$') { Fail "배포 폴더의 GitHub 주소가 예상 저장소와 다릅니다: $origin" }
    $dirty = (& $script:GitPath -C $RepoDir status --porcelain | Out-String).Trim()
    if ($dirty) { Fail "기존 배포 폴더에 미커밋 변경이 있어 보존을 위해 중단했습니다: $RepoDir" }
    Invoke-Git @('checkout','main') 'main 브랜치 선택'
    Invoke-Git @('pull','--ff-only','origin','main') 'GitHub 최신 파일 가져오기'
  }

  Write-Step '6/7. Worker 배포 및 D1 연결 확인'
  $copyArgs = @($ProjectRoot,$RepoDir,'/E','/XD','.git','_site','node_modules','.wrangler','/XF','*.zip','*.log')
  & robocopy @copyArgs
  $copyExit = $LASTEXITCODE
  if ($copyExit -ge 8) { Fail "프로젝트 파일 복사 실패 (Robocopy 코드 $copyExit)" }
  foreach ($otherConfig in @('wrangler.toml','wrangler.json')) {
    if (Test-Path (Join-Path $RepoDir $otherConfig)) { Fail "저장소 루트에 $otherConfig가 있습니다. 중복 설정을 자동 덮어쓰지 않고 중단했습니다." }
  }
  $wranglerConfig = [ordered]@{
    name = $WorkerName
    main = 'cloudflare/worker.js'
    compatibility_date = '2026-11-16'
    workers_dev = $true
    d1_databases = @([ordered]@{ binding = 'DB'; database_name = $DbName; database_id = $DbId })
  }
  $wranglerPath = Join-Path $RepoDir 'wrangler.jsonc'
  $wranglerConfig | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $wranglerPath -Encoding UTF8
  Push-Location $RepoDir
  try { Invoke-Npx @('--yes','wrangler@4','deploy','--config','wrangler.jsonc') '기존 Worker 코드 배포' }
  finally { Pop-Location }

  $health = $null
  for ($i=1; $i -le 10; $i++) {
    try { $health = Invoke-RestMethod -Uri "$WorkerUrl/health" -TimeoutSec 20; break }
    catch { Start-Sleep -Seconds 3 }
  }
  if (-not $health -or $health.ok -ne $true -or $health.database -ne 'connected') { Fail "Worker /health 확인 실패: $WorkerUrl/health`nD1 바인딩을 확인해야 합니다." }
  $required = @('events','responses','response_tokens','event_settings','place_proposals','place_votes','recovery_attempts')
  $missing = @($required | Where-Object { $health.tables -notcontains $_ })
  if ($missing.Count -gt 0) { Fail "D1 테이블 확인 실패: $($missing -join ', ')" }
  $rootInfo = Invoke-RestMethod -Uri $WorkerUrl -TimeoutSec 20
  if ($rootInfo.version -ne '2026-places-v1') { Fail 'Worker 주소에서 새 버전이 확인되지 않았습니다. Worker 이름/도메인을 확인하세요.' }
  Write-Host 'Worker와 기존 D1 연결 확인 완료.' -ForegroundColor Green

  Write-Step '7/7. GitHub Pages 사이트 배포'
  $status = (& $script:GitPath -C $RepoDir status --porcelain | Out-String).Trim()
  if ($status) {
    $gitName = (& $script:GitPath -C $RepoDir config user.name 2>$null | Out-String).Trim()
    $gitEmail = (& $script:GitPath -C $RepoDir config user.email 2>$null | Out-String).Trim()
    if (-not $gitName) { $gitName = Read-Host 'Git 커밋에 표시할 이름'; & $script:GitPath -C $RepoDir config user.name $gitName }
    if (-not $gitEmail) { $gitEmail = Read-Host 'Git 커밋에 표시할 이메일'; & $script:GitPath -C $RepoDir config user.email $gitEmail }
    Invoke-Git @('add','-A') '변경 파일 준비'
    Invoke-Git @('commit','-m','Deploy date and place voting integration') '배포 커밋 생성'
    Invoke-Git @('push','origin','main') 'GitHub main 브랜치 업로드'
  } else { Write-Host 'GitHub 파일에 변경 사항이 없어 push를 건너뜁니다.' -ForegroundColor Yellow }

  Write-Host "`n배포 명령이 모두 끝났습니다." -ForegroundColor Green
  Write-Host "자동 백업: $backupPath"
  Write-Host "Worker 상태: $WorkerUrl/health"
  Write-Host 'GitHub Actions: https://github.com/ko9ma7/year-end-together/actions'
  Write-Host '사이트: https://ko9ma7.github.io/year-end-together/'
  try { Start-Process 'https://github.com/ko9ma7/year-end-together/actions' } catch {}
  Write-Host 'GitHub Actions에서 Pages 배포가 초록색 완료인지 확인하세요.' -ForegroundColor Yellow
}
catch {
  Write-Host "`n[중단] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host '안전을 위해 실패한 단계 뒤의 작업은 실행하지 않았습니다.' -ForegroundColor Yellow
  exit 1
}
