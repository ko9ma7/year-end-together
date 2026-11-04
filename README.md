# 모두의 연말 · 연말 모임 날짜 조율

> **모임 공지 → 참석자 이름 입력 → 가능한 날짜 여러 개 선택 → Google Sheets 저장 → 참여 현황 확인**

GitHub Pages에 배포하는 한국어 반응형 정적 사이트입니다. 별도 유료 서버·DB·회원가입 없이 **Google Apps Script를 쓰기 API, Google 스프레드시트를 저장소**로 활용합니다. 의존성 설치와 JS 빌드가 필요 없는 순수 HTML/CSS/JavaScript 구성입니다.

**중요:** 제공된 스프레드시트의 `/pubhtml` URL은 **읽기용 공개 게시 주소**이고, API 쓰기 권한을 주지 않습니다. 데이터를 실제로 저장하려면 아래 Apps Script 연결을 반드시 완료해야 합니다. 연결 전 사이트는 **미리보기 모드**로 동작하며 응답은 본인 브라우저 LocalStorage에만 저장됩니다.

## Preview / 주요 기능

- **메인**: '모두의 연말' 소개, 모임 목록, 진행 현황, 참여 방법
- **모임 상세**: 월별 달력, 날짜 다중 선택, 기존 참석자 수, 추천 인기 날짜, 이름·동의 제출
- **참여 현황**: 가능한 날짜 TOP 6, 공개 동의한 참가자의 이름 및 선택 날짜 수
- **저장 및 수정**: Apps Script POST → 시트 저장 → 공개 조회 API를 통한 **실제 반영 확인**. 브라우저에 보관한 익명 ID·비밀 토큰으로 기존 응답 수정
- **모임 관리**: `EVENTS` 시트에서 모임 제목, 설명, 장소, 기간, 마감일, 허용 날짜 및 공개 여부 관리
- **UI**: 모바일/태블릿/PC 대응, 다크모드, 입력/네트워크 오류 안내, 다중 날짜 선택, 링크 공유, 404 페이지
- **브랜딩**: favicon, Apple Touch Icon, PWA manifest, OG/Twitter preview, GitHub repository preview

## Tech Stack

HTML5 + CSS3 + ES6, Google Apps Script, Google Sheets, GitHub Pages/Actions. 외부 JS 프레임워크 및 실행 시 외부 폰트 필수 의존성이 없습니다.

## Project Structure

```text
.
├── index.html            # 페이지, SEO / 공유 미리보기 메타
├── styles.css            # UI / 반응형 / 테마
├── app.js                # 화면·달력·응답 저장/조회·상태 처리
├── config.js             # 앱 이름·Apps Script URL·미리보기 모임
├── apps-script/
│   ├── Code.gs           # Google Sheets 읽기/쓰기 API
│   └── appsscript.json   # Apps Script 설정
├── assets/               # 아이콘 및 OG/Repository 미리보기 이미지
├── manifest.webmanifest
├── 404.html
├── scripts/prepare-site.py # Actions 게시용 파일·절대 OG URL
├── .github/workflows/deploy.yml
├── github-bootstrap.cmd  # GitHub CLI 원클릭 업로드 (Windows)
└── README.md
```

## 1. Google 스프레드시트에 연결하기 (필수)

### 1-1. 원본 시트에서 Apps Script 열기

1. **편집 가능한 원본 Google 스프레드시트**를 엽니다. `.../pubhtml`은 편집 화면이 **아닙니다**. 원본 파일에 대한 권한이 필요합니다.
2. **확장 프로그램 → Apps Script**를 선택합니다. (원본에 바인딩된 Script 프로젝트를 생성합니다.)
3. 프로젝트의 `Code.gs` 내용을 전부 지우고, 이 프로젝트의 `apps-script/Code.gs` 전체를 붙여넣습니다.
4. 저장 후 함수 선택 메뉴에서 **`setupSheets`**를 선택하고 **실행**합니다. 최초 실행 시 스프레드시트 접근 권한을 승인합니다.
5. 원본 시트에 `EVENTS`, `RESPONSES` 탭이 준비됩니다. **다른 기존 탭은 수정하지 않습니다.**

