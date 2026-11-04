# 모두의 연말 — GitHub Pages + Google Sheets 모임 일정 관리

정적 웹페이지(GitHub Pages)에서 **모임을 직접 만들고**, 참석자가 이름과 가능한 날짜를 **여러 개 선택**하면 모든 기록이 **같은 Google Spreadsheet**에 저장되는 모임 일정 조율 사이트입니다. 다른 창·다른 기기에서도 새로고침하면 동일한 모임과 응답을 봅니다.

**현재 저장 연동 상태:** 프로젝트는 동작할 구조로 작성돼 있지만 사용자 원본 스프레드시트의 **Google Apps Script `/exec` 웹 앱 배포 주소가 아직 제공되지 않았으므로**, 저장이 활성화된 실제 운영 사이트는 아닙니다. 공개 `pubhtml` URL만으로 Google Sheets를 수정할 수 없습니다. 반드시 `START-HERE-KO.md`에 따라 Apps Script를 최초 1회 배포해야 합니다.

## 빠른 시작

**[START-HERE-KO.md](START-HERE-KO.md)**를 먼저 확인하세요. 원본 시트를 연 뒤 `apps-script/Code.gs`를 붙여 넣고 `setupSheets`를 실행합니다. Apps Script를 **나로 실행 / 모든 사용자** 웹 앱으로 배포해 `.../exec` 주소를 받아 `config.js`에 설정합니다. 그 다음 `UPDATE-EXISTING-GITHUB.cmd`로 기존 `ko9ma7/year-end-together` 저장소에 업데이트합니다.

## Preview / Features

- 실제 데이터만 보여주는 모임 목록: 처음에는 **모임 0개**, 가짜 샘플 데이터 없음
- 사이트 내 **새 모임 만들기**: 모임명, 소개, 장소, 시작/마지막 날짜, 응답 마감, 후보 날짜, 이름 공개 여부 설정
- 모임 생성 시 **모임별 관리 비밀번호 설정 및 확인** (8~128자)
- 만든 모임을 선택하면 모임 상세·복수 날짜 달력·참여자/날짜별 집계·모임 공유 링크 표시
- 모임별 관리 비밀번호를 확인한 후 **모임 정보 수정 또는 마감**
- 참석자 이름과 날짜를 Google Sheets `RESPONSES`에 누적 기록, 같은 브라우저에서 자신의 응답 수정 가능
- 크로스 오리진 저장 요청 후 **서버 수신증 확인**: 실패 또는 잘못된 관리 비밀번호를 등록 성공으로 표시하지 않음
- 연결되지 않으면 저장 버튼 비활성화: LocalStorage 미리보기 저장 제거
- 모바일/데스크톱 반응형, 키보드 접근성, 다크모드 저장, 맞춤 favicon/OG 이미지

## Tech Stack

HTML5 / CSS / Vanilla JavaScript ES6+, Google Apps Script, Google Spreadsheet, GitHub Actions, GitHub Pages. 클라이언트 의존성 및 Node 빌드 필수 과정 없음.

Google Apps Script는 `doGet`으로 공개 목록을 JSONP 형식으로 반환하고 `doPost`로 쓰기 요청을 받아 응답/모임을 스프레드시트에 저장합니다. GitHub Pages에서 `fetch()`의 크로스 오리진 POST 응답을 직접 판독할 수 없는 문제를 해결하기 위해 각 요청에 무작위 ID를 부여하고, Apps Script CacheService에 저장된 **수신증을 GET으로 재확인한 후에만** 저장 성공을 보여줍니다. 응답 본문에 비밀번호나 수정 토큰이 실리지 않습니다.

## Project Structure

```text
index.html / styles.css / app.js    웹 UI
config.js                            Apps Script URL 설정
apps-script/Code.gs                  서버 등록/조회/검증/모임별 비밀번호
START-HERE-KO.md                     Google Sheets 최초 1회 연결 안내
UPDATE-EXISTING-GITHUB.cmd          기존 GitHub 저장소 안전한 업데이트
.github/workflows/deploy.yml        GitHub Pages 자동 배포
scripts/prepare-site.py              정적 페이지 배포용 파일 생성
assets/                              favicon, app icons, social preview
404.html / manifest.webmanifest      오류 페이지, 앱 메타데이터
tests/apps-script.test.cjs           Apps Script 로컬 단위 테스트
```

