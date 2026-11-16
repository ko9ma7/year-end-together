# 3단계 (선택) — 카카오 / 네이버 / 구글 지도 API

**사이트를 먼저 정상 작동시키세요. 기본 지도에서는 API 키가 없어도 위치를 클릭해 장소 추천이 가능합니다.**

`config.js`에는 이미 다음 설정 공간이 있습니다:

```js
maps: {
  kakaoJavaScriptKey: '', // 카카오 웹 JavaScript 키
  naverClientId: '',      // 네이버 클라우드 Dynamic Map ncpKeyId
  googleApiKey: ''        // 구글 Maps JavaScript API 키
}
```

지도 한 곳만 써도 됩니다. 모든 키를 받을 필요는 없습니다.

## 카카오 지도

1. https://developers.kakao.com/ 에서 앱 생성.
2. 앱의 **카카오맵 > 사용 설정**을 활성화 (2026년 7월 개편에 따른 요금/무료 쿼터 정책을 확인).
3. 앱의 **플랫폼 키 → JavaScript 키**에서 **JavaScript SDK 도메인**에 `https://ko9ma7.github.io` 추가.
4. 발급받은 **JavaScript 키**만 `config.js`의 `kakaoJavaScriptKey` 값에 넣기. REST API 키, Admin 키, Client Secret은 절대 넣지 마세요.
5. GitHub에 `config.js` 저장 → 배포 완료 후 지도 선택 메뉴에서 **카카오 지도** 선택.

카카오 공식 문서: https://developers.kakao.com/docs/ko/kakaomap/common

## 네이버 지도

1. https://www.ncloud.com/에서 Maps Application 생성.
2. **Dynamic Map** 사용 설정 및 허용 웹사이트 등록.
3. **Client ID (ncpKeyId)**를 `config.js`의 `naverClientId`에 넣기. Client Secret은 넣지 않습니다.
4. 배포 후 지도 선택 메뉴에서 **네이버 지도** 선택.

공식 문서: https://navermaps.github.io/maps.js.ncp/docs/tutorial-1-Getting-Client-ID.html

## 구글 지도

1. https://console.cloud.google.com/에서 프로젝트 생성 및 결제계정/예산 설정 여부 확인.
2. **Maps JavaScript API** 사용 설정.
3. API 키를 발급하고 **웹사이트 HTTP referrer 제한**(`https://ko9ma7.github.io/*`)과 **API 제한**(Maps JavaScript API)을 적용.
4. 제한된 브라우저 키를 `config.js`의 `googleApiKey`에 넣기.
5. 배포 후 지도 선택 메뉴에서 **구글 지도** 선택.

공식 문서: https://developers.google.com/maps/documentation/javascript/load-maps-js-api

## 주의

API 키/도메인 등록, 무료 쿼터, 과금은 각 지도 제공사의 정책에 따릅니다. 키를 넣지 않아도 기본 지도와 지도 좌표 수동 입력을 이용해 모임을 운영할 수 있습니다. 장소 후보에는 좌표·장소 이름·코멘트만 저장하며 지도 서비스 계정 비밀번호는 사용하지 않습니다.