### 1-2. `EVENTS` 탭에서 모임 공지 편집하기

`EVENTS` 탭은 다음 **열 이름(1행)을 그대로** 유지합니다.

| 열 | 의미 | 예시 |
| --- | --- | --- |
| `ID` | 고유한 모임 ID (수정 주의) | `year-end-2026` |
| `TITLE` | 모임 이름 | `2026 연말 모임` |
| `DESCRIPTION` | 상세 설명 | `가능한 날을 모두 체크해 주세요` |
| `LOCATION` | 장소 | `서울 시내, 추후 결정` |
| `START_DATE` | 첫 후보 날짜 | `2026-12-01` |
| `END_DATE` | 마지막 후보 날짜 | `2026-12-31` |
| `DEADLINE` | 응답 마감일 | `2026-12-20` |
| `STATUS` | 응답 상태 | `OPEN` 또는 `CLOSED` |
| `PUBLIC_NAMES` | 웹페이지에 참가자 이름 공개 | `TRUE` 또는 `FALSE` |
| `ALLOWED_DATES` | 특정 후보일로 제한 (선택) | `2026-12-12,2026-12-19,2026-12-26` |

- `START_DATE` ~ `END_DATE`는 최대 **120일** 범위입니다.
- `ALLOWED_DATES`는 비워두면 해당 범위의 **모든 날짜**를 선택할 수 있습니다.
- 모임을 추가하려면 `EVENTS`의 **다음 빈 행**에 새 `ID`를 부여해 작성합니다.
- 날짜 칸은 `2026-12-01` 형식을 권장합니다. 시트가 날짜 값으로 자동 변환해도 코드는 처리합니다.
- `RESPONSES` 탭은 프로그램이 자동 작성하므로 **행/헤더/토큰 해시 값을 임의 편집하지 마세요.**

### 1-3. Google Apps Script 웹 앱 배포

1. Apps Script 오른쪽 위 **배포 → 새 배포**.
2. 유형: **웹 앱**.
3. **실행 사용자: 나**, **액세스 권한이 있는 사용자: 모든 사용자(Anyone)**로 설정합니다.
4. **배포** 후 발급되는 `https://script.google.com/macros/s/.../exec` 주소를 복사합니다. `/dev` 주소를 쓰지 마세요.
5. 이 프로젝트의 `config.js`에서 다음처럼 수정합니다.

```js
appsScriptUrl: 'https://script.google.com/macros/s/실제_배포_ID/exec',
```

6. 프로젝트를 GitHub에 배포합니다. `config.js` 변경 시 새 커밋/배포가 필요합니다.
7. 웹페이지에서 이름과 날짜를 입력하고 제출 → **'Google Sheets에 응답이 저장되었습니다'** 메시지 확인 → 원본 `RESPONSES` 탭의 신규 행을 확인합니다.

**Script 코드를 수정하면** Apps Script의 **배포 → 배포 관리 → 수정 → 버전 새로 만들기 → 배포**를 진행하세요. 웹 앱 `/exec` 배포 URL이 바뀐 경우 `config.js`도 변경합니다.

### 1-4. 실제 스프레드시트 데이터 구성

`RESPONSES`는 다음 데이터를 응답당 **한 행** 저장합니다.

| ID | EVENT_ID | NAME | DATES_JSON | CREATED_AT | UPDATED_AT | TOKEN_HASH | STATUS |
|---|---|---|---|---|---|---|---|
| 난수 ID | 모임 ID | 이름 | `["2026-12-12","2026-12-19"]` | UTC 시각 | UTC 시각 | SHA-256 | ACTIVE |

- 한 사람이 같은 브라우저에서 응답을 **수정**하면 새 행을 만들지 않고 기존 행의 `NAME`, `DATES_JSON`, `UPDATED_AT`을 갱신합니다.
- 브라우저를 바꾸거나 LocalStorage를 삭제하면 기존 응답 수정 권한을 자동으로 복구할 수 없습니다. 시트 관리자에게 수정 요청이 필요합니다.
- 여러 기기의 이름 중복을 금지하지는 않습니다. 같은 이름을 가진 사람이 있을 수 있기 때문입니다.
- **다른 방문자에게 보여주는 응답**에는 수정용 비밀 토큰 또는 그 해시가 포함되지 않습니다.

