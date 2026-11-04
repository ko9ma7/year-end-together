/**
 * 모두의 연말 - Google Sheets 바인딩 Apps Script.
 * 반드시 편집 가능한 원본 스프레드시트에서 [확장 프로그램 > Apps Script]로 생성하세요.
 * 게시용 /pubhtml URL은 여기서 열거나 쓰기 권한을 부여할 수 없습니다.
 *
 * 배포: 웹 앱 / 실행 사용자: 나 / 액세스 권한: 모든 사용자(Anyone).
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

  if (events.getLastRow() === 1) {
    events.getRange(2,1,1,EVENT_HEADERS.length).setNumberFormat('@');
    events.getRange(2,1,1,EVENT_HEADERS.length).setValues([[
      'year-end-2026',
      '2026 연말 모임',
      '올해의 마지막을 함께해요. 참석할 수 있는 날짜를 모두 선택해 주세요.',
      '장소 추후 공지',
      '2026-12-01',
      '2026-12-31',
      '2026-12-31',
      'OPEN',
      'TRUE',
      ''
    ]]);
  }
  events.setFrozenRows(1);
  responses.setFrozenRows(1);
  events.autoResizeColumns(1,EVENT_HEADERS.length);
  responses.autoResizeColumns(1,RESPONSE_HEADERS.length);
  return 'EVENTS / RESPONSES 탭 준비 완료. EVENTS의 첫 모임 정보를 수정해 주세요.';
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
  }).filter(event=>event.id && isoValid_(event.startDate) && isoValid_(event.endDate) && event.endDate>=event.startDate && daysBetween_(event.startDate,event.endDate)<SETTINGS.maxAllowedDays);
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
function doPost(e) {
  try {
    const p=e&&e.parameter?e.parameter:{};
    if(p.action!=='save')return output_({ok:false,error:'지원하지 않는 요청입니다.'});
    return output_(saveResponse_(p));
  }catch(error){console.error(error);return output_({ok:false,error:String(error.message||'저장 오류')});}
}
