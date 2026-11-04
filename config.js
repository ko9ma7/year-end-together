/**
 * 배포 시 이 파일의 appsScriptUrl 한 곳만 변경하세요.
 * pubhtml은 읽기 전용 게시 주소이며 쓰기 API가 아닙니다.
 */
window.APP_CONFIG = Object.freeze({
  siteName: '모두의 연말',
  appsScriptUrl: '', // 예: 'https://script.google.com/macros/s/AKfycb.../exec'
  publishedSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDfTvru5Z7yFeD4yIGEMVVOVF4kU6uCH_snsMfpY2QK99PSg29Bk-IMA6whr4rVPN9EBsg8rHixaF5/pubhtml',
  demoEvent: {
    id: 'year-end-2026',
    title: '2026 연말 모임',
    description: '올해의 마지막을 함께해요. 참석할 수 있는 날짜를 모두 선택해 주세요.',
    location: '장소 추후 공지',
    startDate: '2026-12-01',
    endDate: '2026-12-31',
    deadline: '2026-12-31',
    status: 'OPEN',
    publicNames: true,
    allowedDates: []
  }
});