### 1-5. 기존 공개 게시 시트의 보안 유의사항

사용자가 제공한 `/pubhtml` 시트 링크는 사이트의 **'공개 시트'** 메뉴에 연결해 둔 상태입니다. 기존 시트가 모든 탭을 공개한 상태라면 `RESPONSES` 탭까지 누구나 볼 수 있을 수 있습니다. **Google Sheets 게시 설정에서 '특정 시트만 게시'하거나, `RESPONSES` 탭을 공개 대상에서 제외**하세요. 참가자 이름 공개가 필요하지 않다면 `PUBLIC_NAMES`는 `FALSE`로 설정하세요. 모임 참석 데이터에는 주민번호, 연락처 등 민감정보를 수집하지 마세요.

이 구성은 익명 소규모 모임용입니다. 공개 API 특성상 반복 제출/자동화 요청을 완벽하게 막지는 못하므로, 민감하거나 대규모 서비스에는 인증·서버 기반 접근 제어가 추가로 필요합니다.

## 2. 로컬 실행

정적 웹이므로 `npm install`, `npm run build`가 필요하지 않습니다. 저장 연결 전에도 미리보기로 사용 가능합니다.

```bash
# Python 3가 설치되어 있는 경우
python -m http.server 8000
# 브라우저에서 http://localhost:8000/ 열기
```

Windows에서는 프로젝트 폴더에서 `py -m http.server 8000`을 실행할 수도 있습니다. `index.html`을 직접 열어도 대체로 동작하지만 로컬 웹 서버 사용을 권장합니다.

### 검증

```bash
node --check app.js
node --check config.js
python3 scripts/prepare-site.py
```

빌드 산출물은 `_site/`입니다. 이는 GitHub Actions가 생성해 게시합니다.

## 3. GitHub Pages 배포

### Windows 자동 업로드 (권장)

