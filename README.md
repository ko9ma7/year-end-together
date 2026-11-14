# 모두의 연말 — 기존 D1 자료를 보존하는 비공개 모임 버전

> **중요: 기존 웹사이트에 `지원하지 않는 주소 또는 요청 방식입니다`가 보이면 `긴급-복구-가이드.md`부터 읽으세요.** 구버전 Worker가 새 조회 주소를 지원하지 않는 경우입니다. 기존 모임이 삭제되었다는 증거는 아닙니다. 구버전 `/api/data`는 조회 과정에서 오래된 기록을 삭제할 수 있으므로 접근하지 마세요.

> **2026-11-14 수정본** · 기존 GitHub Pages + Cloudflare Worker + D1 방식 유지. **새 D1 데이터베이스를 만들거나 기존 데이터를 초기화하지 않습니다.** 실제 운영 데이터는 이 ZIP 안에 들어 있지 않고 기존 Cloudflare D1에 있습니다.

## 이번 수정 내용

1. **날짜별 투표 실명 표시**: 최다 선택일(공동 1위 포함)에 누가 가능한지, TOP 6 날짜별 참여자 이름, 참석자별 선택 날짜, 나머지 모든 날짜별 참석 가능자를 보여 줍니다. 마감된 모임도 동일하게 볼 수 있습니다.
2. **비공개 모임**: 홈 화면에서 다른 사용자의 모임을 볼 수 없습니다. 공개 전체 조회 `/api/data`는 서버에서 403으로 차단합니다. 초대 링크 `https://ko9ma7.github.io/year-end-together/#event/<기존모임ID>`를 가진 사용자는 모임 및 참여 결과를 확인할 수 있습니다. 링크의 모임 ID는 무작위 UUID이므로 **이 URL 자체가 접근 권한**입니다.
3. **링크 분실 시 재입장**: 홈페이지의 '참여한 모임 다시 찾기'에 `정확한 모임명 + 투표 시 사용한 이름 + 당시 선택한 날짜 전체`를 입력하면 일치하는 모임으로 들어갈 수 있습니다. 마감 후에도 가능합니다. 다른 브라우저에서 예전 응답을 **수정**하는 권한은 별도이며, 원래 브라우저에 있던 수정 토큰이 있어야 합니다. IP별 하루 20회 복구 시도로 제한합니다.
4. **완료된 모임 보존**: 종전 Worker에 있던 `종료 30일 후 DELETE`와 예약 실행 자동 삭제를 제거했습니다. 기존 `events`, `responses`, `response_tokens`의 행, ID 및 수정 토큰을 보존하는 코드입니다. **이미 과거에 삭제된 데이터는 이 배포만으로 복원되지 않습니다.** D1 백업이 필요합니다.
5. **기존 브라우저 기록 유지**: 기존 localStorage 키 `year-end-together:v1:draft:<eventId>`를 그대로 읽어 저장된 응답·수정 토큰을 유지합니다. 새 코드는 이미 방문한 초대 링크만 해당 기기에 표시합니다.

## 꼭 먼저 하세요: 운영 D1 백업

이 프로젝트의 기존 설정은 다음과 같습니다.

- GitHub 저장소: `ko9ma7/year-end-together`
- Cloudflare Worker: `floral-thunder-c7b0`
- 기존 D1 데이터베이스: `year-end-together-db`, 바인딩: `DB`

**운영 DB를 삭제하거나 새로 연결하지 마세요.** Cloudflare Workers & Pages → D1 → **year-end-together-db** → Backup/Export에서 **배포 전 백업을 확보**하세요. 아래 조회를 D1 콘솔에서 각각 실행하여 모임·응답 건수를 적어 두세요.

```sql
SELECT COUNT(*) AS event_count FROM events;
SELECT COUNT(*) AS response_count FROM responses;
SELECT status, COUNT(*) AS count FROM events GROUP BY status;
```

가능하다면 `events`, `responses`, `response_tokens`를 포함한 **전체 DB 백업**을 별도로 보관하세요. `response_tokens` 테이블이 없을 경우 기존 Worker에서 최초 응답 등록 시 생성되는 것이므로 정상일 수 있습니다. 계정에서 D1 백업/내보내기 메뉴를 찾을 수 없다면 Cloudflare의 해당 DB Export 기능 또는 Wrangler D1 export를 사용하세요. `DELETE`, `DROP`, `TRUNCATE`, DB 재생성, 새 DB 바인딩은 금지합니다.

## 배포 순서 (반드시 Worker → GitHub Pages)

