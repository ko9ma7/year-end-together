# 모두의 연말 — 지금부터 실제 등록되도록 만드는 방법

> **이 버전은 미리보기 저장 기능을 제거했습니다.** 실제 Google Sheets 쓰기 연결이 없으면 모임/참석자 등록 버튼을 비활성화하고, 저장되었다고 표시하지 않습니다.

## 핵심 구조

GitHub Pages (화면) → Google Apps Script `/exec` (공동 저장·조회) → 사용자가 제공한 Google Spreadsheet의 `EVENTS`·`RESPONSES` 탭

모임을 새로 만들 때 8~128자 **모임 전용 관리 비밀번호**를 입력합니다. 비밀번호는 **시트 어디에도 기록하지 않고**, 같은 시트에 연결된 Apps Script의 **Script Properties**에 개별 salt + 해시로 저장합니다. 관리자가 모임을 수정하거나 마감할 때 서버에서 검증합니다. 사용자 브라우저, GitHub 코드, 공개 조회 응답에 비밀번호를 저장하지 않습니다.

## 왜 아직 다른 창에서 보이지 않았나요?

기존 `config.js`의 `appsScriptUrl`이 **빈 문자열**이었습니다. 제공된 `pubhtml` 주소는 열람용 게시 URL이지 Google Sheets에 데이터를 추가할 수 있는 편집 API가 아닙니다. 예전 미리보기는 브라우저 LocalStorage에만 모임을 저장했으므로 다른 창, 특히 다른 기기와 공유되지 않았습니다. 새 버전은 이를 제거했습니다.

## 원본 시트와 실제로 연결하는 1회 작업

1. 아래 주소는 게시된 **보기용** 시트입니다. 이것만으로는 편집 스크립트를 만들 수 없습니다. Google Drive에 로그인하여 이 문서의 **원본 편집 화면**을 열어 주세요. 편집 화면 URL은 통상 `https://docs.google.com/spreadsheets/d/원본_ID/edit`입니다.

   https://docs.google.com/spreadsheets/d/e/2PACX-1vTDfTvru5Z7yFeD4yIGEMVVOVF4kU6uCH_snsMfpY2QK99PSg29Bk-IMA6whr4rVPN9EBsg8rHixaF5/pubhtml

2. 원본 스프레드시트의 **확장 프로그램 → Apps Script**를 엽니다.
3. `Code.gs`를 프로젝트 내 `apps-script/Code.gs` 전체 내용으로 교체하고 저장합니다. **구버전 Code.gs를 남기지 마세요.**
4. 상단 함수 목록에서 `setupSheets`를 선택한 뒤 **실행**, 권한을 승인합니다. 원본 시트에 `EVENTS`, `RESPONSES` 탭이 만들어집니다. 기존 `시트1`과 기록은 삭제하지 않습니다.
5. 오른쪽 위 **배포 → 새 배포**를 선택하고 유형 **웹 앱**, **실행 사용자: 나**, **액세스 권한: 모든 사용자(Anyone)**로 배포합니다. `.../exec`로 끝나는 주소를 복사합니다. `/dev`가 아닙니다.
6. 프로젝트 `config.js`의 다음 줄을 수정합니다.

   ```js
   appsScriptUrl: 'https://script.google.com/macros/s/실제_배포_ID/exec',
   ```

   **이 자리에 관리 비밀번호를 넣지 마세요.** `/exec` 주소는 로그인 토큰이 아닙니다.
7. 아래의 GitHub 배포 업데이트 스크립트를 실행하거나 `config.js`, `app.js`, `apps-script/Code.gs` 등 변경 파일을 GitHub 저장소에 push합니다. GitHub Pages의 `config.js`까지 최신으로 배포되어야 모든 기기에서 같은 서버를 사용합니다.
8. GitHub Pages를 시크릿 모드 포함 **서로 다른 브라우저 2개**에서 열고 모임 목록이 동일한지 확인합니다.

   - 첫 창: 새 모임 만들기 → 제목·날짜·**모임 관리 비밀번호** 입력 → 제출
   - 원본 시트의 `EVENTS` 탭에 해당 모임이 생성되는지 확인
   - 두 번째 창: 새로고침 → 같은 모임을 열기 → 이름·가능 날짜 복수 선택 → 제출
   - 원본 시트의 `RESPONSES` 탭에 해당 이름과 날짜가 저장되는지 확인
   - 첫 번째 창 새로고침 → 해당 모임 상세에서 참여자 및 날짜별 인원 확인
   - 모임 관리 화면에서 **틀린 비밀번호는 거부**되는지 확인

### 기존 Apps Script 웹 앱을 이미 배포하셨다면

코드를 저장한 다음 **배포 → 배포 관리 → 연필(수정) → 새 버전 → 배포**를 꼭 해 주세요. Google Apps Script 기존 `/exec` 배포는 편집기에서 코드만 변경한다고 자동 갱신되지 않습니다.

### 매우 중요한 개인정보 설정

- 현재 제공하신 `pubhtml` 주소는 인터넷에 게시된 시트입니다. **`RESPONSES` 탭이 게시되면 이름과 참석 날짜가 외부에 공개될 수 있습니다.**
- 이 새 웹사이트는 `pubhtml`에서 데이터를 가져오지 않습니다. 가능하면 **파일 → 공유 → 웹에 게시 → 게시 중지**로 게시를 해제하고, 웹사이트의 Apps Script 조회 기능만 사용하세요. 적어도 `RESPONSES` 탭은 게시 대상에서 제외해야 합니다.
- 참가자 이름을 모임 페이지에서 보여줄지 선택할 수 있습니다. 기본값은 표시이며, 비공개가 필요하면 모임 생성 시 체크를 해제하세요.
- **관리 비밀번호를 시트의 숨김 열이나 숨김 시트에 저장하지 않습니다.** '숨기기'는 보안이 아니기 때문입니다. 비밀번호는 Apps Script 비공개 Script Properties에만 보관하고, 공개되는 시트에는 존재하지 않습니다.
- 모임 관리 비밀번호를 잊으면 스프레드시트 소유자만 `Code.gs`의 `resetEventPassword` 함수에서 ID와 새 비밀번호를 수정한 뒤 Apps Script 편집기에서 직접 실행하여 재설정할 수 있습니다.

## GitHub에 올리기

**`UPDATE-EXISTING-GITHUB.cmd`** 실행: 기존 `ko9ma7/year-end-together` 저장소를 짧은 경로 `C:\YE\year-end-live`로 clone/pull한 뒤 최신 프로젝트 파일을 덮어씌워 일반 push를 합니다. 기존 Git 커밋을 삭제하거나 `--force`를 사용하지 않습니다. `config.js`에 `/exec`를 입력한 다음 실행하세요.

GitHub에서 `Settings → Pages → Build and deployment → Source: GitHub Actions`를 선택합니다. 배포 주소는 https://ko9ma7.github.io/year-end-together/ 입니다.

## 기술상 한계

이 저장 구조는 Google Apps Script를 한 번도 배포하지 않은 상태에서 `/pubhtml`만으로 자동 저장을 시작할 수 없습니다. 원본 편집 권한을 가진 계정에서 웹 앱 배포·권한 승인이 반드시 필요합니다. 실배포 테스트는 사용자의 Google 계정 연결 후 가능합니다.
