# 모두의 연말 — 날짜·장소를 함께 결정하는 비공개 모임 서비스 (2026-11-16)

**파일 제작본입니다. 실제 운영 서버에 자동 배포되지 않았습니다.**

## 지원하는 3가지 모임

| 모임 유형 | 진행 순서 |
|---|---|
| 날짜만 | 날짜 응답 → 마감 후 최다 가능 날짜와 참석 가능자 이름 |
| 장소만 | 지도에 핀 + 장소 이름 + 추천 이유 → 추천 마감 → 장소 투표 → 최종 장소 |
| 날짜 + 장소 | 날짜 투표 → 날짜 응답 마감 → 장소 추천 → 추천 마감 → 장소 투표 → 투표 마감 → 최종 장소 |

일정 기준은 **한국시간(Asia/Seoul) 날짜의 오후 11:59까지**입니다. 날짜가 바뀐 후 서버 조회 시 다음 단계가 자동으로 적용됩니다. 서버의 예약작업이나 SMS·카카오 알림 발송 기능은 없습니다. 페이지를 계속 열어둔 이용자는 날짜 변경 후 최대 약 1분 내 새로 조회합니다.

- **장소 추천**: 한 이름당 한 곳, 후보에 이름/사연/위도/경도를 저장합니다.
- **장소 투표**: 이름당 한 표, 같은 브라우저의 발급 토큰으로 마감 전 수정할 수 있습니다. 다른 브라우저에서 같은 이름으로 중복/변경 시도를 하면 거부됩니다.
- **최종 결과**: 최다 득표 장소를 자동으로 표시합니다. 공동 1위는 먼저 추천된 장소를 대표로 선정하며, 2곳 이상 모두 0표라면 결정을 보류합니다. 후보 1곳만 있으면 0표라도 선택합니다.
- **날짜 결과**: 마감 후 최다 참석 가능한 날짜를 표시합니다. 공동 1위는 가장 이른 날짜를 대표 날짜로 표시하고 모든 공동 1위도 계속 확인할 수 있습니다.
- **비공개**: 모임 목록 전체 조회 API를 막고, 임의 추측이 어려운 UUID 초대 링크로만 조회합니다. 링크를 공유받은 사람은 이름·사연·투표 결과를 열람할 수 있습니다. 계정 로그인이나 강한 신원 인증은 제공하지 않습니다.
- **기록 보존**: `DELETE FROM` / 만료일 자동 삭제 없음. 기존 이벤트/투표 데이터를 수정·삭제하지 않습니다.

## Windows 자동 배포 (CMD)

전체 ZIP을 압축 해제한 뒤 프로젝트 폴더의 **`deploy.cmd` 또는 `자동배포.cmd`를 더블클릭**하면 됩니다. 스크립트는 다음을 순서대로 수행합니다.

1. Node.js/Git 설치 여부와 Cloudflare 로그인 확인
2. Cloudflare 계정에서 이름이 정확히 `year-end-together-db`인 기존 D1을 조회 (새 DB 생성 안 함)
3. Documents\YearEndTogetherBackups 폴더에 기존 D1 원격 SQL 백업 자동 생성
4. 백업 후 `DEPLOY`를 입력하면 장소 기능용 `CREATE TABLE IF NOT EXISTS`만 적용
5. 확인한 기존 D1 UUID를 `wrangler.jsonc`에 기록하고 `floral-thunder-c7b0` Worker 배포
6. Worker `/health`에서 기존 DB 바인딩과 장소 테이블 확인
7. GitHub 저장소 `ko9ma7/year-end-together`의 `main`에 파일을 커밋/푸시하여 GitHub Actions Pages 배포 시작

이 스크립트는 새 D1을 만들거나 기존 행을 삭제하지 않습니다. GitHub 푸시 권한이 필요하며, Pages의 실제 완료 여부는 GitHub **Actions**에서 확인합니다.

필요한 PC 프로그램: Node.js LTS와 Git for Windows. Cloudflare 인증은 Wrangler 브라우저 로그인으로 진행하며 GitHub 인증은 Git Credential Manager를 사용합니다.

## 지금 연결해야 하는 순서

**1단계 → [1-먼저-DB-연결.md](./1-먼저-DB-연결.md)**

**2단계 → [2-Worker-사이트-배포.md](./2-Worker-사이트-배포.md)**

