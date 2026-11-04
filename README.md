# 모두의 연말 — Google Sheets 연동 모임 일정 조율

모임 주최자가 웹에서 **새 모임 만들기 → 모임 링크 공유**를 하고, 참석자가 이름과 **참석 가능한 날짜 여러 개**를 선택하면 모든 기록이 **한 Google 스프레드시트**에 누적됩니다. 주최자는 웹에서 모임을 수정·마감할 수 있고, 참가 인원과 날짜별 인기 순위를 바로 확인할 수 있습니다.

- 프론트엔드: GitHub Pages (HTML/CSS/JavaScript, 빌드 의존성 없음)
- 데이터 저장·조회: Google Apps Script Web App
- 영구 기록: Google Spreadsheet의 `EVENTS`, `RESPONSES` 탭
- 인증: 관리자 모임 생성/수정은 무작위 관리자 키, 참가자 답변 수정은 브라우저별 무작위 토큰

> **중요: 아직 실제 시트 저장 연결이 완료된 버전은 아닙니다.** 사용자께서 제공한 `pubhtml` URL은 `config.js`에 미리 등록되어 있지만 **공개 보기용 링크**입니다. 그 주소만으로는 시트 내용을 변경할 권한이 없습니다. 원본 시트에서 Apps Script 한 번 배포하고 `/exec` URL을 입력해야 공동 저장이 시작됩니다. 브라우저 미리보기에서 입력한 모임/참석자는 본인 기기에만 저장되며 실제 시트로 자동 이전되지 않습니다.

## 연결하려는 공개 스프레드시트

문서: **연말모임일정 공고** (게시된 탭 `시트1`)

<https://docs.google.com/spreadsheets/d/e/2PACX-1vTDfTvru5Z7yFeD4yIGEMVVOVF4kU6uCH_snsMfpY2QK99PSg29Bk-IMA6whr4rVPN9EBsg8rHixaF5/pubhtml>

이 게시 주소는 웹사이트 메뉴의 **공개 시트**에 연결되어 있습니다. **원본의 편집 URL**이나 Apps Script 배포 주소는 포함되어 있지 않습니다. 연결하려면 반드시 원본 시트의 편집 권한이 있어야 합니다.

## 최초 1회: Google Sheets 실저장 연결

### 1. 원본 스프레드시트에서 Apps Script 열기

1. Google Drive에서 `연말모임일정 공고`의 **편집 가능한 원본**을 엽니다. `pubhtml` 주소가 아닌 편집 화면이어야 합니다.
2. 상단 **확장 프로그램 → Apps Script**를 누릅니다.
3. 생성된 `Code.gs`의 내용을 지우고, 이 프로젝트 `apps-script/Code.gs` 내용을 전부 붙여 넣고 저장합니다.
4. 상단 함수 선택 드롭다운에서 `setupSheets`를 선택하고 **실행**합니다. 최초 1회 Google 계정 권한을 승인합니다.
5. 원본 스프레드시트에 `EVENTS`, `RESPONSES` 탭이 생깁니다. 기존 `시트1`은 변경하거나 삭제하지 않습니다.
6. Apps Script의 **실행 로그**에서 `관리자 키 (최초 1회 표시...)` 뒤의 **64자리 관리자 키**를 복사해 **비공개로 보관**합니다. 다른 사람에게 공유하지 마세요. 분실 시 편집기에서 `resetAdminKey`를 실행하면 이전 키가 무효화되고 새 키가 로그에 나옵니다.

### 2. Apps Script를 웹 앱으로 게시하기

1. 우측 위 **배포 → 새 배포**를 누릅니다.
2. 유형을 **웹 앱**으로 선택합니다.
3. **다음 사용자 인증 정보로 실행: 나(소유자)**, **액세스 권한이 있는 사용자: 모든 사용자(Anyone)**로 지정합니다. (소규모 공개 모임용; 조직 계정은 공개 옵션이 제한될 수 있습니다.)
4. **배포**를 누르고 `https://script.google.com/macros/s/.../exec`로 끝나는 URL을 복사합니다. `/dev` 주소를 사용하면 다른 사용자는 접근할 수 없습니다.
5. 이 프로젝트의 `config.js`에서 `appsScriptUrl`을 변경합니다.

