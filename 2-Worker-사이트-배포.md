# 자동 배포 안내

전체 ZIP을 압축 해제한 뒤 `deploy.cmd` 또는 `자동배포.cmd`를 더블클릭하세요.

자동 배포는 다음을 순서대로 처리합니다.

1. Node.js / Git / Wrangler 확인 및 Cloudflare 로그인
2. 기존 `year-end-together-db` D1을 이름으로 찾아 UUID 확인 (새 DB 생성 안 함)
3. `Documents\YearEndTogetherBackups`에 원격 D1 SQL 백업 생성
4. 사용자가 `DEPLOY`를 입력하면 장소 기능용 테이블만 추가
5. 기존 Worker `floral-thunder-c7b0`에 D1 바인딩 `DB`를 연결해 배포
6. `/health` 및 버전 응답으로 Worker와 D1 연결 확인
7. GitHub 저장소 `ko9ma7/year-end-together`의 `main`에 사이트 파일 push
8. GitHub Actions에서 Pages 배포 결과 확인

## 배포 후 확인 주소

- Worker 상태: https://floral-thunder-c7b0.mullimulli-api.workers.dev/health
- Worker 버전: https://floral-thunder-c7b0.mullimulli-api.workers.dev/
- 사이트: https://ko9ma7.github.io/year-end-together/
- GitHub Actions: https://github.com/ko9ma7/year-end-together/actions

이전 버전의 CMD 파일은 Windows 줄바꿈이 잘못되어 실행 오류가 날 수 있습니다. 이번 ZIP의 새 `deploy.cmd`를 사용하세요. 기존 D1의 행을 삭제하는 명령은 포함하지 않았습니다.
