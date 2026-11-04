/**
 * 모두의 연말 - Google Sheets 바인딩 Apps Script.
 * 반드시 편집 가능한 원본 스프레드시트에서 [확장 프로그램 > Apps Script]로 생성하세요.
 * 게시용 /pubhtml URL은 여기서 열거나 쓰기 권한을 부여할 수 없습니다.
 *
 * 배포: 웹 앱 / 실행 사용자: 나 / 액세스 권한: 모든 사용자(Anyone).
 * 모임 생성·수정은 Script Properties의 관리자 키가 있는 사람만 가능합니다.
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

/** 최초 한 번, Apps Script 편집기에서 직접 실행합니다. */
function setupSheets() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('편집 가능한 원본 스프레드시트에 연결된 Apps Script 프로젝트에서 실행하세요.');
  const events = ensureSheet_(book, SETTINGS.eventsTab, EVENT_HEADERS);
  const responses = ensureSheet_(book, SETTINGS.responsesTab, RESPONSE_HEADERS);

  // 모임은 이제 웹의 '새 모임 만들기'에서 등록합니다. 샘플 모임을 자동 추가하지 않습니다.
  initializeAdminKey_();
  events.setFrozenRows(1);
  responses.setFrozenRows(1);
  events.autoResizeColumns(1,EVENT_HEADERS.length);
  responses.autoResizeColumns(1,RESPONSE_HEADERS.length);
  return 'EVENTS / RESPONSES 탭 준비 완료. 실행 로그에 새 관리자 키가 표시되었다면 안전하게 보관하세요.';
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
  const book=SpreadsheetApp.getActiveSpreadsheet();
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
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS.responsesTab);
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
  const parameter=e&&e.parameter?e.parameter:{};
  try {
    if(parameter.action!=='read')return output_({ok:false,error:'지원하지 않는 요청입니다.'},parameter.callback);
    return output_(readPayload_(),parameter.callback);
  }catch(error){console.error(error);return output_({ok:false,error:'시트를 읽지 못했습니다. Apps Script 실행 로그와 설정을 확인해 주세요.'},parameter.callback);}
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
    const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS.responsesTab);
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
/** 설치 시 최초 1회 관리자 키 생성: Script Properties에는 해시만 저장합니다. */
function initializeAdminKey_() {
  const props=PropertiesService.getScriptProperties();
  if (props.getProperty('ADMIN_KEY_SHA256')) return '관리자 키가 이미 설정되어 있습니다.';
  const key=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  props.setProperty('ADMIN_KEY_SHA256',sha256_(key));
  console.log('관리자 키 (최초 1회 표시, 꼭 안전하게 보관): '+key);
  return '관리자 키 (최초 1회 표시, 꼭 안전하게 보관): '+key;
}
/** 관리자 키를 잃어버린 경우에만 편집기에서 실행. 이전 키는 즉시 무효화됩니다. */
function resetAdminKey() {
  PropertiesService.getScriptProperties().deleteProperty('ADMIN_KEY_SHA256');
  return initializeAdminKey_();
}
function verifyAdminKey_(key) {
  const stored=PropertiesService.getScriptProperties().getProperty('ADMIN_KEY_SHA256');
  if (!stored || !/^[0-9a-f]{64}$/i.test(String(key||'')) || sha256_(String(key))!==stored) {
    throw new Error('관리자 키가 올바르지 않습니다. Apps Script 실행 로그 또는 관리자에게 확인해 주세요.');
  }
}
function safePlainText_(value,max,field,required) {
  const text=String(value||'').trim();
  if ((required&&!text) || text.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/.test(text) || /^[=+@\-]/.test(text)) {
    throw new Error(field+' 입력값을 확인해 주세요.');
  }
  return text;
}
function saveEvent_(p) {
  verifyAdminKey_(p.adminKey);
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
    const sheet=ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(),SETTINGS.eventsTab,EVENT_HEADERS);
    const last=sheet.getLastRow();
    const ids=last>1?sheet.getRange(2,1,last-1,1).getValues().map(row=>String(row[0])):[];
    const index=ids.indexOf(id);
    if(operation==='create' && index>=0)throw new Error('이미 존재하는 모임 ID입니다.');
    if(operation==='update' && index<0)throw new Error('수정할 모임을 찾을 수 없습니다.');
    if(operation==='create' && ids.length>=300)throw new Error('모임 최대 등록 수를 초과했습니다.');
    const row=[id,title,description,location,start,end,deadline,status,publicNames?'TRUE':'FALSE',allowed.join(',')];
    const rowNum=operation==='update'?index+2:last+1;
    sheet.getRange(rowNum,1,1,EVENT_HEADERS.length).setNumberFormat('@').setValues([row]);
    SpreadsheetApp.flush();
    return {ok:true,id,operation};
  }finally{lock.releaseLock();}
}

function doPost(e) {
  try {
    const p=e&&e.parameter?e.parameter:{};
    if(p.action==='save')return output_(saveResponse_(p));
    if(p.action==='event')return output_(saveEvent_(p));
    return output_({ok:false,error:'지원하지 않는 요청입니다.'});
  }catch(error){console.error(error);return output_({ok:false,error:String(error.message||'저장 오류')});}
}