```js
appsScriptUrl: 'https://script.google.com/macros/s/발급받은_배포_ID/exec',
```

6. 수정된 프로젝트를 GitHub에 push하면 Actions가 자동으로 배포합니다. **이 주소는 사용자가 공유할 사이트의 모든 브라우저에서 공통으로 사용**합니다.

**Apps Script의 코드 내용 자체를 나중에 변경했다면** `배포 → 배포 관리 → 수정 → 버전 새로 만들기 → 배포`하여 새 코드를 반영해야 합니다. 코드 편집만 해서는 기존 `/exec`에 반영되지 않을 수 있습니다.

### 3. 실제 저장 점검

1. GitHub Pages 사이트를 새로고침합니다. `Google Sheets 쓰기 연결 전` 배너가 사라지고 시트의 모임 목록이 보여야 합니다.
2. 상단 또는 메인의 **새 모임 만들기**를 누릅니다.
3. 제목·날짜 범위·장소·마감일을 입력하고 **64자리 관리자 키**를 넣어 **모임 만들고 링크 받기**를 누릅니다.
4. 원본 스프레드시트의 `EVENTS`에 새 행이 생성되는지 확인합니다.
5. 만든 모임에서 이름과 여러 날짜를 선택해 **가능한 날짜 제출하기**를 누릅니다.
6. `RESPONSES` 탭에 해당 이름과 날짜 목록이 기록되는지 확인하고, 웹페이지의 참여 인원 숫자가 증가하는지 확인합니다.

배포 성공 전에는 **실제 시트 저장이 된다고 표시하지 않습니다.** 서버 응답을 브라우저가 직접 읽기 어려워 POST 후 재조회하여 저장이 확인되어야 성공 메시지를 표시합니다.

## 실제 사용 방법

### 주최자: 모임 만들기 및 관리

- 메인 **새 모임 만들기** → 제목, 모임 안내, 장소, 시작 날짜, 마지막 날짜, 응답 마감일 입력
- 후보 날짜를 제한할 때 `2026-12-12, 2026-12-19`처럼 입력. 비우면 기간 전체가 후보가 됩니다. 최대 120일 범위
- `참여자 이름 공개` 여부는 모임별로 선택. 기본값은 **비공개**
- 관리자 키를 입력해 저장하면 `EVENTS` 시트에 자동 기록되고 모임 링크가 생깁니다.
- 모임 상세의 **모임 관리**에서 관리자 키를 사용해 제목/기간/후보 날짜 변경 또는 상태를 **모임 마감**으로 변경할 수 있습니다.
- 원본 시트에서도 `EVENTS` 내용을 직접 관리할 수 있습니다. `ID`와 1행 헤더는 변경하지 마세요.

### 참석자: 가능 날짜 등록 및 수정

- 공유된 모임 링크 열기 → 달력에서 가능한 날짜 **복수 선택** → 이름 입력·개인정보 안내 동의 → 제출
- 웹페이지에서 응답을 재조회하여 Google Sheets에 반영되었는지 확인합니다.
- 같은 브라우저에서 같은 모임을 다시 열면 **내 응답 수정하기**를 이용할 수 있습니다. 로컬 저장을 삭제하거나 다른 기기에서는 동일 응답을 자동 수정할 수 없습니다. 필요한 경우 시트 관리자에게 요청하세요.
- 이름, 선택 날짜, 기록/수정 시각, 익명 응답 ID를 `RESPONSES` 탭에 저장합니다.

## 데이터 구조

`EVENTS` — 모임당 1행

| ID | TITLE | DESCRIPTION | LOCATION | START_DATE | END_DATE | DEADLINE | STATUS | PUBLIC_NAMES | ALLOWED_DATES |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 난수 ID | 모임 이름 | 공지 내용 | 장소 | YYYY-MM-DD | YYYY-MM-DD | YYYY-MM-DD | OPEN/CLOSED | TRUE/FALSE | 쉼표 구분 날짜 |

