(() => {
  'use strict';

  const CONFIG = window.APP_CONFIG;
  const STORAGE_PREFIX = 'year-end-together:v1';
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
    statusMessage: ''
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
  function eventIsOpen(event) { return event.status==='OPEN' && (!event.deadline || todayKST()<=event.deadline) && dateRange(event).some(d=>d>=todayKST()); }
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
    const b=crypto.getRandomValues(new Uint8Array(16));return [...b].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  function randomSecret() {return [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');}
  function pendingEventId() {
    const old=safeStore('pendingEventId');
    if(old && /^[a-f0-9-]{32,36}$/i.test(old))return old;
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

  function normalizeData(input) {
    if (!input || !input.ok || !Array.isArray(input.events) || !Array.isArray(input.responses)) throw new Error('서버에서 올바른 데이터를 받지 못했습니다.');
    const events=input.events.filter(e=>e && typeof e.id==='string' && isIsoDate(e.startDate) && isIsoDate(e.endDate)).map(e=>({
      id:e.id,title:String(e.title||'제목 없는 모임'),description:String(e.description||''),location:String(e.location||'장소 추후 공지'),
      startDate:e.startDate,endDate:e.endDate,deadline:isIsoDate(e.deadline)?e.deadline:'',
      status:e.status==='CLOSED'?'CLOSED':'OPEN',publicNames:e.publicNames===true,allowedDates:Array.isArray(e.allowedDates)?e.allowedDates.filter(isIsoDate):[]
    }));
    const ids=new Set(events.map(e=>e.id));
    const responses=input.responses.filter(r=>r && ids.has(r.eventId) && typeof r.id==='string' && Array.isArray(r.dates)).map(r=>({
      id:r.id,eventId:r.eventId,name:String(r.name||'비공개'),dates:r.dates.filter(isIsoDate),updatedAt:r.updatedAt||''
    }));
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
    return normalizeData(await apiRequest('/api/data'));
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
    return `<header class="site-header"><div class="shell header-inner"><a class="brand" href="#home" aria-label="모두의 연말 홈"><img src="./assets/favicon.svg" alt="" width="39" height="39"><span><span class="brand-name">모두의 연말</span><span class="brand-caption">TOGETHER, THIS YEAR</span></span></a><nav class="header-nav" aria-label="주 메뉴"><a href="#home">모임 목록</a><a href="#create">새 모임 만들기</a><a href="#how">참여 방법</a></nav><div class="header-actions"><button class="icon-btn" data-action="refresh" title="일정 새로고침" aria-label="일정 새로고침">${icon('refresh')}</button><button class="icon-btn" data-action="theme" title="화면 테마 변경" aria-label="${state.theme==='light'?'어두운 모드로 변경':'밝은 모드로 변경'}">${icon(state.theme==='light'?'moon':'sun')}</button><button class="icon-btn mobile-menu-btn" data-action="menu" aria-label="메뉴 열기" aria-expanded="${state.menuOpen}">${icon('menu')}</button></div></div><nav class="mobile-nav ${state.menuOpen?'open':''}" aria-label="모바일 메뉴"><a href="#home">모임 목록</a><a href="#create">새 모임 만들기</a><a href="#how">참여 방법</a></nav></header>`;
  }
  function footer() {return `<footer class="site-footer"><div class="shell footer-inner"><div class="footer-brand">✳ 모두의 연말 <small>모두에게 좋은 날짜를 찾는 가장 쉬운 방법.</small></div><div class="footer-links"><a href="#home">모임 목록</a><a href="#create">새 모임 만들기</a><a href="#how">참여 방법</a></div></div></footer>`;}
  function banner() {
    if (state.error) return `<div class="info-banner error" role="alert">${icon('alert')}<span><strong>연결 오류</strong> — ${escapeHtml(state.error)} 이전 응답이 있다면 표시하지만, 새 제출은 연결 복구 후 가능합니다. <button class="link-button" data-action="refresh">다시 시도</button></span></div>`;
    if (!isLive) return `<div class="info-banner" role="status">${icon('info')}<span><strong>Cloudflare D1 연결 전입니다.</strong> 저장 기능을 사용할 수 없습니다. <code>config.js</code>에 Cloudflare Worker API 주소를 입력하세요.</span></div>`;
    return '';
  }
  function statsMarkup() {
    const active=state.data.events.filter(eventIsOpen).length;
    const all=state.data.responses.length;
    const count=new Map();state.data.responses.forEach(r=>r.dates.forEach(d=>count.set(d,(count.get(d)||0)+1)));
    const best=[...count.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
    return `<div class="stats"><div class="stat"><div class="stat-top">${icon('calendar')} 진행 중인 모임</div><div class="stat-value">${active}<small style="font-size:15px"> 개</small></div><div class="stat-note">참여할 수 있는 일정</div></div><div class="stat"><div class="stat-top">${icon('users')} 전체 응답</div><div class="stat-value">${all}<small style="font-size:15px"> 명</small></div><div class="stat-note">모임별 참여 기록 합계</div></div><div class="stat"><div class="stat-top">${icon('sparkle')} 인기 날짜</div><div class="stat-value">${best?escapeHtml(formatDate(best[0],{month:'numeric',day:'numeric'})):'—'}</div><div class="stat-note">${best?`${best[1]}명이 선택한 날짜`:'첫 응답을 기다리고 있어요'}</div></div></div>`;
  }
  function eventCard(event) {
    const count=responsesFor(event.id).length;
    const open=eventIsOpen(event);
    return `<a class="event-card" href="#event/${encodeURIComponent(event.id)}" aria-label="${escapeHtml(event.title)} 일정 선택하기"><div class="event-card-top"><span class="event-badge ${open?'':'closed'}"><i class="live"></i>${open?'일정 조율 중':'참여 마감'}</span><span class="kicker">${escapeHtml(event.startDate.slice(0,4))} YEAR-END</span></div><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.description)}</p><div class="subinfo"><span>${icon('calendar')} ${escapeHtml(formatDate(event.startDate,{month:'numeric',day:'numeric'}))} ~ ${escapeHtml(formatDate(event.endDate,{month:'numeric',day:'numeric'}))}</span><span>${icon('users')} ${count}명 참여</span></div><div class="event-card-bottom"><span>${escapeHtml(event.location)}</span><strong>날짜 선택하기 ${icon('arrow-right')}</strong></div></a>`;
  }
  function home() {
    return `<main id="main" class="shell"><section class="hero" aria-labelledby="hero-title"><div class="hero-content"><div class="eyebrow"><span class="dot"></span> MAKE TIME TOGETHER</div><h1 id="hero-title">모두가 되는 날,<br><em>함께하는 연말.</em></h1><p>복잡한 단체 채팅 대신, 달력에서 가능한 날짜만 콕.<br>모두의 일정을 모아 가장 좋은 날을 찾아보세요.</p><div class="hero-actions"><a class="button primary" href="#events">모임 일정 확인 ${icon('arrow-right')}</a><a class="button ghost" href="#create">${icon('plus')} 새 모임 만들기</a><a class="button ghost" href="#how">참여 방법 알아보기</a></div></div>${artCalendar()}</section>${banner()}${statsMarkup()}<section id="events" class="section"><div class="section-top"><div><span class="kicker">UPCOMING GATHERINGS</span><h2>우리의 모임 일정</h2><p>모임을 선택하고 가능한 날짜를 알려주세요.</p></div><span class="section-aside">전체 ${state.data.events.length}개</span></div>${state.data.events.length?`<div class="event-list">${state.data.events.map(eventCard).join('')}</div>`:`<div class="event-empty">${icon('calendar')}<h3>등록된 모임이 없어요</h3><p>첫 모임을 만들어 날짜를 조율해 보세요.</p><a href="#create" class="button dark">새 모임 만들기</a></div>`}</section><section id="how" class="how-section"><div class="section-top"><div><span class="kicker">HOW IT WORKS</span><h2>참여 방법은 간단해요</h2></div></div><div class="steps"><div class="step"><span class="step-num">01</span><div><h3>모임 선택하기</h3><p>참여하고 싶은 모임을 누르고 상세 일정을 확인해요.</p></div></div><div class="step"><span class="step-num">02</span><div><h3>가능한 날짜 고르기</h3><p>달력에서 가능한 날짜를 여러 개 선택하고 이름을 적어요.</p></div></div><div class="step"><span class="step-num">03</span><div><h3>함께할 날 확인하기</h3><p>응답이 모이면 어느 날짜에 가장 많이 모일 수 있는지 확인해요.</p></div></div></div></section></main>`;
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
    return `<aside class="panel form-panel sticky" aria-label="참석 응답 등록"><div class="panel-label"><div><h2>참석 가능 날짜 제출</h2><p>이름과 선택한 날짜를 확인해 주세요.</p></div><div class="tiny-icon">${icon('check')}</div></div><form id="response-form" novalidate><label class="input-label" for="attendee-name">이름 <span style="color:var(--coral)">*</span></label><input id="attendee-name" class="input-field" name="name" autocomplete="name" maxlength="30" placeholder="예: 김민수" value="${escapeHtml(draft.name)}" ${!open?'disabled':''} required><p class="form-hint">다른 참석자가 알아볼 수 있는 이름으로 적어주세요.</p><div class="summary-preview"><div class="summary-top">내가 참석할 수 있는 날짜</div><strong>${count}<span style="font-size:14px"> 일</span></strong><div class="summary-bottom">${count?escapeHtml([...draft.dates].sort().map(d=>formatDate(d,{month:'numeric',day:'numeric'})).join(' · ')):'아직 날짜를 선택하지 않았어요.'}</div></div><label class="checkbox-line"><input type="checkbox" id="consent" ${draft.consent?'checked':''} ${!open?'disabled':''}> <span>이름과 선택 날짜가 모임 일정 조율을 위해 저장되고, 공개 설정된 모임에서는 다른 참여자에게 표시되는 데 동의합니다.</span></label><button class="button dark full" type="submit" ${!open||!!state.error||state.saving?'disabled':''}>${state.saving?`<span class="spinner"></span> D1 저장 중…`:`${draft.id?'내 응답 수정하기':'가능한 날짜 제출하기'} ${icon('arrow-right')}`}</button>${!open?`<p class="form-error">이 모임은 응답 기간이 끝났습니다.</p>`:''}${state.error?'<p class="form-error">연결 상태를 확인한 뒤 제출할 수 있습니다.</p>':''}${state.statusMessage?`<div class="form-success" role="status">${escapeHtml(state.statusMessage)}</div>`:''}<p class="privacy-note">${isLive?'제출 후 Cloudflare D1에 저장됩니다.':'서버 연결 전에는 저장할 수 없습니다.'}<br>이 브라우저에서는 이전 응답을 다시 수정할 수 있어요.</p></form></aside>`;
  }
  function resultMarkup(event) {
    const responses=responsesFor(event.id),counts=countsFor(event.id);
    const sorted=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    const top=sorted.slice(0,6);
    const max=top.length?top[0][1]:1;
    return `<section id="results" class="result-section"><div class="section-top"><div><span class="kicker">AVAILABILITY OVERVIEW</span><h2>모두의 선택 현황</h2><p>선택이 많은 날짜부터 한눈에 확인하세요.</p></div><span class="section-aside">${responses.length}명 응답</span></div><div class="results-grid"><div class="panel results-panel"><div class="result-header"><h3>가능한 날짜 TOP 6</h3><span>중복 선택 가능</span></div>${top.length?top.map(([date,num])=>`<div class="result-row"><span class="result-date">${escapeHtml(formatDate(date,{month:'numeric',day:'numeric',weekday:'short'}))}</span><span class="result-track"><span style="width:${(num/max)*100}%"></span></span><span class="result-count">${num}명</span></div>`).join(''):`<div class="empty-mini">${icon('calendar')}아직 선택된 날짜가 없어요. 첫 번째 응답을 남겨주세요!</div>`}</div><div class="panel results-panel"><div class="result-header"><h3>참여자 <span style="font-weight:500;color:var(--muted)">${responses.length}명</span></h3><span>최근 응답 순</span></div>${responses.length?`<div class="participant-list">${[...responses].reverse().slice(0,20).map(r=>`<div class="person"><div class="person-info"><div class="avatar">${escapeHtml((r.name||'•').slice(0,1))}</div><strong>${escapeHtml(r.name)}</strong></div><span>${r.dates.length}일 선택</span></div>`).join('')}</div>${responses.length>20?`<p class="helper-text">최근 20명만 표시합니다. 전체 기록은 스프레드시트에서 확인하세요.</p>`:''}`:`<div class="empty-mini">${icon('users')}아직 참여한 사람이 없습니다.</div>`}</div></div></section>`;
  }
  function eventPage(event) {
    const draft=getDraft(event.id);
    const allowed=new Set(dateRange(event));
    draft.dates=draft.dates.filter(d=>allowed.has(d));
    if (state.selectedEventId!==event.id) {
      state.selectedEventId=event.id;
      const months=Array.from(allowed).sort();
      const initial=months.find(d=>d>=todayKST())||months[0]||event.startDate;
      state.calendarMonth=initial.slice(0,7);
      state.statusMessage='';
    }
    return `<main id="main" class="shell"><nav class="breadcrumb" aria-label="이동 경로"><a href="#home">모임 목록</a>${icon('chevron-right')} <span>${escapeHtml(event.title)}</span></nav>${banner()}<div class="detail-head"><div class="detail-title"><div><span class="event-badge ${eventIsOpen(event)?'':'closed'}"><i class="live"></i>${eventIsOpen(event)?'일정 조율 중':'참여 마감'}</span><h1>${escapeHtml(event.title)}</h1><p>${escapeHtml(event.description)}</p></div><div class="detail-admin-actions"><a class="button ghost small" href="#manage/${encodeURIComponent(event.id)}">${icon('calendar')} 모임 관리</a><button type="button" class="button ghost small" data-action="share">${icon('share')} 모임 공유</button></div></div><div class="meta-chips"><span class="meta-chip">${icon('calendar')} ${escapeHtml(formatDate(event.startDate,{year:'numeric',month:'numeric',day:'numeric'}))} ~ ${escapeHtml(formatDate(event.endDate,{month:'numeric',day:'numeric'}))}</span><span class="meta-chip">${icon('pin')} ${escapeHtml(event.location)}</span>${event.deadline?`<span class="meta-chip">${icon('clock')} 응답 마감 ${escapeHtml(formatDate(event.deadline,{month:'numeric',day:'numeric'}))}</span>`:''}</div></div><div class="detail-grid">${calendarMarkup(event,draft)}${formMarkup(event,draft)}</div>${resultMarkup(event)}<div class="backline"><a href="#home" class="button outline">${icon('arrow-left')} 다른 모임 보기</a></div></main>`;
  }
  function editPage(event) {
    const edit=Boolean(event);
    const e=event||{title:'',description:'',location:'',startDate:'2026-12-01',endDate:'2026-12-31',deadline:'2026-12-20',publicNames:false,status:'OPEN',allowedDates:[]};
    const dates=(e.allowedDates||[]).join(', ');
    return `<main id="main" class="shell"><nav class="breadcrumb"><a href="#home">모임 목록</a>${icon('chevron-right')}<span>${edit?'모임 관리':'새 모임 만들기'}</span></nav>${banner()}<section class="edit-wrap"><div class="edit-intro"><span class="kicker">PLAN YOUR GATHERING</span><h1>${edit?'모임 정보 관리':'새 모임 만들기'}</h1><p>일정과 장소를 등록하면 모임별 링크가 만들어지고 참여자들의 가능한 날짜를 모을 수 있습니다.</p></div><div class="panel edit-panel"><form id="event-form" novalidate><input type="hidden" name="id" value="${escapeHtml(e.id||pendingEventId())}"><input type="hidden" name="operation" value="${edit?'update':'create'}"><div class="edit-form-grid"><div class="field wide"><label for="ev-title">모임 이름 *</label><input id="ev-title" name="title" class="input-field" placeholder="예: 우리 동호회 연말 모임" maxlength="80" required value="${escapeHtml(e.title)}"></div><div class="field wide"><label for="ev-description">모임 안내</label><textarea id="ev-description" name="description" class="input-field edit-textarea" maxlength="800" placeholder="장소와 준비할 내용을 적어주세요.">${escapeHtml(e.description)}</textarea></div><div class="field wide"><label for="ev-location">장소</label><input id="ev-location" name="location" class="input-field" placeholder="예: 서울 강남, 장소 추후 결정" maxlength="120" value="${escapeHtml(e.location)}"></div><div class="field"><label for="ev-start">시작 날짜 *</label><input id="ev-start" name="startDate" class="input-field" type="date" required value="${escapeHtml(e.startDate)}"></div><div class="field"><label for="ev-end">마지막 날짜 *</label><input id="ev-end" name="endDate" class="input-field" type="date" required value="${escapeHtml(e.endDate)}"></div><div class="field"><label for="ev-deadline">응답 마감</label><input id="ev-deadline" name="deadline" class="input-field" type="date" value="${escapeHtml(e.deadline)}"></div><div class="field"><label for="ev-status">모임 상태</label><select id="ev-status" name="status" class="input-field"><option value="OPEN" ${e.status==='OPEN'?'selected':''}>응답 받는 중</option><option value="CLOSED" ${e.status==='CLOSED'?'selected':''}>모임 마감</option></select></div><div class="field wide"><label for="ev-allowed">가능한 후보 날짜 (선택)</label><input id="ev-allowed" name="allowedDates" class="input-field" placeholder="예: 2026-12-12, 2026-12-19 (빈칸이면 기간 내 전체)" value="${escapeHtml(dates)}"><p class="form-hint">콤마(,)로 구분합니다. 비워 두면 시작일~마지막 날짜 모두 선택 가능합니다.</p></div><div class="field wide"><label class="checkbox-line"><input name="publicNames" type="checkbox" value="true" ${e.publicNames?'checked':''}><span>참여자 이름을 모임 페이지와 공개 조회 데이터에 표시합니다. (선택하지 않으면 비공개)</span></label></div><div class="field wide"><label for="ev-admin-key">${edit?'모임 관리 비밀번호':'모임 관리 비밀번호 설정'} *</label><input id="ev-admin-key" class="input-field" type="password" name="password" required autocomplete="new-password" minlength="8" maxlength="128" placeholder="8자 이상 입력"><p class="form-hint">모임 생성자만 알고 있는 비밀번호입니다. 서버에는 해시값으로만 저장되며 공개되지 않습니다. 분실하면 복구할 수 없습니다.</p></div>${!edit?`<div class="field wide"><label for="ev-admin-confirm">관리 비밀번호 확인 *</label><input id="ev-admin-confirm" class="input-field" name="passwordConfirm" type="password" minlength="8" maxlength="128" required autocomplete="new-password" placeholder="관리 비밀번호를 한 번 더 입력"></div>`:''}</div><div class="edit-bottom"><div class="edit-warning">${isLive?'저장하면 Cloudflare D1에 반영되고 모든 기기에서 동일하게 보입니다.':'Cloudflare API 미연결: 모임을 저장할 수 없습니다.'}</div><button type="submit" class="button dark" id="event-save-button" ${!isLive||!!state.error?'disabled':''}>${edit?'모임 정보 저장하기':'모임 만들고 링크 받기'} ${icon('arrow-right')}</button></div></form></div><div class="edit-help"><h2>안전한 모임 관리</h2><p>모임은 Cloudflare D1에 저장됩니다. 관리 비밀번호는 생성자만 알고 있어야 하며 공개 데이터에는 표시되지 않습니다. 모임이 끝난 뒤 30일이 지나면 기록이 정리됩니다.</p></div></section></main>`;
  }

  async function persistEvent(info) {
    if(!isLive)throw new Error('Cloudflare API 연결 전에는 등록할 수 없습니다.');
    await postApi('/api/events',info);
    state.data=await readFromApi();
    return true;
  }
  async function submitEvent(form){
    if(state.saving)return;
    const button=form.querySelector('[type=submit]');
    const d=new FormData(form);
    const info={operation:String(d.get('operation')),id:String(d.get('id')),title:String(d.get('title')||'').trim(),description:String(d.get('description')||'').trim(),location:String(d.get('location')||'').trim(),startDate:String(d.get('startDate')||''),endDate:String(d.get('endDate')||''),deadline:String(d.get('deadline')||''),status:String(d.get('status')||'OPEN'),publicNames:d.get('publicNames')==='true',password:String(d.get('password')||''),passwordConfirm:String(d.get('passwordConfirm')||''),allowedDates:String(d.get('allowedDates')||'').split(',').map(v=>v.trim()).filter(Boolean)};
    if(!info.title || info.title.length>80 || !info.startDate || !info.endDate || info.endDate<info.startDate || !isIsoDate(info.startDate) || !isIsoDate(info.endDate))return toast('모임명과 시작·마지막 날짜를 확인해 주세요.');
    if((new Date(info.endDate)-new Date(info.startDate))/86400000 >=120)return toast('모임 날짜 범위는 최대 120일입니다.');
    if(info.deadline&&!isIsoDate(info.deadline))return toast('마감 날짜가 올바르지 않습니다.');
    if(info.allowedDates.some(d=>!isIsoDate(d)||d<info.startDate||d>info.endDate)||new Set(info.allowedDates).size!==info.allowedDates.length)return toast('후보 날짜를 YYYY-MM-DD 형식으로 중복 없이 입력해 주세요.');
    if(!isLive||state.error)return toast('Cloudflare API 연결이 확인되지 않아 저장할 수 없습니다.');
    if(info.password.length<8||info.password.length>128)return toast('모임 관리 비밀번호는 8~128자로 입력해 주세요.');
    if(info.operation==='create'&&info.password!==info.passwordConfirm)return toast('관리 비밀번호 확인 입력이 일치하지 않습니다.');
    state.saving=true;button.disabled=true;button.textContent='저장 확인 중…';
    try{
      await persistEvent(info);
      safeStore('pendingEventId','');
      toast('Cloudflare D1에 모임이 저장되었습니다. 다른 브라우저에서도 볼 수 있습니다.');
      location.hash=`#event/${encodeURIComponent(info.id)}`;
      render();
    }catch(err){toast(err.message||'모임 저장에 실패했습니다.');}
    finally{state.saving=false;button.disabled=false;if(document.contains(button))button.textContent=info.operation==='create'?'모임 만들고 링크 받기':'모임 정보 저장하기';}
  }

  function notFound() {return `<main id="main" class="shell"><div class="error-screen">${icon('alert')}<h2>해당 모임을 찾을 수 없어요.</h2><p>링크가 변경되었거나 모임이 삭제되었을 수 있습니다.</p><a class="button dark" href="#home">모임 목록 보기 ${icon('arrow-right')}</a></div></main>`;}
  function render() {
    document.documentElement.dataset.theme=state.theme;
    const current=route();
    let main;
    if(state.loading)main=`<main id="main" class="shell"><div class="section skeleton" aria-label="일정 읽는 중"></div></main>`;
    else if(current.page==='home') {state.selectedEventId='';main=home();}
    else if(current.page==='edit') {const event=current.id?getEvent(current.id):null;main=current.id&&!event?notFound():editPage(event);}
    else {const event=getEvent(current.id);main=event?eventPage(event):notFound();}
    root.innerHTML=header()+main+footer();
    root.setAttribute('aria-busy',String(state.loading));
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
    if(event.target.id==='attendee-name'){
      const current=route();if(current.page!=='event')return;
      const draft=getDraft(current.id);draft.name=event.target.value;saveDraft(current.id);
    }
  });
  root.addEventListener('change',event=>{
    if(event.target.id==='consent'){
      const current=route();if(current.page!=='event')return;
      getDraft(current.id).consent=event.target.checked;saveDraft(current.id);
    }
  });
  root.addEventListener('submit',event=>{if(event.target.getAttribute('id')==='response-form'){event.preventDefault();submitResponse();}else if(event.target.getAttribute('id')==='event-form'){event.preventDefault();submitEvent(event.target);}});
  window.addEventListener('hashchange',()=>{
    state.menuOpen=false;state.statusMessage='';render();
    if(location.hash==='#how'||location.hash==='#events'){
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
  refreshData();
})();