1. **D1 백업과 건수 기록을 먼저 완료**합니다. Cloudflare의 기존 Worker `floral-thunder-c7b0` → Edit Code에서 `cloudflare/worker.js` 전체로 코드를 바꾸고 **같은 Worker에 배포**합니다. D1 binding `DB`가 여전히 `year-end-together-db`를 가리키는지 확인하세요. 새 DB를 만들지 마세요.
2. **안전한 루트 주소** `https://floral-thunder-c7b0.mullimulli-api.workers.dev/`를 먼저 확인해 `routes` 배열에 `/api/events/:id`가 있는지 확인하세요. 이어 `/health`에서 `ok: true`, `tables: ["events","responses"]`를 확인합니다. **`/api/data`를 직접 열어 테스트하지 마세요.** 실제로 이전 Worker 코드가 남아 있다면 해당 주소를 여는 것만으로 `cleanupExpired()`가 실행될 수 있습니다. 이 상태에서는 이전 프런트엔드의 공개 목록 조회가 임시로 중단되므로 바로 다음 단계를 진행합니다.
3. GitHub 기존 `ko9ma7/year-end-together` 저장소에 최소 `app.js`, `styles.css`를 교체하세요. `config.js`, `index.html`, 배포 액션 파일은 기존 그대로도 됩니다. 전체 소스를 업데이트하고 싶다면 `UPDATE-EXISTING-GITHUB.cmd`를 사용할 수 있지만 **반드시 본인이 바뀐 파일을 검토**하세요. GitHub Actions → Pages 배포 성공을 확인합니다.
4. 예전 모임의 **원래 `#event/ID` 링크**로 접속하고, 닫힌 모임의 날짜별 이름/투표 수를 확인하세요. 시크릿 창에서 홈페이지를 열어 다른 사람의 모임이 표시되지 않는지 확인하세요.
5. 다시 기존 D1에서 위 SQL 건수를 확인하세요. **배포 전후의 `event_count`와 `response_count`가 같거나 늘어야 합니다.** 누군가 새로 투표했다면 응답이 늘 수 있습니다. 예전 모임 ID, 제목, 참석자 이름 및 선택 날짜가 그대로인지 확인하세요.

이 ZIP 자체는 백업 데이터나 운영 배포가 아닙니다. **수정된 코드를 업로드해도 데이터가 사라지지 않으려면** 현재 D1 연결을 유지해야 하며, Worker 코드를 교체하는 중 다른 SQL 마이그레이션이나 초기화를 실행해서는 안 됩니다.

## API (비공개 버전)

| 메서드 | 주소 | 설명 |
| --- | --- | --- |
| GET | `/health` | D1 연결 확인 |
| GET | `/api/data` | 403; 기존 전체 목록 API 접근 차단 |
| GET | `/api/events/:id` | 초대 링크의 모임 ID가 있는 경우 해당 모임과 **실명/날짜별** 응답 조회; 마감 후에도 허용 |
| POST | `/api/events` | 기존 모임 생성 및 관리 비밀번호로 수정·마감 |
| POST | `/api/responses` | 응답 제출 및 기존 수정 토큰으로 변경; 마감 후 변경 거절 |
| POST | `/api/recover` | 모임명·참여자명·선택 날짜 전체가 일치하는 기존 모임 링크 ID 복구; IP별 일일 제한 |

### 보안/개인정보 관련 중요한 제한

- **링크를 가진 누구나 결과를 볼 수 있고 투표할 수 있습니다.** 링크를 다른 사람에게 전달하면 그 사람도 접근할 수 있습니다. 이번 구현은 링크 비공개 방식이지 계정·문자 인증이 아닙니다.
- 기존 '이름 비공개' 설정이었던 모임이라도 **이제 초대 링크를 받은 사람에게 기존 참여자의 이름이 표시됩니다.** 운영자는 기존 참여자에게 이 공개 범위 변경을 알리고 필요한 동의를 확인해야 합니다.
- 예전 데이터에는 사용자 비밀번호·휴대전화 등이 없으므로 이름·투표했던 날짜를 이용한 복구는 **강력한 본인 인증이 아닙니다**. 일치 정보가 유출되거나 추측되면 다른 사람이 링크를 복구할 수 있습니다. 하루 20회 제한은 완전한 공격 방지가 아닙니다. 더 높은 보안이 필요하다면 Cloudflare Turnstile/WAF 또는 초대 인원별 PIN·계정 인증을 추가하세요.
- 복구는 **조회/재입장** 기능입니다. 다른 기기에서 응답 변경 권한을 새로 부여하지 않습니다. 마감 시 모든 응답 변경은 거절됩니다.
- 기존 자료의 무기한 보존에 따른 DB 사용량 및 개인정보 삭제 요청 대응은 별도 운영 정책이 필요합니다. 자동 삭제 코드는 없지만, 데이터 보존이 법적 보관 의무를 대체하지 않습니다.
- 해당 Worker의 CORS는 GitHub Pages 도메인 및 localhost:8000으로 설정되어 있습니다. **CORS 자체가 인증은 아닙니다.**

## 배포 불일치 방지

새 `app.js`는 모임 조회 전에 안전한 서버 루트(`/`)의 `routes` 배열을 검사합니다. 구버전 서버라면 `/api/data`로 우회하지 않고, 모임을 삭제했다고 잘못 알리지 않으면서 **Worker 버전 불일치**를 명확히 표시합니다. 진단 과정에서 데이터에 쓰기/삭제 쿼리가 발생하지 않습니다.

## 로컬 검증

```sh
node --no-warnings tests/cloudflare-worker.test.mjs
python tests/browser-smoke.py
python scripts/prepare-site.py
```

브라우저 테스트에는 Chromium (`/usr/bin/chromium`)과 Python Playwright가 필요합니다. 테스트는 모의 DB/API를 이용하므로 실제 Cloudflare 데이터를 변경하지 않습니다.

## 파일 구성

- `cloudflare/worker.js` — 기존 Cloudflare Worker 교체용 (삭제 SQL 없음)
- `app.js`, `styles.css` — 비공개 목록, 링크 재입장, 날짜별 참여자명 UI
- `config.js` — 기존 Worker 공개 주소 (비밀 데이터 없음)
- `tests/` — 기존 마감 모임 및 응답 보존, 공개 API 차단, 복구, 모바일 검증
- `apps-script/` — 옛날 Google Apps Script 코드 참고용; **현재 배포 방식에서는 사용되지 않음**
