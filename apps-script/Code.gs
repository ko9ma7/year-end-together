/**
 * 모두의 연말 - Google Sheets 바인딩 Apps Script.
 * 최초 설정은 편집 가능한 원본 스프레드시트의 [확장 프로그램 > Apps Script]에서 진행하세요.
 * setupSheets()가 원본 ID를 Script Properties에 저장하고, 웹 앱은 openById()로 접근합니다.
 * 게시용 /pubhtml URL은 여기서 열거나 쓰기 권한을 부여할 수 없습니다.
 *
 * 배포: 웹 앱 / 실행 사용자: 나 / 액세스 권한: 모든 사용자(Anyone).
 * 모임별 관리 비밀번호는 Script Properties에 salt + SHA-256 해시로만 저장합니다.
 * 공개 시트, GitHub 코드, 조회 응답에는 비밀번호/해시가 포함되지 않습니다.
 * 공개 이름 노출 여부는 EVENTS 탭 PUBLIC_NAMES에서 결정합니다.
 */
const SETTINGS = Object.freeze({
  eventsTab: 'EVENTS',
  responsesTab: 'RESPONSES',
  timezone: 'Asia/Seoul',
  maxResponses: 6000,
  maxAllowedDays: 120,
  maxSelectedDates: 120
});

const EVENT_HEADERS = [
  'ID','TITLE','DESCRIPTION','LOCATION','START_DATE','END_DATE',
  'DEADLINE','STATUS','PUBLIC_NAMES','ALLOWED_DATES'
];
const RESPONSE_HEADERS = [
  'ID','EVENT_ID','NAME','DATES_JSON','CREATED_AT','UPDATED_AT','TOKEN_HASH','STATUS'
];

/** Google 실행 환경이 정상인지 확인하는 간단한 테스트입니다. */
function testEnvironment() {
  console.log('Apps Script 기본 실행 정상: ' + new Date().toISOString());
  return 'OK';
}

/**
 * 웹 앱으로 실행될 때는 활성 시트를 얻지 못할 수 있으므로,
 * 설정 시 저장한 원본 스프레드시트 ID로만 열어 같은 파일을 읽고 씁니다.
 */
function getBook_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('원본 스프레드시트 설정이 없습니다. 원본 시트의 Apps Script 편집기에서 setupSheets()를 먼저 실행하세요.');
  return SpreadsheetApp.openById(id);
}

/** 연결된 원본 파일을 확인하기 위한 진단 함수(편집기에서만 실행). */
function testSpreadsheetConnection() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  console.log('편집기에 연결된 스프레드시트: ' + (active ? active.getName() : '없음'));
  const stored = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  console.log('등록된 시트 ID: ' + (stored ? '등록됨' : '미등록'));
  if (!active && !stored) throw new Error('스프레드시트에서 [확장 프로그램 > Apps Script]로 프로젝트를 열어 주세요.');
  const book = stored ? getBook_() : active;
  console.log('접속한 스프레드시트 이름: ' + book.getName());
  return book.getName();
}

/** 최초 한 번, 원본 스프레드시트에서 연 Apps Script 편집기에서 직접 실행합니다. */
function setupSheets() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('이 프로젝트가 원본 스프레드시트에 연결되어 있지 않습니다. 원본 스프레드시트 > 확장 프로그램 > Apps Script에서 열어 실행해 주세요.');
  const events = ensureSheet_(book, SETTINGS.eventsTab, EVENT_HEADERS);
  const responses = ensureSheet_(book, SETTINGS.responsesTab, RESPONSE_HEADERS);

  // 빈 시트부터 시작하며 샘플 모임/공용 관리자 키를 만들지 않습니다.
  events.setFrozenRows(1);
  responses.setFrozenRows(1);
  events.autoResizeColumns(1,EVENT_HEADERS.length);
  responses.autoResizeColumns(1,RESPONSE_HEADERS.length);
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', book.getId());
  console.log('원본 시트 연결 완료: ' + book.getName());
  return 'EVENTS / RESPONSES 탭 준비 및 시트 ID 등록 완료. 웹의 새 모임 만들기에서 모임마다 관리 비밀번호를 설정하세요.';
}

