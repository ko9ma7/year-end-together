# DB 단계 — 자동 배포를 사용하는 경우 직접 SQL을 붙여넣지 마세요

이번 수정본에서는 `deploy.cmd`가 Cloudflare Wrangler로 SQL 파일을 원격 D1에 적용합니다.

1. ZIP 전체를 새 폴더에 압축 해제합니다.
2. `deploy.cmd` 또는 `자동배포.cmd`를 실행합니다.
3. Cloudflare 로그인 후 스크립트가 `year-end-together-db`를 찾아 먼저 SQL 백업을 만듭니다.
4. 백업 파일 생성 위치를 확인한 뒤 `DEPLOY`를 입력하면 장소 기능 테이블만 추가합니다.
5. 기존 `events`, `responses`, `response_tokens` 테이블과 그 안의 행은 수정하거나 삭제하지 않습니다.

백업 파일은 Windows의 `Documents\YearEndTogetherBackups` 폴더에 저장됩니다.

## 수동 SQL 적용이 꼭 필요한 경우

Cloudflare D1 Studio의 Query 탭에서 `장소기능-DB-추가.sql.txt`의 SQL 문을 **한 문장씩** 실행하세요. 이전 파일은 맨 앞의 `--` 주석과 줄바꿈이 콘솔에서 한 줄로 합쳐져 전체가 주석 처리될 수 있었습니다. 이번 파일은 SQL 문 앞에 주석을 넣지 않았습니다.

`DROP`, `DELETE`, `TRUNCATE`, `ALTER`, DB 초기화, Time Travel 복원은 실행하지 마세요.