`RESPONSES` — 응답당 1행

| ID | EVENT_ID | NAME | DATES_JSON | CREATED_AT | UPDATED_AT | TOKEN_HASH | STATUS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 익명 ID | 연결 모임 ID | 이름 | `['...']` 형태의 JSON 배열 | 등록 시각 | 수정 시각 | 수정 토큰 SHA-256 | ACTIVE |

기본 `setupSheets()`는 기존 `시트1`을 지우거나 덮어쓰지 않고, 모임 예시도 실제 시트에 자동 생성하지 않습니다. 다만 이름이 같은 `EVENTS`나 `RESPONSES` 탭이 기존에 존재하고 헤더 구조가 다르면 잘못 덮어쓰지 않도록 **오류로 중단**합니다.

## 개인정보 및 보안 유의사항

- `PUBLIC_NAMES=FALSE`일 때도 **원본 RESPONSES 시트에는 이름이 저장**됩니다. 웹 응답 조회에서만 이름을 `비공개`로 바꿔 반환합니다.
- **기존 Google Sheets가 모든 시트를 인터넷에 게시**하도록 설정되어 있다면 `RESPONSES` 탭도 공개될 위험이 있습니다. 게시 설정에서 **`시트1` 등 꼭 필요한 탭만 공개**하세요. `RESPONSES` 탭은 게시하지 않는 편이 안전합니다.
- 관리자 키는 브라우저의 공개 JavaScript 소스나 GitHub 저장소에 기록하지 않습니다. 제출할 때에만 입력하며 Script Properties에는 키의 해시가 저장됩니다.
- Google Apps Script 웹 앱을 `Anyone`으로 게시하면 참여 신청 API는 공개됩니다. 서버 검증·시트 Lock은 있지만 악의적 반복 요청을 완벽하게 차단하는 인증이나 사용량 제한은 제공하지 않습니다. 소규모 모임에 적합합니다.
- 연락처, 주민등록번호, 주소 등 민감한 개인정보는 받지 않는 것이 좋습니다.
- `pubhtml`은 원본 시트를 편집하거나 쓰는 URL이 아니므로 그 주소만으로 **실제 등록을 자동 활성화하는 것은 불가능**합니다.

## GitHub Pages 배포

### Windows: 원클릭 도구

1. Git for Windows와 GitHub CLI를 설치합니다.
2. `github-bootstrap.cmd`를 실행합니다. 이 파일은 Git/GitHub CLI 설치 여부 확인, 인증, 저장소 생성, push, Pages 배포 상태 점검을 돕습니다.
3. GitHub 저장소의 `Settings → Pages → Build and deployment → Source`를 **GitHub Actions**로 선택합니다.
4. 배포 후 `https://GITHUB_USER.github.io/year-end-together/`에서 사이트를 엽니다.

`[CHECK] git`에서 오류가 나면 새 PowerShell 창에서 `git --version`, `gh --version`을 확인하세요. 설치 명령: `winget install --id Git.Git -e --source winget` 및 `winget install --id GitHub.cli -e --source winget`.

#### Windows `Filename too long` / `git add` 오류

`Stage and commit files` 단계에서 `.git/objects/...: Filename too long`이 표시되면 **GitHub 로그인 오류가 아니라 Windows 경로 길이 문제**일 가능성이 큽니다.

1. Windows PowerShell에서 `git config --global core.longpaths true`를 실행합니다.
2. 프로젝트 경로가 길면 **프로젝트 폴더 전체**를 `C:\YE\year-end-together` 등 짧은 경로로 옮깁니다. `.git` 숨김 폴더도 함께 이동해야 합니다. 또는 원본 ZIP을 `C:\YE`에 다시 풀어도 됩니다.
3. 옮긴 폴더의 `github-bootstrap.cmd`를 다시 실행합니다. 이미 만들어진 `.git`/commit/remote는 가능한 범위에서 재사용하므로 다시 시작해도 됩니다.

