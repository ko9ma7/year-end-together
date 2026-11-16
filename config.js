/** 브라우저에 공개되는 값입니다. 비밀키(Client Secret, REST API Secret)는 절대 넣지 마세요. */
window.APP_CONFIG = Object.freeze({
  siteName: '모두의 연말',
  apiUrl: 'https://floral-thunder-c7b0.mullimulli-api.workers.dev',
  maps: {
    kakaoJavaScriptKey: '', // Kakao Developers > JavaScript 키 (현재 사이트 도메인 등록 필요)
    naverClientId: '',      // Naver Cloud Dynamic Map > ncpKeyId
    googleApiKey: ''        // Google Maps JavaScript API 브라우저 키
  }
});
