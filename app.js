(() => {
  'use strict';

  const CONFIG = window.APP_CONFIG;
  const STORAGE_PREFIX = 'year-end-together:v2';
  const isLive = Boolean((CONFIG.apiUrl || '').trim());
  const $ = selector => document.querySelector(selector);
  const root = $('#app');
  const state = {
    data: { events: [], responses: [] },
    loading: true, error: '', saving: false,
    calendarMonth: '', selectedEventId: '',
    draft: {},
    theme: safeStore('theme') || 'light',
    menuOpen: false,
    statusMessage: '', placeDrafts:{}, mapProvider:'open'
  };
  let toastTimer;

  function safeStore(key, value) {
    try {
      if (arguments.length === 1) return localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
      localStorage.setItem(`${STORAGE_PREFIX}:${key}`, value);
    } catch (_) { /* LocalStorage 없이도 실행 */ }
    return null;
  }
  const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function icon(name) {
    const paths = {
      'arrow-right':'<path d="M5 12h14m-6-6 6 6-6 6"/>',
      'arrow-left':'<path d="m12 19-7-7 7-7m-7 7h14"/>',
      'chevron-right':'<path d="m9 18 6-6-6-6"/>',
      'chevron-left':'<path d="m15 18-6-6 6-6"/>',
      'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      'users':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      'pin':'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
      'check':'<path d="m20 6-11 11-5-5"/>',
      'check-circle':'<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
      'plus':'<path d="M12 5v14M5 12h14"/>',
      'x':'<path d="M18 6 6 18M6 6l12 12"/>',
      'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
      'moon':'<path d="M20.985 12.486A9 9 0 0 1 11.514 3.01 9 9 0 1 0 20.985 12.486Z"/>',
      'menu':'<path d="M4 6h16M4 12h16M4 18h16"/>',
      'refresh':'<path d="M20 11a8 8 0 1 0-2.3 6M20 4v7h-7"/>',
      'share':'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
      'info':'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>',
      'clock':'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
      'sparkle':'<path d="m12 3 1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3ZM19 17l.6 1.5L21 19l-1.4.5L19 21l-.6-1.5L17 19l1.4-.5L19 17Z"/>',
      'alert':'<path d="m10.3 3.2-8.4 14.5A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-3.3L13.7 3.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
      'sheet':'<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-6-6H8Z"/><path d="M15 3v6h6M7 13h10M7 17h10"/>',
      'link':'<path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>'
    };
    return `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.info}</svg>`;
  }

  function todayKST() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  }
  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
  }
  function nextDay(iso) { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10); }

  function addDays(iso,n) {const d=new Date(`${iso}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function modeLabel(mode){return mode==='both'?'날짜 + 장소':mode==='place'?'장소만':'날짜만';}
  function stageLabel(stage){return ({waiting:'날짜 투표 중',proposals:'장소 추천 중',voting:'장소 투표 중',result:'최종 장소 발표',none:'날짜 투표'})[stage]||'모임';}
  function getPlaceDraft(id) {
    if(!state.placeDrafts[id]) {
      let d={};try{d=JSON.parse(safeStore('place:'+id)||'{}')}catch(_){}
      const dateDraft=getDraft(id);
      state.placeDrafts[id]={name:d.name||dateDraft.name||'',placeName:d.placeName||'',comment:d.comment||'',
        lat:Number.isFinite(d.lat)?d.lat:null,lng:Number.isFinite(d.lng)?d.lng:null,
        selected:d.selected||'',voteToken:d.voteToken||randomSecret(),consent:d.consent===true};
    }
    return state.placeDrafts[id];
  }
  function savePlaceDraft(id){safeStore('place:'+id,JSON.stringify(getPlaceDraft(id)));}
  function placeFor(event){return event.place||{stage:'none',proposals:[],votes:[],winner:null};}
  function externalMapLinks(place){
    const n=encodeURIComponent(place.name||'장소');const lat=Number(place.lat),lng=Number(place.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return '';
    const links=[['카카오','https://map.kakao.com/link/map/'+n+','+lat+','+lng],
      ['네이버','https://map.naver.com/p/search/'+n],['구글','https://www.google.com/maps/search/?api=1&query='+lat+'%2C'+lng]];
    return '<div class="place-links">'+links.map(([label,url])=>`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label} 지도 ↗</a>`).join('')+'</div>';
  }
  function dateRange(event) {
    if (!isIsoDate(event.startDate) || !isIsoDate(event.endDate) || event.endDate < event.startDate) return [];
    const dates=[]; for(let date=event.startDate; date<=event.endDate && dates.length<120; date=nextDay(date)) dates.push(date);
    const allowed = Array.isArray(event.allowedDates) ? event.allowedDates : [];
    return allowed.length ? dates.filter(date=>allowed.includes(date)) : dates;
  }
  function formatDate(iso, options={month:'short',day:'numeric',weekday:'short'}) {
    if (!isIsoDate(iso)) return '-';
    return new Intl.DateTimeFormat('ko-KR',{timeZone:'UTC',...options}).format(new Date(`${iso}T00:00:00Z`));
  }
  function monthLabel(month) { const [y,m] = month.split('-').map(Number); return `${y}년 ${m}월`; }
  function monthShift(month,delta) { const [y,m]=month.split('-').map(Number); const d=new Date(Date.UTC(y,m-1+delta,1));return d.toISOString().slice(0,7); }
  function eventIsOpen(event) { return event.mode!=='place' && event.status==='OPEN' && (!event.deadline || todayKST()<=event.deadline) && dateRange(event).some(d=>d>=todayKST()); }
  function getEvent(id) { return state.data.events.find(e=>e.id===id); }
  function responsesFor(eventId) { return state.data.responses.filter(r=>r.eventId===eventId && Array.isArray(r.dates)); }
  function countsFor(eventId) {
    const counts = new Map();
    responsesFor(eventId).forEach(response => new Set(response.dates).forEach(date => counts.set(date,(counts.get(date)||0)+1)));
    return counts;
  }
  function draftKey(eventId) { return `draft:${eventId}`; }
  function getDraft(eventId) {
    if (!state.draft[eventId]) {
      let stored;try{stored=JSON.parse(safeStore(draftKey(eventId))||'{}')}catch(_){stored={}}
      state.draft[eventId]={name:stored.name||'',dates:Array.isArray(stored.dates)?stored.dates.filter(isIsoDate):[],id:stored.id||'',token:stored.token||'',consent:stored.consent===true};
    }
    return state.draft[eventId];
  }
  function saveDraft(eventId) { safeStore(draftKey(eventId), JSON.stringify(getDraft(eventId))); }
  function toast(message) {
    const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4300);
  }
  function randomId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  function randomSecret() {return [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');}
  function validEventId(id) { return typeof id==='string' && /^[a-f0-9-]{32,36}$/i.test(id); }
  function knownEventIds() {
    let stored=[];
    try { const parsed=JSON.parse(safeStore('knownEventIds')||'[]'); if(Array.isArray(parsed))stored=parsed; }catch(_){}
    // Discover drafts saved by this version on the current browser.
    try {
      for(let i=0;i<localStorage.length;i++) {
        const key=localStorage.key(i);
        const prefix=`${STORAGE_PREFIX}:draft:`;
        if(key && key.startsWith(prefix))stored.push(key.slice(prefix.length));
      }
    }catch(_){}
    return [...new Set(stored.filter(validEventId))].slice(0,100);
  }
  function rememberEvent(id) {
    if(validEventId(id))safeStore('knownEventIds',JSON.stringify([...new Set([id,...knownEventIds()])].slice(0,100)));
  }
  function pendingEventId() {
    const old=safeStore('pendingEventId');
    if(old && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(old))return old;
    const id=randomId();safeStore('pendingEventId',id);return id;
  }
  function route() {
    const hash=location.hash.slice(1);
    if (hash==='create') return {page:'edit',id:null};
    if (hash.startsWith('manage/')) {try{return {page:'edit',id:decodeURIComponent(hash.slice(7))};}catch(_){return {page:'notfound'};}}
    if (hash.startsWith('event/')) {try {return {page:'event',id:decodeURIComponent(hash.slice(6))};}catch(_){return {page:'notfound'};}}
    return {page:'home'};
  }
  function shareUrl(id) {return `${location.href.split('#')[0]}#event/${encodeURIComponent(id)}`;}
  function eventIdFromLink(raw) {
    const value=String(raw||'').trim();
    if(validEventId(value))return value;
    try {
      const url=new URL(value);
      if(url.protocol!=='https:' && url.protocol!=='http:')return '';
      const hash=decodeURIComponent(url.hash.slice(1));
      if(hash.startsWith('event/')) {
        const id=hash.slice('event/'.length);
        return validEventId(id)?id:'';
      }
    }catch(_){ /* 링크나 ID 형식이 아니면 거부 */ }
    return '';
  }

  function normalizeData(items) {
    const events=[],responses=[];
    for(const input of items) {
      if(!input?.ok || !input.event)continue;
      const e=input.event;
      if(typeof e.id!=='string'||!isIsoDate(e.startDate)||!isIsoDate(e.endDate))continue;
      events.push({id:e.id,title:String(e.title||'제목 없는 모임'),description:String(e.description||''),location:String(e.location||''),
        startDate:e.startDate,endDate:e.endDate,deadline:isIsoDate(e.deadline)?e.deadline:'',
        status:e.status==='CLOSED'?'CLOSED':'OPEN',publicNames:true,
        allowedDates:Array.isArray(e.allowedDates)?e.allowedDates.filter(isIsoDate):[],
        mode:['date','both','place'].includes(e.mode)?e.mode:'date',
        proposalDeadline:e.proposalDeadline||'',voteDeadline:e.voteDeadline||'',meetingDate:e.meetingDate||'',
        place:{stage:input.place?.stage||'none',proposals:Array.isArray(input.place?.proposals)?input.place.proposals:[],
          votes:Array.isArray(input.place?.votes)?input.place.votes:[],winner:input.place?.winner||null}});
      for(const r of input.responses||[]) {
        if(r && r.eventId===e.id && typeof r.id==='string' && Array.isArray(r.dates))
          responses.push({id:r.id,eventId:r.eventId,name:String(r.name||'이름 미상'),dates:r.dates.filter(isIsoDate),updatedAt:r.updatedAt||''});
      }
    }
    return {events,responses};
  }
  async function apiRequest(path, options={}) {
    const base=(CONFIG.apiUrl || '').trim().replace(/\/$/,'');
    if(!/^https:\/\/[^\s]+$/.test(base))throw new Error('config.js의 Cloudflare API 주소를 확인해 주세요.');
    let response;
    try {
      response=await fetch(base+path,{cache:'no-store',...options});
    }catch(error){throw new Error('Cloudflare 서버에 연결할 수 없습니다. 네트워크와 API 배포 상태를 확인하세요.');}
    let data;
    try{data=await response.json();}catch(error){throw new Error('서버에서 JSON 응답을 받지 못했습니다.');}
    if(!response.ok||!data.ok)throw new Error(data.error||`서버 요청 실패 (${response.status})`);
    return data;
  }
  async function readFromApi() {
    // Safe compatibility handshake: GET / never enumerates meetings or runs legacy
    // cleanupExpired(). Never fall back to /api/data (which both exposed private
    // meetings and could DELETE expired records in the old Worker).
    const service=await apiRequest('/');
    if (!Array.isArray(service.routes) || !service.routes.includes('/api/places/propose')) {
      throw new Error('웹사이트와 Worker 버전이 다릅니다. 먼저 새 worker.js를 기존 Worker에 배포해 주세요. DB의 모임이 삭제된 것은 아닙니다.');
    }
    const current=route();
    const direct=current.page==='event'||(current.page==='edit'&&current.id) ? current.id : null;
    const ids=[...new Set([...knownEventIds(),...(validEventId(direct)?[direct]:[])])];
    const results=await Promise.all(ids.map(async id=>{
      try{return await apiRequest('/api/events/'+encodeURIComponent(id));}
      catch(err){if(id===direct)throw err;return null;}
    }));
    if(direct && results.some(x=>x?.event?.id===direct))rememberEvent(direct);
    return normalizeData(results);
  }
  async function postApi(path, payload) {
    return apiRequest(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  }
  async function refreshData(showSpinner=false) {
    if (!isLive) {
      state.data={events:[],responses:[]};state.loading=false;
      state.error='Cloudflare API가 아직 연결되지 않았습니다. 저장 기능은 비활성화되어 있습니다.';
      render();return;
    }
    if (showSpinner){state.loading=true;render();}
    try {state.data=await readFromApi();state.error='';}
    catch(error){state.error=error.message;}
    finally {state.loading=false;render();}
  }

  function artCalendar() {
    const numbers=Array.from({length:35},(_,i)=>i>=1 && i<=31?i:'');
    return `<div class="hero-art" aria-hidden="true"><div class="decor-circle"></div><div class="art-calendar"><div class="art-heading"><span>DECEMBER 2026</span><span class="art-dot-row"><b></b><b></b><b></b></span></div><div class="art-weekdays">${['월','화','수','목','금','토','일'].map(d=>`<span>${d}</span>`).join('')}</div><div class="art-days">${numbers.map(n=>`<span class="art-day ${[4,9,11,18,20,24].includes(n)?'active':''} ${n===24?'star':''}">${n||''}</span>`).join('')}</div></div><div class="art-ticket">♥ 모두 함께하는 날 <small>DEC 24 · HOLIDAY SEASON</small></div></div>`;
  }
  function header() {
    return `<header class="site-header"><div class="shell header-inner"><a class="brand" href="#home" aria-label="모두의 연말 홈"><img src="./assets/favicon.svg" alt="" width="39" height="39"><span><span class="brand-name">모두의 연말</span><span class="brand-caption">TOGETHER, THIS YEAR</span></span></a><nav class="header-nav" aria-label="주 메뉴"><a href="#home">내 모임</a><a href="#create">새 모임 만들기</a><a href="#how">참여 방법</a></nav><div class="header-actions"><button class="icon-btn" data-action="refresh" title="일정 새로고침" aria-label="일정 새로고침">${icon('refresh')}</button><button class="icon-btn" data-action="theme" title="화면 테마 변경" aria-label="${state.theme==='light'?'어두운 모드로 변경':'밝은 모드로 변경'}">${icon(state.theme==='light'?'moon':'sun')}</button><button class="icon-btn mobile-menu-btn" data-action="menu" aria-label="메뉴 열기" aria-expanded="${state.menuOpen}">${icon('menu')}</button></div></div><nav class="mobile-nav ${state.menuOpen?'open':''}" aria-label="모바일 메뉴"><a href="#home">내 모임</a><a href="#create">새 모임 만들기</a><a href="#how">참여 방법</a></nav></header>`;
  }
  function footer() {return `<footer class="site-footer"><div class="shell footer-inner"><div class="footer-brand">✳ 모두의 연말 <small>모두에게 좋은 날짜와 장소를 정하는 쉬운 방법.</small></div><div class="footer-links"><a href="#home">내 모임</a><a href="#create">새 모임 만들기</a><a href="#how">참여 방법</a></div></div></footer>`;}
  function banner() {
    if (state.error) return `<div class="info-banner error" role="alert">${icon('alert')}<span><strong>연결 오류</strong> — ${escapeHtml(state.error)} 이전 응답이 있다면 표시하지만, 새 제출은 연결 복구 후 가능합니다. <button class="link-button" data-action="refresh">다시 시도</button></span></div>`;
    if (!isLive) return `<div class="info-banner" role="status">${icon('info')}<span><strong>Cloudflare D1 연결 전입니다.</strong> 저장 기능을 사용할 수 없습니다. <code>config.js</code>에 Cloudflare Worker API 주소를 입력하세요.</span></div>`;
    return '';
  }
  function eventCard(event) {
    const count=responsesFor(event.id).length;
    const stage=placeFor(event).stage;
    return `<a class="event-card" href="#event/${encodeURIComponent(event.id)}"><div class="event-card-top"><span class="event-badge"><i class="live"></i>${escapeHtml(stage==='none'?(eventIsOpen(event)?'날짜 투표 중':'날짜 투표 마감'):stageLabel(stage))}</span><span class="kicker">${modeLabel(event.mode)}</span></div><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.description)}</p><div class="subinfo"><span>${icon('calendar')} ${event.mode==='place'?escapeHtml(event.meetingDate||'장소만 정하기'):escapeHtml(formatDate(event.startDate,{month:'numeric',day:'numeric'}))}</span><span>${icon('users')} ${count}명 날짜 응답</span></div><div class="event-card-bottom"><span>${event.mode!=='date'?'장소 후보 '+placeFor(event).proposals.length+'곳':escapeHtml(event.location)}</span><strong>참여하기 ${icon('arrow-right')}</strong></div></a>`;
  }
  function openExistingMarkup() {
    return `<section class="recover-section" id="open-existing"><div class="section-top"><div><span class="kicker">EXISTING INVITATION</span><h2>기존 모임 링크로 다시 열기</h2><p>예전에 사용했던 초대 링크 또는 모임 ID를 입력하면, 저장된 투표 기록을 그대로 불러옵니다. 새 모임이나 투표를 만들지 않습니다.</p></div></div><div class="panel recovery-panel"><form id="open-existing-form" novalidate><div class="field"><label for="existing-link">기존 모임 초대 링크 또는 모임 ID *</label><input id="existing-link" name="link" class="input-field" required autocomplete="off" spellcheck="false" placeholder="https://.../#event/모임ID 또는 모임ID"></div><div class="recovery-bottom"><span class="form-hint">링크에서 ID를 확인한 다음 기존 Cloudflare D1에서 이 모임과 투표 내역을 조회합니다.</span><button class="button dark" type="submit">기존 기록 불러오기 ${icon('arrow-right')}</button></div></form></div></section>`;
  }
  function recoveryMarkup() {
    return `<section class="recover-section" id="recover"><div class="section-top"><div><span class="kicker">FIND MY GATHERING</span><h2>참여한 모임 다시 찾기</h2><p>초대 링크를 잃어버렸다면 이전에 제출한 내용으로 찾아보세요. 종료된 모임도 확인할 수 있습니다.</p></div></div><div class="panel recovery-panel"><form id="recover-form" novalidate><div class="recovery-grid"><div class="field"><label for="recover-title">정확한 모임 이름 *</label><input id="recover-title" name="title" class="input-field" maxlength="80" required placeholder="예: 우리 동호회 연말 모임"></div><div class="field"><label for="recover-name">투표할 때 적은 이름 *</label><input id="recover-name" name="name" class="input-field" maxlength="30" required placeholder="예: 김민수"></div><div class="field wide"><label for="recover-dates">당시 선택했던 날짜 전체 *</label><input id="recover-dates" name="dates" class="input-field" required placeholder="예: 2026-12-05, 2026-12-11"><p class="form-hint">선택한 날짜를 YYYY-MM-DD 형식으로 쉼표로 구분해 빠짐없이 입력해 주세요. 한 날만 선택했다면 한 개만 입력해도 됩니다.</p></div></div><div class="recovery-bottom"><span class="form-hint">기록 조회용입니다. 다른 기기에서 기존 투표를 수정하려면 원래 기기의 수정 권한이 필요합니다.</span><button class="button dark" type="submit" ${state.saving?'disabled':''}>기존 모임 찾기 ${icon('arrow-right')}</button></div></form></div></section>`;
  }
  function home() {
    return `<main id="main" class="shell"><section class="hero" aria-labelledby="hero-title"><div class="hero-content"><div class="eyebrow"><span class="dot"></span> PRIVATE GATHERINGS</div><h1 id="hero-title">우리끼리 정하는 날,<br><em>만날 장소까지.</em></h1><p>모임 목록은 공개되지 않습니다.<br>날짜 투표와 지도 장소 추천을 하나의 초대 링크에서 진행하세요.</p><div class="hero-actions"><a class="button primary" href="#open-existing">기존 모임 불러오기 ${icon('arrow-right')}</a><a class="button ghost" href="#create">${icon('plus')} 새 비공개 모임 만들기</a></div></div>${artCalendar()}</section>${banner()}<section id="events" class="section"><div class="section-top"><div><span class="kicker">MY GATHERINGS</span><h2>이 기기에서 방문한 모임</h2><p>초대 링크를 열었거나 투표했던 모임만 여기에 보입니다. 다른 이용자의 모임은 보이지 않습니다.</p></div><span class="section-aside">${state.data.events.length}개</span></div>${state.data.events.length?`<div class="event-list">${state.data.events.map(eventCard).join('')}</div>`:`<div class="event-empty">${icon('calendar')}<h3>아직 방문한 모임이 없어요</h3><p>기존 모임 링크를 붙여 넣거나, 참여 당시 입력한 정보로 모임을 다시 찾을 수 있습니다.</p><a href="#open-existing" class="button dark">기존 모임 불러오기</a></div>`}</section>${openExistingMarkup()}${recoveryMarkup()}<section id="how" class="how-section"><div class="section-top"><div><span class="kicker">HOW IT WORKS</span><h2>비공개 모임 참여 방법</h2></div></div><div class="steps"><div class="step"><span class="step-num">01</span><div><h3>초대 링크 열기</h3><p>모임 주최자에게 받은 전용 링크로 접속합니다.</p></div></div><div class="step"><span class="step-num">02</span><div><h3>가능한 날짜 또는 장소 추천</h3><p>날짜를 선택하거나 지도에서 장소 핀을 찍고 추천 이유를 적을 수 있어요.</p></div></div><div class="step"><span class="step-num">03</span><div><h3>최종 날짜와 장소 결정</h3><p>장소 추천 기한이 끝나면 장소 투표가 열리고, 투표 종료 후 최다 득표 장소를 알려줍니다.</p></div></div></div></section></main>`;
  }
  function calendarMarkup(event,draft) {
    const dates=new Set(dateRange(event));
    const enabled=eventIsOpen(event) && !state.error;
    const month=state.calendarMonth;
    const [year,m]=month.split('-').map(Number);
    const monthStart=new Date(Date.UTC(year,m-1,1));
    const offset=(monthStart.getUTCDay()+6)%7;
    const daysInMonth=new Date(Date.UTC(year,m,0)).getUTCDate();
    const cells=[];
    for(let i=0;i<Math.ceil((offset+daysInMonth)/7)*7;i++) {
      const day=i-offset+1;
      if(day<1||day>daysInMonth){cells.push('<span class="day other" aria-hidden="true"></span>');continue;}
      const iso=`${month}-${String(day).padStart(2,'0')}`;
      const valid=dates.has(iso) && iso>=todayKST();
      const chosen=draft.dates.includes(iso);
      const num=countsFor(event.id).get(iso)||0;
      const topNum=Math.max(0,...countsFor(event.id).values());
      const recommended=num>0 && num===topNum;
      cells.push(`<button type="button" class="day ${valid?'available':''} ${chosen?'selected':''} ${recommended?'recommended':''} ${iso===todayKST()?'today':''}" data-action="date" data-date="${iso}" aria-pressed="${chosen}" title="${escapeHtml(formatDate(iso))}${num?`, ${num}명 가능`:''}" ${!valid||!enabled?'disabled':''}><span>${day}</span>${num?`<span class="count">${num}명</span>`:''}</button>`);
    }
    const first=event.startDate.slice(0,7),last=event.endDate.slice(0,7);
    const chosenDates=[...draft.dates].sort();
    return `<section class="panel calendar-panel" aria-label="가능한 날짜 선택"><div class="panel-label"><div><h2>가능한 날짜를 골라주세요</h2><p>한 날짜만이 아니라, 가능한 날짜를 모두 선택할 수 있어요.</p></div><div class="tiny-icon">${icon('calendar')}</div></div><div class="calendar-toolbar"><span class="month-title">${monthLabel(month)}</span><div class="month-nav"><button type="button" data-action="prev-month" aria-label="이전 달" ${month<=first?'disabled':''}>${icon('chevron-left')}</button><button type="button" data-action="next-month" aria-label="다음 달" ${month>=last?'disabled':''}>${icon('chevron-right')}</button></div></div><div class="calendar" role="group" aria-label="${monthLabel(month)} 선택 가능한 날짜">${['월','화','수','목','금','토','일'].map((d,i)=>`<span class="weekday ${i===6?'sunday':''}">${d}</span>`).join('')}${cells.join('')}</div><div class="legend"><span><b class="sel"></b> 내가 선택한 날짜</span><span><b class="pop"></b> 많이 선택한 날짜</span><span><b></b> 선택 가능한 날짜</span></div><div class="calendar-divider"></div><div class="picked-head"><h3>선택한 날짜 <span style="color:var(--coral)">${chosenDates.length}</span></h3><button type="button" class="link-button" data-action="clear-dates" ${chosenDates.length===0?'disabled':''}>모두 지우기</button></div><div class="selected-chips">${chosenDates.length?chosenDates.map(date=>`<span class="date-chip">${escapeHtml(formatDate(date))}<button data-action="remove-date" data-date="${date}" aria-label="${escapeHtml(formatDate(date))} 선택 해제">${icon('x')}</button></span>`).join(''):`<p class="helper-text">달력에서 참석 가능한 날짜를 선택해 주세요.</p>`}</div></section>`;
  }
  function formMarkup(event,draft) {
    const count=draft.dates.length;
    const open=eventIsOpen(event);
    return `<aside class="panel form-panel sticky" aria-label="참석 응답 등록"><div class="panel-label"><div><h2>참석 가능 날짜 제출</h2><p>이름과 선택한 날짜를 확인해 주세요.</p></div><div class="tiny-icon">${icon('check')}</div></div><form id="response-form" novalidate><label class="input-label" for="attendee-name">이름 <span style="color:var(--coral)">*</span></label><input id="attendee-name" class="input-field" name="name" autocomplete="name" maxlength="30" placeholder="예: 김민수" value="${escapeHtml(draft.name)}" ${!open?'disabled':''} required><p class="form-hint">다른 참석자가 알아볼 수 있는 이름으로 적어주세요.</p><div class="summary-preview"><div class="summary-top">내가 참석할 수 있는 날짜</div><strong>${count}<span style="font-size:14px"> 일</span></strong><div class="summary-bottom">${count?escapeHtml([...draft.dates].sort().map(d=>formatDate(d,{month:'numeric',day:'numeric'})).join(' · ')):'아직 날짜를 선택하지 않았어요.'}</div></div><label class="checkbox-line"><input type="checkbox" id="consent" ${draft.consent?'checked':''} ${!open?'disabled':''}> <span>이름과 선택 날짜가 저장되고, 초대 링크로 들어온 모임 참여자에게 날짜별로 표시되는 데 동의합니다.</span></label><button class="button dark full" type="submit" ${!open||!!state.error||state.saving?'disabled':''}>${state.saving?`<span class="spinner"></span> D1 저장 중…`:`${draft.id?'내 응답 수정하기':'가능한 날짜 제출하기'} ${icon('arrow-right')}`}</button>${!open?`<p class="form-error">이 모임은 응답 기간이 끝났습니다.</p>`:''}${state.error?'<p class="form-error">연결 상태를 확인한 뒤 제출할 수 있습니다.</p>':''}${state.statusMessage?`<div class="form-success" role="status">${escapeHtml(state.statusMessage)}</div>`:''}<p class="privacy-note">${isLive?'제출 후 Cloudflare D1에 저장됩니다.':'서버 연결 전에는 저장할 수 없습니다.'}<br>기존 응답 수정은 원래 사용한 브라우저에서만 가능합니다. 마감 후에는 기록 조회만 할 수 있습니다.</p></form></aside>`;
  }
  function resultMarkup(event) {
    const responses=responsesFor(event.id),counts=countsFor(event.id);
    const sorted=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    const top=sorted.slice(0,6);
    const max=sorted.length?sorted[0][1]:1;
    const namesAt=date=>responses.filter(r=>r.dates.includes(date)).map(r=>r.name);
    const nameChips=names=>`<div class="voter-chips">${names.map(name=>`<span class="voter-chip">${escapeHtml(name)}</span>`).join('')}</div>`;
    return `<section id="results" class="result-section"><div class="section-top"><div><span class="kicker">AVAILABILITY OVERVIEW</span><h2>모두의 선택 현황</h2><p>어느 날짜에 누가 참석 가능한지, 마감된 모임에서도 확인할 수 있어요.</p></div><span class="section-aside">${responses.length}명 응답</span></div>${top.length?`<div class="winner-summary"><strong>${icon('check-circle')} 가장 많이 선택한 날짜 · ${max}명</strong>${sorted.filter(([d,n])=>n===max).map(([d])=>`<div class="winning-date"><p>${escapeHtml(formatDate(d,{year:'numeric',month:'numeric',day:'numeric',weekday:'short'}))}</p>${nameChips(namesAt(d))}</div>`).join('')}</div>`:''}<div class="results-grid"><div class="panel results-panel"><div class="result-header"><h3>가능한 날짜 TOP 6</h3><span>복수 선택 가능</span></div>${top.length?top.map(([date,num])=>`<div class="result-item"><div class="result-row"><span class="result-date">${escapeHtml(formatDate(date,{month:'numeric',day:'numeric',weekday:'short'}))}</span><span class="result-track"><span style="width:${(num/max)*100}%"></span></span><span class="result-count">${num}명</span></div><div class="result-voters">${nameChips(namesAt(date))}</div></div>`).join(''):`<div class="empty-mini">${icon('calendar')}아직 선택된 날짜가 없어요.</div>`}</div><div class="panel results-panel"><div class="result-header"><h3>참여자 <span style="font-weight:500;color:var(--muted)">${responses.length}명</span></h3><span>이름별 선택 날짜</span></div>${responses.length?`<div class="participant-list">${[...responses].reverse().map(r=>`<div class="person"><div class="person-info"><div class="avatar">${escapeHtml((r.name||'•').slice(0,1))}</div><div class="person-body"><strong>${escapeHtml(r.name)}</strong><small>${r.dates.length?escapeHtml([...r.dates].sort().map(d=>formatDate(d,{month:'numeric',day:'numeric'})).join(' · ')):'선택 날짜 없음'}</small></div></div><span>${r.dates.length}일</span></div>`).join('')}</div>`:`<div class="empty-mini">${icon('users')}아직 참여한 사람이 없습니다.</div>`}</div></div>${sorted.length>6?`<div class="panel all-dates-panel"><h3>전체 날짜별 참석 가능자 (${sorted.length}개 날짜)</h3><p class="helper-text">TOP 6에 없는 날짜도 모두 표시됩니다.</p><div class="all-dates-list">${sorted.map(([date,num])=>`<div class="all-date"><strong>${escapeHtml(formatDate(date,{year:'numeric',month:'numeric',day:'numeric',weekday:'short'}))} · ${num}명</strong>${nameChips(namesAt(date))}</div>`).join('')}</div></div>`:''}</section>`;
  }
  function dateDecisionMarkup(event){
    if(event.mode==='place' || eventIsOpen(event))return '';
    const counts=countsFor(event.id);
    const highest=Math.max(0,...counts.values());
    if(!highest)return `<div class="stage-notice">날짜 응답이 없어 확정 가능한 날짜가 없습니다.</div>`;
    const ties=[...counts].filter(([,n])=>n===highest).map(([day])=>day).sort();
    const winner=ties[0];
    const people=responsesFor(event.id).filter(r=>r.dates.includes(winner)).map(r=>r.name);
    return `<div class="date-decision"><span class="kicker">RECOMMENDED MEETING DATE</span><h3>${escapeHtml(formatDate(winner,{year:'numeric',month:'long',day:'numeric',weekday:'long'}))}</h3><p>가장 많은 ${highest}명 참석 가능 · ${escapeHtml(people.join(', '))}</p>${ties.length>1?`<p>공동 1위 ${ties.length}일 중 가장 이른 날짜를 대표 날짜로 표시했습니다. 다른 공동 1위 날짜도 아래에 표시됩니다.</p>`:''}</div>`;
  }
  function placeMarkup(event) {
    if(event.mode==='date')return '';
    const stage=placeFor(event).stage,place=placeFor(event),draft=getPlaceDraft(event.id);
    const counts=new Map();place.votes.forEach(v=>counts.set(v.proposalId,(counts.get(v.proposalId)||0)+1));
    const selectedId=place.winner?.proposalId;
    const winner=place.proposals.find(p=>p.id===selectedId);
    const allowSuggest=stage==='proposals' && !state.error;
    const allowVote=stage==='voting' && !state.error;
    let intro='';
    if(stage==='waiting')intro=`<div class="stage-notice">${icon('clock')} 날짜 투표가 ${escapeHtml(event.deadline)}에 마감되면 장소 추천이 시작됩니다.</div>`;
    if(stage==='proposals')intro=`<div class="stage-notice">${icon('pin')} <strong>장소 추천 기간</strong> · ${escapeHtml(event.proposalDeadline)} 23:59까지 · 1인 1곳 추천</div>`;
    if(stage==='voting')intro=`<div class="stage-notice">${icon('check')} <strong>장소 투표 기간</strong> · ${escapeHtml(event.voteDeadline)} 23:59까지 · 이름당 1표</div>`;
    if(stage==='result')intro=`<div class="stage-notice">${icon('check-circle')} 장소 투표가 마감됐습니다. 결과는 계속 보관됩니다.</div>`;
    const pinInfo=Number.isFinite(draft.lat)&&Number.isFinite(draft.lng)?`${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`:'아직 핀을 찍지 않았어요';
    const mapOptions=[['open','기본 지도 (키 불필요)'],['kakao','카카오 지도'],['naver','네이버 지도'],['google','구글 지도']];
    const proposalForm=allowSuggest?`<form id="place-proposal-form" class="place-edit" novalidate><div class="field"><label for="place-person">추천자 이름 *</label><input id="place-person" class="input-field" name="name" maxlength="30" required autocomplete="name" value="${escapeHtml(draft.name)}" placeholder="홍길동"></div><div class="field"><label for="place-title">추천하는 장소 이름 *</label><input id="place-title" class="input-field" name="placeName" maxlength="90" required value="${escapeHtml(draft.placeName)}" placeholder="예: 서울숲 입구 카페"></div><div class="field"><label for="place-comment">이 장소를 추천하는 이유 (선택)</label><textarea id="place-comment" class="input-field edit-textarea" name="comment" maxlength="280" placeholder="예: 옛 연인과의 추억이 있는 곳이라서…">${escapeHtml(draft.comment)}</textarea></div><div class="pin-status">${icon('pin')} <span id="picked-coordinates">${escapeHtml(pinInfo)}</span></div><div class="coordinate-row"><div class="field"><label for="place-lat">위도 (지도에서 자동 입력)</label><input id="place-lat" type="number" step="any" min="-90" max="90" name="lat" class="input-field" placeholder="37.5665" value="${Number.isFinite(draft.lat)?draft.lat:''}"></div><div class="field"><label for="place-lng">경도 (지도에서 자동 입력)</label><input id="place-lng" type="number" step="any" min="-180" max="180" name="lng" class="input-field" placeholder="126.9780" value="${Number.isFinite(draft.lng)?draft.lng:''}"></div></div><label class="checkbox-line"><input id="place-consent" type="checkbox" ${draft.consent?'checked':''}><span>이름, 장소 위치와 추천 사연이 초대 링크 보유자에게 공개되는 데 동의합니다.</span></label><button type="submit" class="button dark full" ${state.saving?'disabled':''}>${icon('plus')} 이 장소 추천하기</button></form>`:'';
    const voteForm=allowVote?`<form id="place-vote-form" class="place-vote-form" novalidate><div class="field"><label for="place-voter">투표 이름 *</label><input id="place-voter" name="name" class="input-field" maxlength="30" value="${escapeHtml(draft.name)}" placeholder="홍길동" required></div><p class="form-hint">아래 후보 중 한 곳을 선택해 주세요. 같은 브라우저에서는 마감 전에 변경할 수 있습니다.</p><div class="vote-choice-list">${place.proposals.map(p=>`<label class="vote-choice"><input type="radio" name="proposalId" value="${escapeHtml(p.id)}" ${draft.selected===p.id?'checked':''}><span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.proposer)} 추천</small></span></label>`).join('')}</div><label class="checkbox-line"><input id="vote-consent" type="checkbox" ${draft.consent?'checked':''}><span>투표 이름과 선택한 장소가 초대 링크 보유자에게 공개되는 데 동의합니다.</span></label><button type="submit" class="button dark full" ${state.saving?'disabled':''}>${icon('check')} 장소 한 곳에 투표하기</button></form>`:'';
    const candidateList=place.proposals.length?`<div class="place-proposals">${place.proposals.map((p,i)=>`<article class="place-option ${p.id===selectedId?'winner-option':''}"><div class="place-number">${p.id===selectedId?'★':i+1}</div><div class="place-option-content"><div class="place-titleline"><h3>${escapeHtml(p.name)}</h3>${stage==='result'?`<strong>${counts.get(p.id)||0}표</strong>`:''}</div><div class="form-hint">추천자 · ${escapeHtml(p.proposer)}</div>${p.comment?`<p class="place-quote">“${escapeHtml(p.comment)}”</p>`:''}${externalMapLinks(p)}${stage==='result'?`<p class="form-hint">투표자: ${escapeHtml(place.votes.filter(v=>v.proposalId===p.id).map(v=>v.voterName).join(', ')||'없음')}</p>`:''}</div></article>`).join('')}</div>`:`<div class="empty-mini">아직 추천된 장소가 없습니다. 추천 마감일까지 핀을 찍어 주세요.</div>`;
    const finalMessage=stage==='result'?(winner?`<div class="place-winner"><span class="kicker">FINAL LOCATION</span><h3>📍 ${escapeHtml(winner.name)}</h3><p>${place.winner.votes}표 · ${place.winner.tie?'동점으로 먼저 추천한 장소를 선정했습니다.':'최다 득표 장소입니다.'}</p>${event.meetingDate?`<p>모임 날짜: ${escapeHtml(formatDate(event.meetingDate,{year:'numeric',month:'numeric',day:'numeric',weekday:'short'}))}</p>`:''}${externalMapLinks(winner)}</div>`:`<div class="stage-notice">${place.proposals.length?'투표가 없어 최종 장소를 결정하지 못했습니다.':'추천된 장소가 없어 최종 장소를 결정하지 못했습니다.'}</div>`):'';
    return `<section class="place-section" id="places"><div class="section-top"><div><span class="kicker">WHERE SHALL WE MEET?</span><h2>우리 모임의 장소</h2><p>장소 추천 → 후보 자동 확정 → 한 사람당 한 표 → 최종 장소 자동 발표</p></div><span class="section-aside">${place.proposals.length}곳 추천</span></div><div class="phase-steps"><span class="${stage==='waiting'?'active':''}">① 날짜 정하기</span><span class="${stage==='proposals'?'active':''}">② 장소 추천</span><span class="${stage==='voting'?'active':''}">③ 장소 투표</span><span class="${stage==='result'?'active':''}">④ 결과</span></div>${intro}${finalMessage}<div class="place-layout"><div class="panel place-map-panel"><div class="map-toolbar"><strong>${icon('pin')} 지도에서 장소 확인${allowSuggest?' · 핀 찍기':''}</strong><select id="place-map-provider" class="input-field map-select" aria-label="지도 제공사 선택">${mapOptions.map(([value,label])=>`<option value="${value}" ${state.mapProvider===value?'selected':''}>${label}</option>`).join('')}</select></div><div id="place-map" class="place-map" role="application" aria-label="모임 후보 장소 지도"></div><p class="form-hint" id="map-status">${allowSuggest?'원하는 위치를 지도에서 클릭하면 핀이 저장됩니다.':'후보 장소를 지도로 확인하세요.'} 지도 제공사 키를 등록하지 않았다면 기본 지도를 사용하세요.</p><button type="button" class="button outline small map-my-location" data-action="my-location">${icon('pin')} 내 위치로 이동</button>${candidateList}</div><div class="panel place-input-panel"><h3>${stage==='proposals'?'추천 장소 등록':stage==='voting'?'장소 투표하기':stage==='waiting'?'장소 추천 준비 중':'최종 결과 확인'}</h3>${proposalForm}${voteForm}${stage==='waiting'?`<p class="helper-text">추천 시작 전입니다. 날짜 결과를 먼저 확인해 주세요.</p>`:''}${stage==='voting'&&!place.proposals.length?`<p class="helper-text">추천된 장소가 없어 투표할 수 없습니다.</p>`:''}${stage==='result'?`<p class="helper-text">투표는 마감됐습니다. 후보별 득표수와 투표자를 왼쪽에서 확인할 수 있습니다.</p>`:''}<p class="privacy-note">모임 링크를 알고 있는 사람만 조회할 수 있습니다. 이름만으로는 본인 확인이 되지 않으므로 초대 링크를 신뢰할 수 있는 사람에게만 공유하세요.</p></div></div></section>`;
  }
  function eventPage(event) {
    const draft=getDraft(event.id),hasDates=event.mode!=='place',allowed=hasDates?new Set(dateRange(event)):new Set();
    draft.dates=draft.dates.filter(d=>allowed.has(d));
    if(state.selectedEventId!==event.id){
      state.selectedEventId=event.id;
      const months=Array.from(allowed).sort();
      const initial=months.find(d=>d>=todayKST())||months[0]||event.startDate;
      state.calendarMonth=initial.slice(0,7);state.statusMessage='';
    }
    const open=eventIsOpen(event);
    const stage=placeFor(event).stage;
    const title=stage!=='none'?stageLabel(stage):(open?'날짜 투표 중':'날짜 투표 마감');
    return `<main id="main" class="shell"><nav class="breadcrumb"><a href="#home">내 모임</a>${icon('chevron-right')}<span>${escapeHtml(event.title)}</span></nav>${banner()}<div class="detail-head"><div class="detail-title"><div><span class="event-badge"><i class="live"></i>${escapeHtml(title)}</span><h1>${escapeHtml(event.title)}</h1><p>${escapeHtml(event.description)}</p></div><div class="detail-admin-actions"><a class="button ghost small" href="#manage/${encodeURIComponent(event.id)}">${icon('calendar')} 모임 관리</a><button class="button ghost small" data-action="share">${icon('share')} 초대 링크 복사</button></div></div><div class="meta-chips"><span class="meta-chip">${modeLabel(event.mode)}</span>${hasDates?`<span class="meta-chip">${icon('calendar')} ${escapeHtml(formatDate(event.startDate,{month:'numeric',day:'numeric'}))} ~ ${escapeHtml(formatDate(event.endDate,{month:'numeric',day:'numeric'}))}</span>`:''}${event.meetingDate?`<span class="meta-chip">${icon('calendar')} 확정 날짜 ${escapeHtml(formatDate(event.meetingDate))}</span>`:''}${event.deadline&&hasDates?`<span class="meta-chip">${icon('clock')} 날짜 응답 마감 ${escapeHtml(event.deadline)}</span>`:''}</div></div>${hasDates?(open?`<div class="detail-grid">${calendarMarkup(event,draft)}${formMarkup(event,draft)}</div>${resultMarkup(event)}`:`<div class="archive-notice">${icon('info')} 날짜 투표가 마감됐습니다. 최다 참석 가능 날짜와 이름을 확인하세요.</div>${dateDecisionMarkup(event)}${resultMarkup(event)}`):''}${placeMarkup(event)}<div class="backline"><a class="button outline" href="#home">${icon('arrow-left')} 내 모임으로</a></div></main>`;
  }
  function editPage(event) {
    const edit=Boolean(event),today=todayKST();
    const e=event||{title:'',description:'',location:'',startDate:addDays(today,14),endDate:addDays(today,28),
      deadline:addDays(today,3),publicNames:true,status:'OPEN',allowedDates:[],mode:'both',
      proposalDeadline:addDays(today,7),voteDeadline:addDays(today,10),meetingDate:''};
    const dates=(e.allowedDates||[]).join(', ');
    return `<main id="main" class="shell"><nav class="breadcrumb"><a href="#home">내 모임</a>${icon('chevron-right')}<span>${edit?'모임 관리':'새 모임 만들기'}</span></nav>${banner()}<section class="edit-wrap"><div class="edit-intro"><span class="kicker">PLAN YOUR GATHERING</span><h1>${edit?'모임 정보 관리':'새 모임 만들기'}</h1><p>날짜와 장소를 함께, 또는 각각 따로 정할 수 있어요. 참여는 비공개 링크로만 가능합니다.</p></div><div class="panel edit-panel"><form id="event-form" novalidate><input type="hidden" name="id" value="${escapeHtml(e.id||pendingEventId())}"><input type="hidden" name="operation" value="${edit?'update':'create'}"><div class="edit-form-grid"><div class="field wide"><label for="ev-title">모임 이름 *</label><input id="ev-title" name="title" class="input-field" maxlength="80" required value="${escapeHtml(e.title)}" placeholder="우리 모임"></div><div class="field wide"><label for="ev-mode">기능 선택 *</label><select id="ev-mode" name="mode" class="input-field"><option value="both" ${e.mode==='both'?'selected':''}>날짜 + 장소 (순서대로 진행)</option><option value="date" ${e.mode==='date'?'selected':''}>날짜만 투표</option><option value="place" ${e.mode==='place'?'selected':''}>장소만 추천·투표</option></select><p class="form-hint">날짜+장소: 날짜 투표 마감 후 장소 추천이 시작됩니다.</p></div><div class="field wide"><label for="ev-description">모임 안내</label><textarea id="ev-description" name="description" class="input-field edit-textarea" maxlength="800" placeholder="모임을 소개해 주세요.">${escapeHtml(e.description)}</textarea></div><div class="field wide only-dates"><label for="ev-location">장소 안내 (선택)</label><input id="ev-location" name="location" class="input-field" maxlength="120" value="${escapeHtml(e.location)}" placeholder="장소 투표 후 결정"></div><div class="field only-dates"><label for="ev-start">후보 시작 날짜 *</label><input id="ev-start" type="date" name="startDate" class="input-field" value="${escapeHtml(e.startDate)}"></div><div class="field only-dates"><label for="ev-end">후보 마지막 날짜 *</label><input id="ev-end" type="date" name="endDate" class="input-field" value="${escapeHtml(e.endDate)}"></div><div class="field only-dates"><label for="ev-deadline">날짜 응답 마감 *</label><input id="ev-deadline" type="date" name="deadline" class="input-field" value="${escapeHtml(e.deadline)}"></div><div class="field wide only-dates"><label for="ev-allowed">특정 날짜만 후보로 지정 (선택)</label><input id="ev-allowed" name="allowedDates" class="input-field" value="${escapeHtml(dates)}" placeholder="2026-12-11, 2026-12-18"><p class="form-hint">비워 두면 시작일부터 마지막 날짜까지 모두 후보입니다.</p></div><div class="field only-place"><label for="ev-propose-deadline">장소 추천 마감 *</label><input id="ev-propose-deadline" type="date" name="proposalDeadline" class="input-field" value="${escapeHtml(e.proposalDeadline)}"></div><div class="field only-place"><label for="ev-vote-deadline">장소 투표 마감 *</label><input id="ev-vote-deadline" type="date" name="voteDeadline" class="input-field" value="${escapeHtml(e.voteDeadline)}"></div><div class="field wide only-place"><label for="ev-meet-date">이미 확정된 모임 날짜 (선택)</label><input id="ev-meet-date" type="date" name="meetingDate" class="input-field" value="${escapeHtml(e.meetingDate)}"><p class="form-hint">장소만 정할 때도 날짜를 적어 둘 수 있습니다. 장소 투표 마감 후의 날짜여야 합니다.</p></div><div class="field"><label for="ev-status">모임 상태</label><select id="ev-status" name="status" class="input-field"><option value="OPEN" ${e.status==='OPEN'?'selected':''}>진행 중</option><option value="CLOSED" ${e.status==='CLOSED'?'selected':''}>직접 마감 (기록 보존)</option></select></div><div class="field wide"><label for="ev-admin-key">관리 비밀번호 (8자 이상) *</label><input id="ev-admin-key" type="password" name="password" class="input-field" required minlength="8" maxlength="128" autocomplete="new-password"><p class="form-hint">모임 수정 시 이 비밀번호가 필요합니다. 서버에는 해시로 저장됩니다.</p></div>${!edit?`<div class="field wide"><label for="ev-admin-confirm">관리 비밀번호 확인 *</label><input id="ev-admin-confirm" type="password" name="passwordConfirm" class="input-field" required minlength="8" maxlength="128"></div>`:''}</div><div class="edit-bottom"><div class="edit-warning">단계 마감은 한국시간 23:59 기준입니다. 기존 기록을 자동 삭제하지 않습니다. 장소 추천/투표가 시작되면 기간을 변경할 수 없습니다.</div><button type="submit" class="button dark" ${!isLive||!!state.error?'disabled':''}>${edit?'모임 정보 저장':'모임 생성 및 초대 링크 받기'} ${icon('arrow-right')}</button></div></form></div></section></main>`;
  }
  async function persistEvent(info) {
    if(!isLive)throw new Error('Cloudflare API 연결 전에는 등록할 수 없습니다.');
    await postApi('/api/events',info);
    rememberEvent(info.id);
    state.data=await readFromApi();
    return true;
  }
  async function submitEvent(form) {
    if(state.saving)return;
    const d=new FormData(form),button=form.querySelector('[type=submit]');
    const mode=String(d.get('mode')||'date'),today=todayKST();
    const meetingDate=String(d.get('meetingDate')||'');
    const start=mode==='place'?(meetingDate||today):String(d.get('startDate')||'');
    const end=mode==='place'?(meetingDate||today):String(d.get('endDate')||'');
    const info={operation:String(d.get('operation')),id:String(d.get('id')),title:String(d.get('title')||'').trim(),
      description:String(d.get('description')||'').trim(),location:String(d.get('location')||'').trim(),
      startDate:start,endDate:end,deadline:mode==='place'?'':String(d.get('deadline')||''),
      status:String(d.get('status')||'OPEN'),publicNames:true,mode,
      proposalDeadline:mode==='date'?'':String(d.get('proposalDeadline')||''),
      voteDeadline:mode==='date'?'':String(d.get('voteDeadline')||''),
      meetingDate:mode==='date'?'':meetingDate,
      password:String(d.get('password')||''),passwordConfirm:String(d.get('passwordConfirm')||''),
      allowedDates:mode==='place'?[]:String(d.get('allowedDates')||'').split(',').map(v=>v.trim()).filter(Boolean)};
    if(!info.title || info.title.length>80 || !isIsoDate(start) || !isIsoDate(end)||end<start)
      return toast('모임명과 날짜를 확인해 주세요.');
    if((new Date(end)-new Date(start))/86400000>=120)return toast('후보 날짜 범위는 최대 120일입니다.');
    if(mode!=='place'&&(!isIsoDate(info.deadline) || info.allowedDates.some(t=>!isIsoDate(t)||t<start||t>end)))
      return toast('날짜 응답 마감 및 후보 날짜를 확인해 주세요.');
    if(mode!=='date'&&(!isIsoDate(info.proposalDeadline)||!isIsoDate(info.voteDeadline)||
       info.proposalDeadline>=info.voteDeadline||(mode==='both'&&info.deadline>=info.proposalDeadline)))
      return toast('날짜 응답 마감 → 장소 추천 마감 → 장소 투표 마감 순서로 설정해 주세요.');
    if(mode!=='date'&&info.meetingDate&&(!isIsoDate(info.meetingDate)||info.meetingDate<info.voteDeadline))
      return toast('확정된 모임 날짜는 장소 투표 마감 이후로 지정해 주세요.');
    if(!isLive||state.error)return toast('Cloudflare API 연결을 확인해 주세요.');
    if(info.password.length<8||info.password.length>128)return toast('관리 비밀번호는 8자 이상 입력해 주세요.');
    if(info.operation==='create'&&info.password!==info.passwordConfirm)return toast('관리 비밀번호 확인이 일치하지 않습니다.');
    state.saving=true;button.disabled=true;
    try{
      await persistEvent(info);safeStore('pendingEventId','');
      location.hash=`#event/${encodeURIComponent(info.id)}`;
      await refreshData(true);toast('모임을 저장했습니다. 초대 링크를 공유하세요.');
    }catch(err){toast(err.message||'모임을 저장하지 못했습니다.');}
    finally{state.saving=false;if(button.isConnected)button.disabled=false;}
  }
  async function submitPlaceProposal(form){
    if(state.saving)return;
    const e=getEvent(route().id),draft=getPlaceDraft(e.id),d=new FormData(form);
    const name=String(d.get('name')||'').trim(),placeName=String(d.get('placeName')||'').trim();
    const comment=String(d.get('comment')||'').trim();
    if(name.length<2||placeName.length<2)return toast('이름과 장소 이름은 2자 이상 입력해 주세요.');
    const latitude=String(d.get('lat')||'').trim(),longitude=String(d.get('lng')||'').trim();
    if(latitude&&longitude){draft.lat=Number(latitude);draft.lng=Number(longitude);savePlaceDraft(e.id);}
    if(!Number.isFinite(draft.lat)||!Number.isFinite(draft.lng)||Math.abs(draft.lat)>90||Math.abs(draft.lng)>180)
      return toast('지도에서 핀을 찍거나 올바른 위도와 경도를 입력해 주세요.');
    if(!draft.consent)return toast('이름과 추천 장소 공개에 동의해 주세요.');
    state.saving=true;
    try{
      await postApi('/api/places/propose',{eventId:e.id,id:randomId(),name,placeName,comment,lat:draft.lat,lng:draft.lng});
      draft.name=name;draft.placeName='';draft.comment='';draft.lat=null;draft.lng=null;
      savePlaceDraft(e.id);await refreshData(true);toast('장소가 추천 후보로 등록됐습니다.');
    }catch(error){toast(error.message||'장소를 등록하지 못했습니다.');}
    finally{state.saving=false;render();}
  }
  async function submitPlaceVote(form){
    if(state.saving)return;
    const e=getEvent(route().id),draft=getPlaceDraft(e.id),d=new FormData(form);
    const name=String(d.get('name')||'').trim(),proposalId=String(d.get('proposalId')||'');
    if(name.length<2||!proposalId)return toast('이름을 입력하고 장소 한 곳을 선택해 주세요.');
    if(!draft.consent)return toast('투표 이름 공개에 동의해 주세요.');
    if(!draft.voteToken)draft.voteToken=randomSecret();
    draft.name=name;draft.selected=proposalId;savePlaceDraft(e.id);
    state.saving=true;
    try{
      await postApi('/api/places/vote',{eventId:e.id,name,proposalId,token:draft.voteToken});
      await refreshData(true);toast('장소 투표가 저장되었습니다.');
    }catch(error){toast(error.message||'장소 투표를 저장하지 못했습니다.');}
    finally{state.saving=false;render();}
  }
  let currentMap=null,mapSeq=0;
  async function mountPlaceMap(event) {
    const el=document.getElementById('place-map');if(!el)return;
    const sequence=++mapSeq;
    const draft=getPlaceDraft(event.id);
    const stage=placeFor(event).stage;
    const provider=state.mapProvider;
    try {
      const handle=await window.SiteMaps.mount({element:el,provider,keys:CONFIG.maps||{},
        proposals:placeFor(event).proposals,picked:Number.isFinite(draft.lat)?{lat:draft.lat,lng:draft.lng}:null,
        onPick:({lat,lng})=>{
          if(stage!=='proposals'||sequence!==mapSeq)return;
          draft.lat=lat;draft.lng=lng;savePlaceDraft(event.id);
          const output=document.getElementById('picked-coordinates');
          if(output)output.textContent=`${lat.toFixed(5)}, ${lng.toFixed(5)} · 선택됨`;
          const latField=document.getElementById('place-lat'),lngField=document.getElementById('place-lng');
          if(latField)latField.value=String(lat);if(lngField)lngField.value=String(lng);
        }});
      if(sequence!==mapSeq){handle?.destroy?.();return;}
      currentMap=handle;
    }catch(error){
      if(sequence!==mapSeq)return;
      const status=document.getElementById('map-status');
      if(status)status.textContent=error.message+' 기본 지도를 선택할 수 있습니다.';
      el.textContent='지도 연결에 실패했습니다. 지도 선택을 기본 지도로 바꿔 주세요.';
    }
  }
  async function submitOpenExisting(form) {
    if(state.saving)return;
    const id=eventIdFromLink(new FormData(form).get('link'));
    if(!id)return toast('기존 모임의 초대 링크 또는 ID를 정확히 입력해 주세요.');
    const button=form.querySelector('[type=submit]');state.saving=true;button.disabled=true;
    try {
      // Check API compatibility first. Never call the old bulk /api/data endpoint;
      // in the legacy Worker it would run automatic record deletion.
      const service=await apiRequest('/');
      if(!Array.isArray(service.routes)||!service.routes.includes('/api/places/propose')) {
        throw new Error('서버(Worker)가 이전 버전입니다. 제공된 worker.js를 기존 Worker에 먼저 배포해야 합니다.');
      }
      const result=await apiRequest('/api/events/'+encodeURIComponent(id));
      if(!result.event || result.event.id!==id)throw new Error('입력한 ID와 일치하는 모임을 찾지 못했습니다.');
      rememberEvent(id);
      location.hash=`#event/${encodeURIComponent(id)}`;
      await refreshData(true);
      toast('기존 모임과 투표 기록을 불러왔습니다.');
    }catch(error){toast(error.message||'기존 모임을 열지 못했습니다.');}
    finally{state.saving=false;if(document.contains(button))button.disabled=false;}
  }
  async function submitRecovery(form) {
    if(state.saving)return;
    const d=new FormData(form);
    const title=String(d.get('title')||'').trim(),name=String(d.get('name')||'').trim();
    const dates=String(d.get('dates')||'').split(',').map(v=>v.trim()).filter(Boolean);
    if(!title||name.length<2||!dates.length||dates.some(date=>!isIsoDate(date))||new Set(dates).size!==dates.length)return toast('모임 이름, 투표 이름, 선택했던 모든 날짜를 YYYY-MM-DD로 입력하세요.');
    const button=form.querySelector('[type=submit]');state.saving=true;button.disabled=true;
    try {
      const result=await postApi('/api/recover',{title,name,dates});
      rememberEvent(result.eventId);
      location.hash=`#event/${encodeURIComponent(result.eventId)}`;
      await refreshData(true);
      toast('기존 투표 기록을 찾았습니다. 완료된 모임도 결과를 확인할 수 있습니다.');
    }catch(err){toast(err.message||'입력 정보와 일치하는 모임을 찾지 못했습니다.');}
    finally{state.saving=false;if(document.contains(button))button.disabled=false;}
  }
  function notFound() {
    if (state.error) return `<main id="main" class="shell"><div class="error-screen">${icon('alert')}<h2>모임이 삭제된 것으로 확인되지 않았습니다.</h2><p>서버 연결 또는 배포 버전 문제로 모임을 불러올 수 없습니다. 기존 Cloudflare D1을 백업하고 Worker 연결을 점검해 주세요.</p><div class="info-banner error" role="alert">${escapeHtml(state.error)}</div><button class="button dark" type="button" data-action="refresh">다시 조회 ${icon('arrow-right')}</button></div></main>`;
    return `<main id="main" class="shell"><div class="error-screen">${icon('alert')}<h2>해당 모임을 찾을 수 없어요.</h2><p>현재 연결된 데이터베이스에서 모임이 조회되지 않습니다. 링크 ID와 기존 D1 바인딩을 확인해 주세요.</p><a class="button dark" href="#home">내 모임으로 ${icon('arrow-right')}</a></div></main>`;
  }
  function render() {
    document.documentElement.dataset.theme=state.theme;
    const current=route();
    let main;
    if(state.loading)main=`<main id="main" class="shell"><div class="section skeleton" aria-label="일정 읽는 중"></div></main>`;
    else if(current.page==='home') {state.selectedEventId='';main=home();}
    else if(current.page==='edit') {const event=current.id?getEvent(current.id):null;main=current.id&&!event?notFound():editPage(event);}
    else {const event=getEvent(current.id);main=event?eventPage(event):notFound();}
    currentMap?.destroy?.();currentMap=null;mapSeq++;
    root.innerHTML=header()+main+footer();
    root.setAttribute('aria-busy',String(state.loading));
    const page=route();
    if(!state.loading && page.page==='edit')syncModeFields();
    if(!state.loading && page.page==='event' && getEvent(page.id)?.mode!=='date') {
      const event=getEvent(page.id);
      setTimeout(()=>{if(route().page==='event'&&route().id===event.id)mountPlaceMap(event);},0);
    }
  }
  function syncModeFields(){
    const mode=document.getElementById('ev-mode')?.value||'date';
    document.querySelectorAll('.only-dates').forEach(el=>el.hidden=mode==='place');
    document.querySelectorAll('.only-place').forEach(el=>el.hidden=mode==='date');
  }
  function updateDate(eventId,date,action) {
    const event=getEvent(eventId);if(!event || !eventIsOpen(event))return;
    if(!dateRange(event).includes(date)||date<todayKST())return;
    const draft=getDraft(eventId);
    if(action==='toggle') draft.dates=draft.dates.includes(date)?draft.dates.filter(d=>d!==date):[...draft.dates,date].sort();
    else draft.dates=draft.dates.filter(d=>d!==date);
    state.statusMessage='';saveDraft(eventId);render();
  }
  function safeUrl(url) { try{const u=new URL(url);return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
  async function shareEvent(id) {
    const event=getEvent(id),url=shareUrl(id);
    if (navigator.share) {try{await navigator.share({title:event.title,text:'가능한 날짜를 선택해 주세요!',url});return;}catch(error){if(error.name==='AbortError')return;}}
    try{await navigator.clipboard.writeText(url);toast('모임 링크를 복사했습니다.');}
    catch(_){toast(`주소창의 #event/ 링크를 복사해 공유해 주세요.`);}
  }
  async function persistResponse(event,draft) {
    if(!isLive)throw new Error('Cloudflare API 연결 전에는 저장할 수 없습니다.');
    await postApi('/api/responses',{
      id:draft.id,token:draft.token,eventId:event.id,name:draft.name,dates:draft.dates
    });
    state.data=await readFromApi();
    return true;
  }
  async function submitResponse() {
    if (state.saving || state.error || !isLive)return toast('Cloudflare API 연결이 확인되지 않아 저장할 수 없습니다.');
    const event=getEvent(route().id);if(!event || !eventIsOpen(event)){toast('참여할 수 없는 모임입니다.');return;}
    const draft=getDraft(event.id);
    const name=draft.name.trim().replace(/\s+/g,' ');
    if(name.length<2 || name.length>30 || /[<>\r\n\x00-\x1f]/.test(name) || /^[=+\-@]/.test(name)) {toast('이름을 2~30자로 올바르게 입력해 주세요.');$('#attendee-name')?.focus();return;}
    if(draft.dates.length===0){toast('참석 가능한 날짜를 한 개 이상 선택해 주세요.');return;}
    if(!draft.consent){toast('개인정보 수집·공개 안내에 동의해 주세요.');$('#consent')?.focus();return;}
    draft.name=name;
    if(!draft.id)draft.id=randomId();
    if(!draft.token)draft.token=randomSecret();
    saveDraft(event.id);
    state.saving=true;state.statusMessage='';render();
    try {
      await persistResponse(event,draft);
      state.statusMessage='Cloudflare D1에 응답이 저장되었습니다. 같은 브라우저에서 수정할 수 있습니다.';
      toast('응답 저장이 확인되었습니다!');
    } catch(error) {
      state.statusMessage='';toast(error.message||'저장하지 못했습니다. 연결 상태를 확인해 주세요.');
    } finally{state.saving=false;render();}
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action;
    const current=route();
    if(action==='theme') {state.theme=state.theme==='light'?'dark':'light';safeStore('theme',state.theme);render();return;}
    if(action==='menu') {state.menuOpen=!state.menuOpen;render();return;}
    if(action==='refresh') {refreshData(true);return;}
    if(action==='share'&&current.page==='event') {shareEvent(current.id);return;}
    if(action==='my-location') {
      if(!navigator.geolocation)return toast('이 브라우저는 위치 기능을 지원하지 않습니다.');
      navigator.geolocation.getCurrentPosition(p=>currentMap?.pan?.(p.coords.latitude,p.coords.longitude),
        ()=>toast('위치 권한을 허용해 주세요.'),{enableHighAccuracy:false,timeout:10000});return;
    }
    if(current.page!=='event')return;
    const ev=getEvent(current.id);if(!ev)return;
    if(action==='prev-month'||action==='next-month'){
      const month=monthShift(state.calendarMonth,action==='prev-month'?-1:1);
      if(month>=ev.startDate.slice(0,7)&&month<=ev.endDate.slice(0,7)){state.calendarMonth=month;render();}return;
    }
    if(action==='date') {updateDate(current.id,button.dataset.date,'toggle');return;}
    if(action==='remove-date'){updateDate(current.id,button.dataset.date,'remove');return;}
    if(action==='clear-dates'){getDraft(current.id).dates=[];saveDraft(current.id);state.statusMessage='';render();}
  });
  root.addEventListener('input',event=>{
    if(['place-person','place-voter','place-title','place-comment','place-lat','place-lng'].includes(event.target.id)){
      const e=getEvent(route().id);if(!e)return;
      const d=getPlaceDraft(e.id);
      if(event.target.id==='place-person'||event.target.id==='place-voter')d.name=event.target.value;
      if(event.target.id==='place-title')d.placeName=event.target.value;
      if(event.target.id==='place-comment')d.comment=event.target.value;
      if(event.target.id==='place-lat')d.lat=event.target.value===''?null:Number(event.target.value);
      if(event.target.id==='place-lng')d.lng=event.target.value===''?null:Number(event.target.value);
      savePlaceDraft(e.id);return;
    }

    if(event.target.id==='attendee-name'){
      const current=route();if(current.page!=='event')return;
      const draft=getDraft(current.id);draft.name=event.target.value;saveDraft(current.id);
    }
  });
  root.addEventListener('change',event=>{
    const t=event.target;
    if(t.id==='ev-mode'){syncModeFields();return;}
    if(t.id==='place-map-provider'){
      state.mapProvider=t.value;
      const e=getEvent(route().id);if(e)render();return;
    }
    if(t.id==='place-consent'||t.id==='vote-consent'){
      const e=getEvent(route().id);if(e){getPlaceDraft(e.id).consent=t.checked;savePlaceDraft(e.id);}return;
    }
    if(t.name==='proposalId'&&t.checked){const e=getEvent(route().id);if(e){getPlaceDraft(e.id).selected=t.value;savePlaceDraft(e.id);}return;}

    if(event.target.id==='consent'){
      const current=route();if(current.page!=='event')return;
      getDraft(current.id).consent=event.target.checked;saveDraft(current.id);
    }
  });
  root.addEventListener('submit',event=>{if(event.target.getAttribute('id')==='response-form'){event.preventDefault();submitResponse();}else if(event.target.getAttribute('id')==='event-form'){event.preventDefault();submitEvent(event.target);}else if(event.target.getAttribute('id')==='recover-form'){event.preventDefault();submitRecovery(event.target);}else if(event.target.getAttribute('id')==='open-existing-form'){event.preventDefault();submitOpenExisting(event.target);}else if(event.target.id==='place-proposal-form'){event.preventDefault();submitPlaceProposal(event.target);}else if(event.target.id==='place-vote-form'){event.preventDefault();submitPlaceVote(event.target);}});
  window.addEventListener('hashchange',()=>{
    state.menuOpen=false;state.statusMessage='';
    const r=route();if((r.page==='event'||(r.page==='edit'&&r.id))&&validEventId(r.id))refreshData(true);else render();
    if(location.hash==='#how'||location.hash==='#events'||location.hash==='#recover'||location.hash==='#open-existing'){
      document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'smooth'});
    }else window.scrollTo({top:0,behavior:'instant'});
  });
  // 홈페이지의 구역 링크는 홈 화면으로 이동 후 스크롤되도록 처리합니다.
  root.addEventListener('click',event=>{
    const link=event.target.closest('a[href="#how"],a[href="#events"]');
    if(!link)return;
    if(route().page!=='home') {event.preventDefault();location.hash='#home';setTimeout(()=>document.getElementById(link.getAttribute('href').slice(1))?.scrollIntoView({behavior:'smooth'}),50);}
  });
  document.documentElement.dataset.theme=state.theme;
  let lastKstDate=todayKST();
  setInterval(()=>{
    const date=todayKST();
    if(date!==lastKstDate){lastKstDate=date;refreshData(true);}
  },60000);
  refreshData();
})();
