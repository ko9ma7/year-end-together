/**
 * 모두의 연말 · Cloudflare Worker + D1
 * Worker: floral-thunder-c7b0  |  D1 binding: DB -> year-end-together-db
 * Existing tables: events, responses (previously created in the D1 console).
 * Creates only one auxiliary table, response_tokens, for secure participant edits.
 * No Google Sheets or Apps Script access.
 */
const ALLOWED_ORIGINS = new Set([
  'https://ko9ma7.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);
const DAYS_TO_KEEP_AFTER_EVENT = 30;
const MAX_EVENTS = 300;
const MAX_RESPONSES_PER_EVENT = 300;
// Free Workers have a 10ms CPU budget. Use modest PBKDF2 cost; choose a long unique organizer password.
const PASSWORD_ITERATIONS = 10_000;

class ApiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function isoDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function todayKST() {
  return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function validId(id) { return typeof id === 'string' && /^[a-f0-9-]{32,36}$/i.test(id); }
function inputText(value, max = 120) { return String(value ?? '').trim().slice(0, max + 1); }
function bounded(value, max, required = false, multiline = false) {
  const s = inputText(value, max);
  if (s.length > max || (required && !s)) throw new ApiError('입력한 문자 수를 확인해 주세요.');
  if ((multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/ : /[\u0000-\u001f]/).test(s)) throw new ApiError('허용되지 않은 문자가 포함돼 있습니다.');
  return s;
}
function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch (_) { return []; }
}
function dateOptions(start, end, allowed) {
  const duration = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (!isoDay(start) || !isoDay(end) || duration < 0 || duration >= 120) throw new ApiError('모임 기간은 1~120일 사이여야 합니다.');
  const candidates = parseJsonArray(allowed);
  if (candidates.length > 120 || new Set(candidates).size !== candidates.length || candidates.some(d => !isoDay(d) || d < start || d > end)) {
    throw new ApiError('후보 날짜 형식이나 범위를 확인해 주세요.');
  }
  return candidates;
}
function cleanEvent(data) {
  const id = String(data.id || '');
  if (!validId(id)) throw new ApiError('모임 ID 형식이 잘못됐습니다.');
  const title = bounded(data.title, 80, true);
  const description = bounded(data.description, 800, false, true);
  const location = bounded(data.location, 120);
  const startDate = String(data.startDate || '');
  const endDate = String(data.endDate || '');
  const allowedDates = dateOptions(startDate, endDate, data.allowedDates);
  const deadline = String(data.deadline || '');
  if (deadline && !isoDay(deadline)) throw new ApiError('마감일이 올바르지 않습니다.');
  const status = data.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
  return {id,title,description,location,startDate,endDate,deadline,status,
    publicNames:data.publicNames === true,allowedDates};
}
function randomHex(bytes = 16) {
  const value = new Uint8Array(bytes);crypto.getRandomValues(value);
  return [...value].map(b => b.toString(16).padStart(2,'0')).join('');
}
function hexBytes(s) { return new Uint8Array(s.match(/../g).map(h=>parseInt(h,16))); }
function toHex(value) { return [...new Uint8Array(value)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function passwordDigest(secret, salt, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'PBKDF2'}, false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:hexBytes(salt),iterations,hash:'SHA-256'},key,256));
}
async function createPasswordHash(secret) {
  const salt = randomHex(16);
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${await passwordDigest(secret,salt)}`;
}
function safeCompare(a,b) {
  if (a.length !== b.length) return false;
  let n = 0;for (let i=0;i<a.length;i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
async function verifyPassword(secret, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2' || !/^[a-f0-9]{32}$/.test(parts[2]) || !/^\d+$/.test(parts[1])) return false;
  const rounds = Number(parts[1]);if(rounds < 10_000 || rounds > 500_000) return false;
  return safeCompare(await passwordDigest(secret,parts[2],rounds), parts[3]);
}
async function tokenHash(token) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
}
function eventPublic(row) {
  return {id:row.id,title:row.title,description:row.description || '',location:row.location || '',
    startDate:row.start_date,endDate:row.end_date,deadline:row.deadline || '',
    status:row.status === 'CLOSED' ? 'CLOSED' : 'OPEN',publicNames:row.public_names === 1,
    allowedDates:parseJsonArray(row.allowed_dates)};
}
function responsePublic(row, eventsById) {
  const ev = eventsById.get(row.event_id);
  if (!ev) return null;
  return {id:row.id,eventId:row.event_id,name:ev.publicNames ? row.name : '비공개',
    dates:parseJsonArray(row.dates_json),updatedAt:row.updated_at || ''};
}
function isOpen(row) {
  if (row.status !== 'OPEN') return false;
  const now = todayKST();
  return (!row.deadline || row.deadline >= now) && row.end_date >= now;
}
function validateDates(row, dates) {
  if (!Array.isArray(dates) || dates.length === 0 || dates.length > 120 || new Set(dates).size !== dates.length) {
    throw new ApiError('가능한 날짜를 한 개 이상 중복 없이 선택해 주세요.');
  }
  const allowed = parseJsonArray(row.allowed_dates);
  const now = todayKST();
  if (dates.some(d => !isoDay(d) || d < now || d < row.start_date || d > row.end_date || (allowed.length && !allowed.includes(d)))) {
    throw new ApiError('선택한 날짜 중 참여할 수 없는 날짜가 있습니다.');
  }
}
async function ensureTokenTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS response_tokens (
    response_id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
async function cleanupExpired(env) {
  await ensureTokenTable(env);
  // Physical cleanup occurs on reads, writes, and (optionally) a scheduled Cron.
  // Delete child rows first to respect D1 foreign keys.
  const expired = `SELECT id FROM events WHERE date(end_date, '+${DAYS_TO_KEEP_AFTER_EVENT} days') < date('now','+9 hours')`;
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM response_tokens WHERE response_id IN (SELECT id FROM responses WHERE event_id IN (${expired}))`),
    env.DB.prepare(`DELETE FROM responses WHERE event_id IN (${expired})`),
    env.DB.prepare(`DELETE FROM events WHERE id IN (${expired})`),
  ]);
}
async function readAll(env) {
  await cleanupExpired(env);
  const [evRows, responseRows] = await Promise.all([
    env.DB.prepare('SELECT id,title,description,location,start_date,end_date,deadline,status,public_names,allowed_dates FROM events ORDER BY created_at DESC LIMIT 300').all(),
    env.DB.prepare("SELECT id,event_id,name,dates_json,updated_at FROM responses WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 90000").all(),
  ]);
  const events = (evRows.results || []).map(eventPublic);
  const map = new Map(events.map(e=>[e.id,e]));
  const responses = (responseRows.results || []).map(r=>responsePublic(r,map)).filter(Boolean);
  return {ok:true,events,responses,serverTime:new Date().toISOString()};
}
async function saveEvent(env, data) {
  const operation = data.operation === 'update' ? 'update' : 'create';
  const input = cleanEvent(data);
  const password = String(data.password || '');
  if (password.length < 8 || password.length > 128) throw new ApiError('모임 관리 비밀번호는 8~128자로 입력해 주세요.');
  const existing = await env.DB.prepare('SELECT id,password_hash FROM events WHERE id = ?').bind(input.id).first();
  if (operation === 'create') {
    if (existing) {
      if (await verifyPassword(password, existing.password_hash)) return {ok:true,id:input.id,operation:'create',alreadyExists:true};
      throw new ApiError('이미 사용 중인 모임 ID입니다.',409);
    }
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM events').first();
    if ((count?.count||0) >= MAX_EVENTS) throw new ApiError('등록 가능한 모임 수를 초과했습니다.',429);
    const passwordHash = await createPasswordHash(password);
    await env.DB.prepare(`INSERT INTO events (id,title,description,location,start_date,end_date,deadline,status,public_names,allowed_dates,password_hash,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(input.id,input.title,input.description,input.location,input.startDate,input.endDate,input.deadline,
      input.status,input.publicNames?1:0,JSON.stringify(input.allowedDates),passwordHash,new Date().toISOString(),new Date().toISOString()).run();
    return {ok:true,id:input.id,operation:'create'};
  }
  if (!existing) throw new ApiError('수정할 모임을 찾을 수 없습니다.',404);
  if (!await verifyPassword(password, existing.password_hash)) throw new ApiError('관리 비밀번호가 올바르지 않습니다.',403);
  await env.DB.prepare(`UPDATE events SET title=?,description=?,location=?,start_date=?,end_date=?,deadline=?,status=?,public_names=?,allowed_dates=?,updated_at=? WHERE id=?`)
    .bind(input.title,input.description,input.location,input.startDate,input.endDate,input.deadline,input.status,
      input.publicNames?1:0,JSON.stringify(input.allowedDates),new Date().toISOString(),input.id).run();
  return {ok:true,id:input.id,operation:'update'};
}
async function saveResponse(env, data) {
  const id = String(data.id||''),eventId=String(data.eventId||'');
  if (!validId(id) || !validId(eventId)) throw new ApiError('응답 또는 모임 ID가 잘못되었습니다.');
  const name=bounded(data.name,30,true).replace(/\s+/g,' ');
  if (name.length<2 || /^[=+\-@]/.test(name)) throw new ApiError('이름을 2~30자로 입력해 주세요.');
  const dates=parseJsonArray(data.dates);
  const token=String(data.token||'');
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new ApiError('수정 토큰 형식이 올바르지 않습니다.');
  const event = await env.DB.prepare('SELECT * FROM events WHERE id=?').bind(eventId).first();
  if (!event) throw new ApiError('모임이 존재하지 않습니다.',404);
  if (!isOpen(event)) throw new ApiError('참여가 마감된 모임입니다.',409);
  validateDates(event,dates);
  await ensureTokenTable(env);
  const existing=await env.DB.prepare('SELECT id,event_id FROM responses WHERE id=?').bind(id).first();
  const hashed=await tokenHash(token);
  const now=new Date().toISOString();
  if (existing) {
    if (existing.event_id !== eventId) throw new ApiError('응답 ID가 다른 모임에 사용되고 있습니다.',409);
    const stored=await env.DB.prepare('SELECT token_hash FROM response_tokens WHERE response_id=?').bind(id).first();
    if (!stored || !safeCompare(stored.token_hash,hashed)) throw new ApiError('이 응답을 수정할 권한이 없습니다.',403);
    await env.DB.prepare(`UPDATE responses SET name=?,dates_json=?,updated_at=?,status='ACTIVE' WHERE id=? AND event_id=?`)
      .bind(name,JSON.stringify(dates),now,id,eventId).run();
    return {ok:true,id,eventId,operation:'update'};
  }
  const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM responses WHERE event_id=? AND status='ACTIVE'").bind(eventId).first();
  if ((count?.count||0)>=MAX_RESPONSES_PER_EVENT) throw new ApiError('이 모임의 응답 제한을 초과했습니다.',429);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO responses(id,event_id,name,dates_json,created_at,updated_at,status) VALUES (?,?,?,?,?,?, 'ACTIVE')`)
      .bind(id,eventId,name,JSON.stringify(dates),now,now),
    env.DB.prepare('INSERT INTO response_tokens(response_id,token_hash) VALUES (?,?)').bind(id,hashed),
  ]);
  return {ok:true,id,eventId,operation:'create'};
}
function corsHeaders(request) {
  const origin=request.headers.get('Origin');
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers']='Content-Type';
    headers['Access-Control-Max-Age']='3600';
  }
  return headers;
}
function json(request,body,status=200) {return new Response(JSON.stringify(body),{status,headers:corsHeaders(request)});}
async function readBody(request) {
  if (!String(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) throw new ApiError('JSON 형식의 요청만 받습니다.',415);
  const raw=await request.text();
  if (raw.length>12_000) throw new ApiError('요청 내용이 너무 큽니다.',413);
  let body;try{body=JSON.parse(raw);}catch(_){throw new ApiError('JSON 문법을 확인해 주세요.');}
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('올바른 요청 객체가 아닙니다.');
  return body;
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url), path=url.pathname.replace(/\/+$/,'') || '/';
    try {
      if (!env.DB) throw new ApiError('D1 바인딩 DB가 연결되지 않았습니다.',503);
      if (request.method==='OPTIONS') {
        if (!ALLOWED_ORIGINS.has(request.headers.get('Origin'))) return json(request,{ok:false,error:'허용되지 않은 출처입니다.'},403);
        return new Response(null,{status:204,headers:corsHeaders(request)});
      }
      const origin=request.headers.get('Origin');
      if (origin && !ALLOWED_ORIGINS.has(origin)) throw new ApiError('허용되지 않은 웹사이트입니다.',403);
      if (request.method==='GET' && path==='/health') {
        const result=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('events','responses') ORDER BY name").all();
        return json(request,{ok:true,database:'connected',tables:(result.results||[]).map(r=>r.name)});
      }
      if (request.method==='GET' && path==='/api/data') return json(request,await readAll(env));
      if (request.method==='POST' && path==='/api/events') {
        await cleanupExpired(env);
        return json(request,await saveEvent(env,await readBody(request)));
      }
      if (request.method==='POST' && path==='/api/responses') {
        await cleanupExpired(env);
        return json(request,await saveResponse(env,await readBody(request)));
      }
      if (request.method==='GET' && path==='/') return json(request,{ok:true,service:'year-end-together-api',routes:['/health','/api/data']});
      throw new ApiError('지원하지 않는 주소 또는 요청 방식입니다.',404);
    }catch(error) {
      if (!(error instanceof ApiError)) console.error('Worker error',error);
      return json(request,{ok:false,error:error instanceof ApiError ? error.message : '서버 처리 중 오류가 발생했습니다.'},error instanceof ApiError?error.status:500);
    }
  },
  async scheduled(controller,env,ctx) {ctx.waitUntil(cleanupExpired(env));},
};