**3단계(선택) → [3-지도-API-키-연결.md](./3-지도-API-키-연결.md)**

기존에 사용하던 GitHub Pages 주소는 `https://ko9ma7.github.io/year-end-together/`, Cloudflare Worker 주소는 기본 설정상 `https://floral-thunder-c7b0.mullimulli-api.workers.dev`입니다. **주소를 바꾸거나 다른 Worker를 쓰면 `config.js`의 `apiUrl`도 실제 주소로 바꿔야 합니다.**

### 주요 파일

- `cloudflare/schema.sql` : 새 장소 테이블을 **추가**하는 SQL (`DROP`/`DELETE` 없음)
- `cloudflare/worker.js` : D1 서버 API (`GET /health`, 모임 읽기/저장, 날짜 투표, 장소 추천/투표)
- `index.html`, `app.js`, `maps.js`, `styles.css`, `config.js` : GitHub Pages 사이트
- `scripts/prepare-site.py` : GitHub Actions 배포용 정적 파일 목록에 `maps.js` 포함
- `tests/new-workflow.test.mjs` : Node 22의 SQLite로 API 단계/중복/마감 테스트
- `tests/new-app-render.test.mjs` : 화면 생성 및 XSS 기본 방어 테스트

### 설치 후 확인할 주소

1. `https://floral-thunder-c7b0.mullimulli-api.workers.dev/health` (DB 연결 및 새 테이블 5개 확인)
2. `https://floral-thunder-c7b0.mullimulli-api.workers.dev/` (응답 안에 `version: "2026-places-v1"`)
3. `https://ko9ma7.github.io/year-end-together/` (사이트 배포 후 모임 만들기 테스트)

### 데이터 안전성

- 기존 D1에서 백업을 받으셨다면 해당 백업은 보관하세요.
- 이 배포본은 DB 테이블에 `DROP`, `DELETE`, `TRUNCATE` 하지 않으며 새로운 테이블은 `CREATE TABLE IF NOT EXISTS`로 만듭니다.
- 기존 모임은 앱 내 자동 공개 목록으로 보이지 않습니다. 링크가 있다면 해당 모임은 직접 조회할 수 있습니다.
- 새 모임의 장소 데이터는 새 테이블에만 보관됩니다. DB 콘솔에서 SQL을 복사하여 실행하기 전 **기존 DB가 선택되어 있는지** 확인하세요.

### 지도 지원 범위

기본 지도: Leaflet + OpenStreetMap 타일 (키 없이 핀 찍기 가능, 인터넷 필요). 옵션: 카카오 JavaScript SDK, 네이버 Dynamic Map SDK, 구글 Maps JavaScript API. 사용자가 `config.js`에 해당 공개형 브라우저 키를 직접 등록하면 지도 선택 메뉴에서 사용 가능합니다. 특정 장소 검색 자동완성이나 주소 좌표변환, 카카오/네이버/구글 로그인 기능은 포함하지 않았습니다. 서비스 제공사의 요금/쿼터/도메인 등록이 적용될 수 있습니다.

### 운영상 제한

링크를 받은 사람의 신원 자체를 확인하는 인증이 없으므로 가명 여러 개로 참여하는 행동을 완벽하게 막지는 못합니다. 외부 대규모 서비스를 운영하려면 회원 인증, 캡차, 레이트리밋, 관리자 삭제/신고 기능을 추가하는 것이 안전합니다. 지도 CDN이 차단되면 위도/경도를 입력해 장소 추천은 가능하지만, 화면 안의 지도 핀 찍기는 불가능합니다. 장소 투표 종료 알림을 자동으로 전송하지 않습니다.


## Windows 배포 스크립트 수정 안내

- `deploy.cmd`와 `자동배포.cmd`는 같은 `deploy.ps1`을 실행합니다.
- D1 목록 JSON의 속성 이름을 추측하지 않고, Cloudflare 대시보드 URL에서 확인된 기존 D1 UUID를 사용합니다.
- 배포 전 `wrangler d1 info year-end-together-db`로 로그인 계정에서 해당 DB를 조회할 수 있는지 확인합니다.
- 계정 ID가 예상 값과 다르면 즉시 중단합니다.
- 원격 백업은 Wrangler D1 export의 `--skip-confirmation` 옵션을 사용합니다.
- 기존 D1을 새로 만들거나 삭제하지 않습니다.