function ensureSheet_(book,name,headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  if (!sheet.getLastRow()) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#dcebb5').setFontColor('#17382f');
  } else {
    const actual=sheet.getRange(1,1,1,headers.length).getDisplayValues()[0];
    if (actual.join('|') !== headers.join('|')) {
      throw new Error(`${name} 탭의 1행 헤더가 예상한 구조와 다릅니다. 다른 탭의 데이터는 수정하지 않았습니다.`);
    }
  }
  return sheet;
}

function nowIso_() { return new Date().toISOString(); }
function today_() { return Utilities.formatDate(new Date(),SETTINGS.timezone,'yyyy-MM-dd'); }
function formatIso_(input) {
  if (input instanceof Date && !isNaN(input.getTime())) return Utilities.formatDate(input,SETTINGS.timezone,'yyyy-MM-dd');
  const text=String(input==null?'':input).trim();
  const match=text.match(/^(\d{4})[-/. ]\s*(\d{1,2})[-/. ]\s*(\d{1,2})\.?$/);
  if (!match) return text;
  return `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
}
function isoValid_(input) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input||'')) return false;
  const d=new Date(`${input}T00:00:00.000Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0,10)===input;
}
function daysBetween_(a,b) {
  return Math.floor((new Date(`${b}T00:00:00Z`).getTime()-new Date(`${a}T00:00:00Z`).getTime())/86400000);
}
function parseDateList_(text) {
  if (!String(text||'').trim()) return [];
  return String(text).split(',').map(date=>formatIso_(date)).filter(Boolean);
}
function readEvents_() {
  const book=getBook_();
  const sheet=book.getSheetByName(SETTINGS.eventsTab);
  if (!sheet) throw new Error('EVENTS 탭이 없습니다. 먼저 setupSheets()를 실행해 주세요.');
  const count=Math.max(sheet.getLastRow()-1,0);
  if (!count) return [];
  const rows=sheet.getRange(2,1,count,EVENT_HEADERS.length).getValues();
  return rows.map(row=>{
    const [id,title,description,location,start,end,deadline,status,publicNames,allowedDates]=row;
    return {
      id:String(id||'').trim(),title:String(title||'').trim(),
      description:String(description||'').trim(),location:String(location||'장소 추후 공지').trim(),
      startDate:formatIso_(start),endDate:formatIso_(end),deadline:deadline?formatIso_(deadline):'',
      status:String(status||'OPEN').trim().toUpperCase()==='CLOSED'?'CLOSED':'OPEN',
      publicNames:publicNames===true||String(publicNames).trim().toUpperCase()==='TRUE',
      allowedDates:parseDateList_(allowedDates)
    };
  }).filter(event=>event.id && event.status!=='DELETED' && isoValid_(event.startDate) && isoValid_(event.endDate) && event.endDate>=event.startDate && daysBetween_(event.startDate,event.endDate)<SETTINGS.maxAllowedDays);
}
function readResponses_(events) {
  const sheet=getBook_().getSheetByName(SETTINGS.responsesTab);
  if(!sheet)throw new Error('RESPONSES 탭이 없습니다. setupSheets()를 실행해 주세요.');
  const count=Math.min(Math.max(0,sheet.getLastRow()-1),SETTINGS.maxResponses);
  if(!count)return [];
  const eventMap={}; events.forEach(event=>{eventMap[event.id]=event;});
  const rows=sheet.getRange(2,1,count,RESPONSE_HEADERS.length).getValues();
  return rows.map(row=>{
    const [id,eventId,name,datesJson,createdAt,updatedAt,unusedHash,status]=row;
    const event=eventMap[String(eventId)];
    if(!event || String(status||'ACTIVE').toUpperCase()==='DELETED') return null;
    let dates;try{dates=JSON.parse(String(datesJson||'[]'));}catch(_){dates=[];}
    if(!Array.isArray(dates)) dates=[];
    return {id:String(id),eventId:String(eventId),name:event.publicNames?String(name):'비공개',dates:dates.filter(isoValid_),updatedAt:updatedAt instanceof Date?updatedAt.toISOString():String(updatedAt||'')};
  }).filter(Boolean);
}
function readPayload_() {
  const events=readEvents_();return {ok:true,events,responses:readResponses_(events),serverTime:nowIso_()};
}
function output_(data,callback) {
  // JSONP는 교차 출처 공개 조회를 지원하지만, 토큰/개인정보 비공개 보관에는 적합하지 않습니다.
  let body=JSON.stringify(data).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029').replace(/</g,'\\u003c');
  if(callback){
    if(!/^[_$A-Za-z][_$A-Za-z0-9]{0,70}$/.test(callback))return ContentService.createTextOutput('/* invalid callback */').setMimeType(ContentService.MimeType.JAVASCRIPT);
    return ContentService.createTextOutput(callback+'('+body+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  const p=e&&e.parameter?e.parameter:{};
  try {
    if(p.action==='read')return output_(readPayload_(),p.callback);
    if(p.action==='receipt')return output_(getReceipt_(p.requestId),p.callback);
    return output_({ok:false,error:'지원하지 않는 요청입니다. Apps Script Code.gs 버전을 확인하세요.'},p.callback);
  }catch(error){console.error(error);return output_({ok:false,error:'시트를 읽지 못했습니다. Apps Script 실행 로그와 배포 버전을 확인해 주세요.'},p.callback);}
}
function receiptKey_(id) {
  if(!/^[0-9a-f]{64}$/i.test(String(id||'')))throw new Error('요청 ID 형식이 잘못되었습니다.');
  return 'write_'+id;
}
function getReceipt_(id) {
  const raw=CacheService.getScriptCache().get(receiptKey_(id));
  return raw?JSON.parse(raw):{done:false};
}
function putReceipt_(id,result) {
  if(/^[0-9a-f]{64}$/i.test(String(id||''))) {
    CacheService.getScriptCache().put(receiptKey_(id),JSON.stringify({done:true,ok:result.ok===true,error:result.error||''}),360);
  }
}
function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8)
    .map(byte=>(byte+256)%256).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function textSafeName_(value) {
  const name=String(value||'').trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>30||/[<>\u0000-\u001f]/.test(name)||/^[=+\-@]/.test(name))throw new Error('이름이 올바르지 않습니다.');
  return name;
}
function datesSafe_(text,event) {
  if(String(text||'').length>3000)throw new Error('날짜 데이터가 너무 깁니다.');
  let dates;try{dates=JSON.parse(String(text));}catch(_){throw new Error('날짜 JSON이 올바르지 않습니다.');}
  if(!Array.isArray(dates)||dates.length<1||dates.length>SETTINGS.maxSelectedDates||dates.length!==new Set(dates).size)throw new Error('한 개 이상의 중복 없는 날짜가 필요합니다.');
  const allowed=new Set(event.allowedDates);
  for(const date of dates){
    if(typeof date!=='string'||!isoValid_(date)||date<event.startDate||date>event.endDate||date<today_()||(allowed.size>0&&!allowed.has(date)))throw new Error('모임에서 선택할 수 없는 날짜입니다.');
  }
  return dates.sort();
}
function saveResponse_(parameters) {
  if(String(parameters.hp||''))throw new Error('자동 입력은 허용되지 않습니다.');
  const id=String(parameters.id||'').trim(),token=String(parameters.token||'').trim(),eventId=String(parameters.eventId||'').trim();
  if(!/^[a-f0-9-]{32,40}$/i.test(id)||!/^[a-f0-9]{64}$/i.test(token)||!eventId||eventId.length>90)throw new Error('응답 식별자가 올바르지 않습니다.');
  const name=textSafeName_(parameters.name);
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('현재 저장 요청이 많습니다. 다시 시도해 주세요.');
  try{
    const events=readEvents_();
    const event=events.find(item=>item.id===eventId);
    if(!event)throw new Error('모임을 찾을 수 없습니다.');
    if(event.status!=='OPEN'||(event.deadline&&today_()>event.deadline))throw new Error('응답 마감된 모임입니다.');
    const dates=datesSafe_(parameters.dates,event);
    const sheet=getBook_().getSheetByName(SETTINGS.responsesTab);
    if(!sheet)throw new Error('RESPONSES 탭이 없습니다.');
    const tokenHash=sha256_(token),now=nowIso_();
    const last=sheet.getLastRow();
    if(last>1){
      const records=sheet.getRange(2,1,last-1,RESPONSE_HEADERS.length).getValues();
      const index=records.findIndex(row=>String(row[0])===id);
      if(index>=0){
        const old=records[index];
        if(String(old[1])!==eventId || String(old[6])!==tokenHash || String(old[7]).toUpperCase()==='DELETED')throw new Error('기존 기록을 수정할 권한이 없습니다.');
        sheet.getRange(index+2,3,1,4).setValues([[name,JSON.stringify(dates),old[4],now]]);
        return {ok:true,id,updated:true};
      }
    }
    if(last-1>=SETTINGS.maxResponses)throw new Error('현재 저장 가능한 응답 한도에 도달했습니다.');
    sheet.getRange(last+1,1,1,RESPONSE_HEADERS.length).setNumberFormat('@').setValues([[
      id,eventId,name,JSON.stringify(dates),now,now,tokenHash,'ACTIVE'
    ]]);
    return {ok:true,id,created:true};
  }finally{lock.releaseLock();}
}
/** 모임마다 별도 관리 비밀번호를 검증합니다. 비밀번호는 원본 시트에도 저장하지 않습니다. */
function eventPasswordKey_(eventId) { return 'EVENT_PASSWORD_'+eventId; }
function assertPassword_(value) {
  const password=String(value||'');
  if(password.length<8 || password.length>128 || /[\u0000-\u001f]/.test(password)) {
    throw new Error('모임 관리 비밀번호를 8~128자로 입력해 주세요.');
  }
  return password;
}
function salt_() {return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');}
function eventPasswordHash_(salt,password) { return sha256_('year-end:v3:'+salt+':'+password); }
function verifyEventPassword_(eventId,password) {
  const stored=PropertiesService.getScriptProperties().getProperty(eventPasswordKey_(eventId));
  if(!stored)throw new Error('이 모임에는 관리 비밀번호가 설정되지 않았습니다. 시트 소유자에게 문의하세요.');
  const parts=stored.split(':');
  if(parts.length!==2 || !/^[0-9a-f]{64}$/.test(parts[0]) || !/^[0-9a-f]{64}$/.test(parts[1]) ||
    eventPasswordHash_(parts[0],assertPassword_(password))!==parts[1]) {
    throw new Error('모임 관리 비밀번호가 일치하지 않습니다.');
  }
}
/** 비밀번호 분실 시에만 Apps Script 편집기에서 실행. ID를 설정한 후 직접 실행하세요. */
function resetEventPassword() {
  const eventId='여기에-모임-ID-입력';
  const newPassword='여기에-새-비밀번호-8자-이상';
  if(!readEvents_().some(e=>e.id===eventId))throw new Error('모임 ID를 확인하세요.');
  const password=assertPassword_(newPassword),salt=salt_();
  PropertiesService.getScriptProperties().setProperty(eventPasswordKey_(eventId),salt+':'+eventPasswordHash_(salt,password));
  return '해당 모임 관리 비밀번호를 변경했습니다.';
}
function safePlainText_(value,max,field,required) {
  const text=String(value||'').trim();
  if ((required&&!text) || text.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/.test(text) || /^[=+@\-]/.test(text)) {
    throw new Error(field+' 입력값을 확인해 주세요.');
  }
  return text;
}
function saveEvent_(p) {
  const password=assertPassword_(p.adminKey);
  const operation=String(p.operation||'create');
  if(operation!=='create' && operation!=='update')throw new Error('지원하지 않는 모임 관리 작업입니다.');
  const id=String(p.id||'').trim();
  if(!/^[a-zA-Z0-9-]{8,90}$/.test(id))throw new Error('모임 ID가 잘못되었습니다.');
  const title=safePlainText_(p.title,80,'모임 제목',true);
  const description=safePlainText_(p.description,800,'모임 설명',false);
  const location=safePlainText_(p.location,120,'모임 장소',false);
  const start=String(p.startDate||'').trim(),end=String(p.endDate||'').trim(),deadline=String(p.deadline||'').trim();
  if(!isoValid_(start)||!isoValid_(end)||end<start||daysBetween_(start,end)>=SETTINGS.maxAllowedDays) {
    throw new Error('모임 기간을 120일 이내로 선택해 주세요.');
  }
  if(deadline && !isoValid_(deadline))throw new Error('마감 날짜가 올바르지 않습니다.');
  let allowed;
  try {allowed=JSON.parse(String(p.allowedDates||'[]'));}catch(_){throw new Error('후보 날짜 형식이 올바르지 않습니다.');}
  if(!Array.isArray(allowed) || allowed.length>SETTINGS.maxAllowedDays || allowed.length!==new Set(allowed).size ||
     allowed.some(d=>typeof d!=='string' || !isoValid_(d) || d<start || d>end)) {
    throw new Error('후보 날짜를 확인해 주세요.');
  }
  const publicNames=String(p.publicNames)==='true';
  const status=String(p.status||'OPEN').toUpperCase();
  if(status!=='OPEN' && status!=='CLOSED')throw new Error('모임 상태가 올바르지 않습니다.');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('다른 저장 요청 처리 중입니다. 다시 시도해 주세요.');
  try {
    const sheet=ensureSheet_(getBook_(),SETTINGS.eventsTab,EVENT_HEADERS);
    const last=sheet.getLastRow();
    const ids=last>1?sheet.getRange(2,1,last-1,1).getValues().map(row=>String(row[0])):[];
    const index=ids.indexOf(id);
    if(operation==='create' && index>=0){
      // POST 재시도에도 새 모임을 중복 생성하지 않습니다.
      verifyEventPassword_(id,password);
      return {ok:true,id,operation,alreadyExisted:true};
    }
    if(operation==='update' && index<0)throw new Error('수정할 모임을 찾을 수 없습니다.');
    if(operation==='create' && ids.length>=300)throw new Error('모임 최대 등록 수를 초과했습니다.');
    if(operation==='update')verifyEventPassword_(id,password);
    const row=[id,title,description,location,start,end,deadline,status,publicNames?'TRUE':'FALSE',allowed.join(',')];
    const rowNum=operation==='update'?index+2:last+1;
    sheet.getRange(rowNum,1,1,EVENT_HEADERS.length).setNumberFormat('@').setValues([row]);
    SpreadsheetApp.flush();
    if(operation==='create'){
      const salt=salt_();
      PropertiesService.getScriptProperties().setProperty(eventPasswordKey_(id),salt+':'+eventPasswordHash_(salt,password));
    }
    return {ok:true,id,operation};
  }finally{lock.releaseLock();}
}

function doPost(e) {
  const p=e&&e.parameter?e.parameter:{};
  let result;
  try {
    if(p.action==='save')result=saveResponse_(p);
    else if(p.action==='event')result=saveEvent_(p);
    else result={ok:false,error:'지원하지 않는 요청입니다.'};
  }catch(error){
    console.error(error);
    result={ok:false,error:String(error.message||'저장 오류')};
  }
  // POST는 브라우저에서 응답을 읽을 수 없을 수 있으므로,
  // 별도의 공개 조회(GET)로 확인할 수 있는 무작위 수신증을 기록합니다.
  try {putReceipt_(p.requestId,result);}catch(error){console.error('Receipt cache unavailable: '+error);}
  return output_(result);
}