1. [Git for Windows](https://git-scm.com/download/win)와 [GitHub CLI](https://cli.github.com/)를 설치합니다.
2. `github-bootstrap.cmd`를 더블클릭합니다.
3. 계정 로그인 및 Git 사용자 이름/이메일이 필요하면 안내대로 입력합니다.
4. 기본 저장소 `year-end-together`가 생성되고, `main` push → Actions → GitHub Pages 배포가 진행됩니다.
5. 완료 URL 예: `https://GITHUB_ID.github.io/year-end-together/`.

저장소 이름을 변경할 때는 `.cmd` 상단 `REPO_NAME`을 수정합니다. **GitHub 로그인 토큰을 파일에 기록할 필요가 없습니다.** 이미 다른 Git remote가 있는 경우에는 안전을 위해 자동 변경하지 않습니다.

### `github-bootstrap.cmd` 실행 직후 `[CHECK] git`에서 중단되는 경우

Windows **PowerShell을 새로 열고** 다음을 실행해 설치와 실행 경로를 확인합니다.

```powershell
git --version
gh --version
```

- `git` 명령을 찾을 수 없다면 Git for Windows 설치: `winget install --id Git.Git -e --source winget`
- `gh` 명령을 찾을 수 없다면 GitHub CLI 설치: `winget install --id GitHub.cli -e --source winget`
- 설치 후 **PowerShell 또는 CMD를 닫고 새 창을 열어** 위 버전 명령을 다시 확인합니다. 이후 `github-bootstrap.cmd`를 다시 실행합니다.
- 버전이 정상적으로 나온다면 `gh auth status`로 로그인 상태를 확인하고 `gh auth login`으로 로그인할 수 있습니다.
- **수정판 스크립트**는 Git/GitHub CLI가 없을 때 구체적인 설치 안내를 출력하며, 최초 실행 시 저장소 초기화와 Git 사용자 설정 순서를 바로잡았습니다.

### 수동 배포

1. GitHub에 공개 저장소를 만들고 프로젝트 파일을 **저장소 최상위**에 올립니다 (ZIP 파일 자체를 업로드하지 않음).
2. `Settings → Pages → Build and deployment → Source`에서 **GitHub Actions**를 선택합니다.
3. `main` 브랜치에 push합니다. `.github/workflows/deploy.yml`이 `_site/`를 생성·게시합니다.
4. 저장소의 `Actions`에서 `Deploy GitHub Pages`가 성공했는지 확인합니다.
5. `https://계정명.github.io/저장소명/`에 접속합니다.

GitHub Pages에는 서버 측 데이터 저장 기능이 **없으며**, 시트에 입력하려면 1단계 Apps Script 배포가 별도로 필요합니다.

## 4. Configuration

- `config.js`: `siteName`, `appsScriptUrl`, `publishedSheetUrl`, `demoEvent` 변경
- `EVENTS` 탭: 배포 후에도 **모임 정보·일자 관리** 가능. 시트를 수정하면 방문자가 새로고침할 때 반영됩니다.
- `PUBLIC_NAMES`: 응답자가 웹에 이름 공개될지 여부
- `index.html`: 메타·서비스 소개 변경
- `styles.css`: 브랜드 색상 및 디자인 토큰 수정
- `assets/og-image.png`: 링크 공유용 이미지, `assets/repository-preview.png`: GitHub 저장소용 이미지

GitHub Actions는 배포 시 `GITHUB_REPOSITORY`를 사용해 **OG 이미지·canonical URL을 절대 주소**로 변환합니다. 로컬 실행에서는 상대 경로가 유지됩니다.

## 5. Custom Domain

커스텀 도메인 사용 시 프로젝트 최상위에 `CNAME` 파일을 만들고 도메인 이름만 한 줄로 기록합니다 (예: `gather.example.com`). GitHub `Settings → Pages → Custom domain`에서도 동일 도메인을 설정하고 DNS `CNAME`/`A` 레코드를 GitHub 안내에 따라 지정합니다. DNS 적용 후 **Enforce HTTPS**를 활성화하세요.

## 6. 장애 처리

| 증상 | 확인 사항 |
|---|---|
| 미리보기 모드 표시 | `config.js`의 `appsScriptUrl`이 비어 있음. 시트에 **공유 저장되지 않음** |
| 시트 연결 오류 | `/exec` URL인지, `Anyone` 웹 앱 배포인지, 기존 스크립트 버전인지 확인 |
| 저장 여부 확인 실패 | 인터넷 연결, `RESPONSES` 시트 상태 확인 후 **같은 브라우저에서 재시도** |
| 날짜가 선택 안 됨 | `EVENTS` 날짜 범위/응답 마감 여부/`ALLOWED_DATES` 확인 |
| 이름이 안 보임 | `PUBLIC_NAMES` 설정 확인. `FALSE`이면 '비공개'로 표시됨 |
| 페이지 404 | `Actions` 배포 상태·저장소 경로와 GitHub Pages URL 확인 |

## 7. 접근성 및 개인정보

시맨틱 요소, 버튼 레이블·키보드 선택, 포커스 표시, 모드별 색 대비, 모바일 대응을 고려했습니다. 데이터 조회용 공개 웹 앱이므로 `PUBLIC_NAMES=TRUE` 시 응답자의 이름과 선택 날짜는 인터넷에서 접근 가능할 수 있습니다. 운영 전 참여자들에게 이를 고지하고 공개 범위를 결정하세요. 수정용 비밀 토큰은 브라우저 LocalStorage에 보관되며 Apps Script는 해당 토큰의 SHA-256 해시만 보관합니다.

## Repository 정보 (추천)

- **Name**: `year-end-together`
- **Description**: `연말 모임 날짜를 함께 조율하는 GitHub Pages 웹사이트`
- **Topics**: `github-pages`, `google-sheets`, `apps-script`, `scheduling`, `korean`
- **Social preview**: `assets/repository-preview.png`를 GitHub `Settings → General → Social preview`에서 업로드

## License

[MIT License](LICENSE). 원래 사용자의 스프레드시트 및 참석자 데이터는 라이선스 대상에 포함되지 않습니다.
