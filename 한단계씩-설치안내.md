# 모두의 연말 — GitHub Pages + Cloudflare Worker + D1

기존 `ko9ma7/year-end-together` 사이트 디자인을 유지하고, Google Apps Script 쓰기 방식을 Cloudflare D1으로 교체한 버전입니다. 원본 `app.js`는 제공받은 `app(20261105-032540).js`를 기반으로 수정했습니다.

## 현재 상태

- Cloudflare 계정의 **별도 Worker**: `floral-thunder-c7b0`
- Cloudflare D1: `year-end-together-db` / binding `DB`
- 사용자가 미리 생성한 테이블: `events`, `responses`
- Worker는 참석자 수정 토큰용 `response_tokens` 테이블을 최초 호출 시 자동 생성합니다. 수동 SQL 불필요.
- 기존 `mullimulli-api` Worker / `mullimulli-db` / Google Sheets / GitHub 원격 저장소는 작업 파일을 만들면서 변경하지 않았습니다.

## 한 단계씩 배포

### 1. Cloudflare Worker 코드만 먼저 교체 (지금 할 일)

Cloudflare → **Workers 및 Pages** → **floral-thunder-c7b0** → **코드 편집** → 현재 Hello World `worker.js` 전체를 [`cloudflare/worker.js`](cloudflare/worker.js) 내용으로 교체 → **배포**합니다.

다음 URL들을 순서대로 열어야 정상입니다.

- `https://floral-thunder-c7b0.mullimulli-api.workers.dev/health`
  - `ok: true`, `tables: ["events", "responses"]`
- `https://floral-thunder-c7b0.mullimulli-api.workers.dev/api/data`
  - `ok: true`, `events: []`, `responses: []` (처음에는 빈 데이터)

**위 2개 확인 전에는 GitHub Pages를 업데이트하지 마세요.** 현재 사이트가 일시적으로 동작하지 않도록 변경하는 일을 방지합니다.

### 2. GitHub Pages 파일 변경 (API 확인 후)

새 소스의 `app.js`, `config.js`를 기존 `ko9ma7/year-end-together` GitHub 저장소에 반영합니다. 가장 단순한 방법은 두 파일을 GitHub 웹사이트의 `main` 브랜치에서 열어 내용만 교체하고 커밋하는 것입니다. 디자인 파일은 그대로 두어도 됩니다.

또는 `UPDATE-EXISTING-GITHUB.cmd`를 Windows에서 실행해 전체 소스 중 변경된 파일을 기존 저장소에 업데이트할 수 있습니다. 이 CMD는 기존 저장소를 짧은 경로로 복제하고 `main`을 최신화하며, **강제 푸시를 하지 않습니다.** 기존 원격 파일을 삭제하지 않지만 동일 이름의 파일은 교체됩니다.

Pages 주소는 계속 `https://ko9ma7.github.io/year-end-together/` 입니다.

### 3. 실제 등록 검사

- 새 모임 만들기 → 제목/날짜 입력 → 모임별 **관리 비밀번호 8자 이상 + 확인** → 등록
- 데이터베이스 `events`에 모임이 저장되는지 확인
- 시크릿 창에서 같은 모임 확인
- 모임 상세에서 이름 + 가능한 날짜 복수 선택 → `responses`에 저장
- 비밀번호를 틀리게 입력한 모임 수정은 오류가 나야 합니다.

## API

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | D1 연결 및 기존 테이블 확인 |
| GET | `/api/data` | 모임 및 참석 현황 조회, 비밀번호/토큰 비공개 |
| POST | `/api/events` | 모임 생성 또는 비밀번호로 관리/마감 |
| POST | `/api/responses` | 참석자 등록 및 같은 브라우저의 수정 토큰으로 변경 |

쓰기는 `application/json` 방식입니다. CORS는 `https://ko9ma7.github.io`와 로컬 개발용 `localhost:8000`으로 제한됩니다. 기타 사이트(커스텀 도메인 등)에서 운영하면 `cloudflare/worker.js`의 `ALLOWED_ORIGINS`를 수정해야 합니다. CORS는 인증 수단이 아니며 생성 자체는 공개되어 있습니다. 악성 사용자가 남용할 가능성에 대비하려면 Cloudflare WAF/Turnstile을 추후 추가하는 것이 좋습니다.

## 개인정보와 보관기간

- 모임별 비밀번호는 D1에 **무작위 솔트 + PBKDF2-SHA256** 해시만 저장합니다. 조회 API에서는 원문도 해시도 반환하지 않습니다.
- 참석자 수정용 무작위 토큰은 브라우저 LocalStorage에 보관되고, 서버에는 SHA-256 해시만 `response_tokens`에 저장합니다. 기기를 바꾸면 이 토큰이 없어 기존 응답을 직접 수정하기 어렵습니다.
- **이름 공개**를 선택하지 않은 모임은 조회 API에서 참석자 이름을 `비공개`로 표시합니다. DB 소유자는 D1 콘솔에서 원문을 볼 수 있습니다.
- 모임 종료일 **30일 뒤 데이터는 API 요청 시 정리**합니다. 사이트에 오랫동안 요청이 없으면 실제 데이터 삭제가 지연될 수 있습니다. 즉시 자동 정리를 원한다면 Worker에 하루 한 번 Cron Trigger를 추가할 수 있습니다(코드에는 `scheduled` 핸들러 포함).
- 원본 Google Sheets 데이터는 **자동으로 이전하거나 삭제하지 않습니다.** 기존 자료가 필요하다면 별도 마이그레이션이 필요합니다.

## 소스 구성

- `cloudflare/worker.js`: Worker API 본체
- `app.js`: 사용자 제공 웹페이지 JavaScript를 D1 API로 전환한 버전
- `config.js`: 공개 Worker URL 설정 (비밀정보 없음)
- `index.html`, `styles.css`, `assets/`: 기존 사이트 디자인
- `.github/workflows/deploy.yml`, `scripts/prepare-site.py`: GitHub Pages 정적 배포
- `tests/cloudflare-worker.test.mjs`: Node + SQLite 모의 D1 API 테스트
- `tests/browser-smoke.py`: API 모의응답으로 PC·모바일 기본 사용자 흐름 테스트

## 로컬 검증

```sh
node --no-warnings tests/cloudflare-worker.test.mjs
python scripts/prepare-site.py
```

브라우저 UI 검증에는 별도의 Playwright와 Chromium 설치가 필요합니다. GitHub Pages 사이트 실행에는 Node나 Python이 필요하지 않습니다.
