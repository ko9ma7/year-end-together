# 먼저 이것만 확인하세요

## Windows 자동 배포

1. 이 ZIP 전체를 새 폴더에 압축 해제합니다.
2. Node.js LTS와 Git for Windows가 설치되어 있어야 합니다.
3. 폴더 안의 `deploy.cmd` 또는 `자동배포.cmd`를 더블클릭합니다.
4. Cloudflare 로그인 창에서 로그인합니다.
5. 스크립트가 기존 D1을 확인하고, 사용자 Documents\YearEndTogetherBackups 폴더에 원격 백업 SQL을 먼저 저장합니다.
6. 백업 파일 생성 후 장소 기능용 테이블만 추가하고 Worker를 배포합니다.
7. 마지막으로 GitHub main에 사이트 파일을 push합니다. GitHub 인증창이 나오면 승인합니다.
8. GitHub Actions에서 Pages 배포가 초록색 완료인지 확인합니다.

기존 D1을 새로 만들거나 기존 행을 삭제하는 명령은 없습니다. `events`, `responses`, `response_tokens`는 그대로 둡니다. 장소 기능 테이블만 `CREATE TABLE IF NOT EXISTS`로 추가합니다.

## 중요

- 이전 버전의 자동배포.cmd는 줄바꿈 형식 문제로 Windows CMD에서 정상 실행되지 않을 수 있습니다. 이번 ZIP의 `deploy.cmd`를 사용하세요.
- 이전 schema.sql은 첫 줄의 SQL 주석과 줄바꿈이 Cloudflare 콘솔에서 한 줄로 붙으면 전체가 주석으로 처리될 수 있습니다. 이번 자동 배포는 Wrangler의 `--file` 옵션으로 SQL 파일을 실행하므로 콘솔에 붙여넣지 않아도 됩니다.
- 수동으로 SQL을 적용할 때는 `장소기능-DB-추가.sql.txt` 파일을 참고하고, 각 SQL 문을 개별 실행하세요.

Worker 상태: https://floral-thunder-c7b0.mullimulli-api.workers.dev/health
사이트: https://ko9ma7.github.io/year-end-together/
GitHub Actions: https://github.com/ko9ma7/year-end-together/actions