## Local Development

`python -m http.server 8000`으로 프로젝트 루트에서 실행 후 `http://localhost:8000/`로 접근합니다. `config.js`가 비어 있으면 첫 페이지의 빈 상태만 보여주며 실제 등록은 할 수 없습니다. Apps Script를 배포하고 `/exec` 주소를 등록한 뒤에야 인터넷이 연결된 환경에서 동일한 원본 시트에 기록됩니다.

### Build / Validation

```bash
node tests/apps-script.test.cjs
python scripts/prepare-site.py
```

Node 설치는 필수가 아닙니다. 첫 번째 테스트에만 필요하며 실제 GitHub Pages 배포는 Python 스크립트로 HTML 파일을 복사합니다.

## Google Spreadsheet Schema

원본 스프레드시트에 이미 있는 `시트1`은 유지하고 다음 2개 탭을 신규 생성합니다.

`EVENTS`: `ID, TITLE, DESCRIPTION, LOCATION, START_DATE, END_DATE, DEADLINE, STATUS, PUBLIC_NAMES, ALLOWED_DATES`

`RESPONSES`: `ID, EVENT_ID, NAME, DATES_JSON, CREATED_AT, UPDATED_AT, TOKEN_HASH, STATUS`

모임 전용 **관리 비밀번호/해시/솔트는 어떤 스프레드시트 열에도 저장하지 않습니다.** Apps Script `PropertiesService.getScriptProperties()`에 `EVENT_PASSWORD_{모임ID}` 형태로 salt + SHA-256 해시만 저장합니다. 비밀번호 입력은 `doPost` 본문에서만 처리하며 `doGet` 응답에 포함되지 않습니다. 주최자만 아는 비밀번호가 없는 제3자는 수정/마감 요청을 통과할 수 없습니다. 분실 시 시트 소유자가 Apps Script 편집기의 `resetEventPassword`를 직접 실행할 수 있습니다.

**주의:** 스프레드시트가 공개 게시돼 있으면 `RESPONSES`의 이름과 선택 날짜가 노출될 수 있습니다. `pubhtml` 공개 게시를 중지하거나 최소한 `RESPONSES` 탭을 게시하지 마세요. Google Apps Script 공개 목록과 실제 시트 게시 공개 범위는 서로 다른 문제입니다. 모임 상세에서 이름 공개 여부는 모임별로 선택할 수 있지만, 그것만으로 원본 시트 공개를 막는 것은 아닙니다.

## GitHub Pages Deployment

기존 저장소: https://github.com/ko9ma7/year-end-together

배포 사이트: https://ko9ma7.github.io/year-end-together/

1. `config.js`의 `appsScriptUrl`을 설정합니다.
2. 프로젝트 압축을 해제하고 `UPDATE-EXISTING-GITHUB.cmd`를 실행합니다. 기존 저장소를 `C:\YE\year-end-live`로 받아 최신 파일을 복사하고, 충돌 없는 일반 `git push`로 올립니다. `--force`는 사용하지 않습니다.
3. GitHub `Settings → Pages → Build and deployment → Source`는 `GitHub Actions`로 설정합니다.
4. `Actions` 탭에서 `Deploy GitHub Pages` 성공을 확인한 뒤, 모바일·PC에서 다시 열어 테스트합니다.

워크플로는 `main`에 push하면 `scripts/prepare-site.py`로 `_site`를 준비하고 Pages에 배포합니다. 저장소가 아닌 루트 도메인 또는 사용자 정의 도메인에도 경로가 깨지지 않도록 상대 경로 자산을 사용합니다. 커스텀 도메인은 필요하면 `CNAME`을 루트에 작성하고 GitHub Pages 설정에서 HTTPS를 활성화하세요.

## Configuration

`config.js`의 `appsScriptUrl` 외에는 기본값으로 작동합니다. 사용자에게 공개된 사이트이므로 JavaScript 파일에 비밀번호, API 키, 비밀 토큰을 넣지 마세요. 사이트와 입력 UI는 무인증 공개 접근이 가능한 소규모 모임 조율용입니다. 사용량이 큰 경우 사용자 인증 및 별도 백엔드가 필요할 수 있습니다.

## License

MIT (`LICENSE` 파일).