이 스크립트는 재실행 시 **현재 저장소에 `core.longpaths=true`를 설정**합니다. 오류가 여전히 발생한다면 Windows 파일 경로/권한 또는 보안 소프트웨어 제한이 있을 수 있으므로 오류 메시지 전체를 확인하세요.

#### `[rejected] main -> main (fetch first)` / GitHub 기존 커밋 충돌

GitHub 저장소가 이전 시도에서 이미 만들어져 있고 `main`에 커밋이 있으면, 새로 압축 해제한 프로젝트의 로컬 Git 이력과 달라 그대로 `push`할 수 없습니다. **정상적인 보호 동작**이며, `--force`를 실행하지 마세요.

1. 이 ZIP의 최신 `github-bootstrap.cmd`만 기존 프로젝트 폴더에 덮어씁니다. **`.git` 폴더와 기존 `config.js`는 그대로 두세요.**
2. CMD를 다시 실행하면 기존 GitHub `main`을 `fetch`합니다. 기존 기록이 다른 경우 확인 질문이 나옵니다.
3. 현재 로컬 웹사이트가 게시해야 할 최신 버전이고, 기존 GitHub `main`이 예전 이 사이트의 버전임이 맞다면 `YES`를 입력합니다. 그렇지 않다면 `NO`로 취소합니다.
4. 스크립트는 GitHub에 `backup-main-before-update-날짜시각` 백업 브랜치를 만든 뒤, **기존 커밋 이력을 보존하는 병합 커밋**을 만들고 `main`을 일반 push합니다. 원격에서만 존재하던 파일은 새 `main`의 작업 트리에서 빠질 수 있지만, Git 이력과 백업 브랜치에는 남습니다.
5. 만약 `main`에 다른 사용자의 중요한 수정이 있다면 자동 병합하지 말고 그 변경을 먼저 검토하세요. 원격의 새 커밋이 중간에 생겨 push가 거절되면 다시 확인해야 합니다.

### 수동 업로드

프로젝트 폴더의 파일들을 GitHub Repository 최상위에 올립니다 (ZIP 자체 업로드 아님). `.github/workflows/deploy.yml`이 main 브랜치 push 때마다 정적 파일을 `_site`에 복사하여 자동 배포합니다. React/Vite 빌드 과정은 없습니다.

## 로컬 실행 및 테스트

```bash
python -m http.server 8000
# localhost:8000 에 접속
node --check app.js
node tests/apps-script.test.cjs
python3 tests/smoke.py
python3 scripts/prepare-site.py
```

Node는 테스트용이며, 실제 사이트 실행에 필수는 아닙니다. 로컬 테스트는 Google 서버에 쓰지 않고 Apps Script를 모의 구현으로 점검합니다. **실제 계정에서 배포한 후의 Google Sheets 쓰기 성공 여부는 별도 확인해야 합니다.**

## 프로젝트 파일

- `config.js` — Google Sheets 게시 URL(읽기 링크) 및 Apps Script `/exec` URL 설정
- `app.js` — 모임 목록, 신규/수정 폼, 달력, 응답, 참여 현황, Apps Script 호출
- `apps-script/Code.gs` — 시트 준비, 관리자 키 발급, 모임/응답 읽기·쓰기
- `styles.css` — 반응형 디자인/테마
- `.github/workflows/deploy.yml` — GitHub Pages 자동 배포
- `github-bootstrap.cmd` — Windows GitHub CLI 초기 업로드 지원
- `assets/` — 앱 아이콘, Favicon, OG/소셜 프리뷰

## 향후 확장

모임별 관리자 역할, 응답 삭제/복구, 참석 가능 시간대 선택, CSV 내보내기, 알림 발송 등. 무분별한 공개 쓰기를 방지하려면 CAPTCHA·인증을 추가한 서버리스 API가 필요할 수 있습니다.

## License

[MIT License](LICENSE). 기존 Google Sheets의 데이터는 라이선스 대상이 아닙니다.
