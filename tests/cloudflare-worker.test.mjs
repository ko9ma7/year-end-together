import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const source=await readFile(resolve(import.meta.dirname,'../cloudflare/worker.js'),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON;');
// The real database already has these tables. Tests must not recreate/alter them.
db.exec(`CREATE TABLE events (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', location TEXT DEFAULT '',
  start_date TEXT, end_date TEXT, deadline TEXT, status TEXT DEFAULT 'OPEN',
  public_names INTEGER DEFAULT 0, allowed_dates TEXT DEFAULT '', password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);
db.exec(`CREATE TABLE responses (
  id TEXT PRIMARY KEY, event_id TEXT NOT NULL,name TEXT NOT NULL,dates_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,status TEXT DEFAULT 'ACTIVE',
  FOREIGN KEY(event_id) REFERENCES events(id)
);`);
function prepare(sql) {
  let params=[];
  return { bind(...args){params=args;return this;},
   all(){return Promise.resolve({results:db.prepare(sql).all(...params)});},
   first(){return Promise.resolve(db.prepare(sql).get(...params)??null);},
   run(){return Promise.resolve(db.prepare(sql).run(...params));},
  };
}
const env={DB:{prepare,
  async batch(statements){db.exec('BEGIN');try{const r=[];for (const st of statements)r.push(await st.run());db.exec('COMMIT');return r;}
    catch(e){db.exec('ROLLBACK');throw e;}}
}};
const base='https://floral-thunder-c7b0.mullimulli-api.workers.dev';
async function call(path,method='GET',data,origin='https://ko9ma7.github.io'){
 const req=new Request(base+path,{method,headers: {'Origin':origin,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
 const res=await worker.fetch(req,env);
 const parsed=res.status===204?null:await res.json();
 return {status:res.status,body:parsed,headers:res.headers};
}
const eLegacy='33333333-3333-4333-8333-333333333333';
const rLegacy='44444444-4444-4444-8444-444444444444';
db.prepare(`INSERT INTO events(id,title,description,location,start_date,end_date,deadline,status,public_names,allowed_dates,password_hash)
 VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(eLegacy,'이미 마감된 2025 모임','기존 안내','부산','2025-11-01','2025-11-30','2025-11-20','CLOSED',0,'[]','old-hash-preserve');
db.prepare(`INSERT INTO responses(id,event_id,name,dates_json,status) VALUES (?,?,?,?,?)`).run(rLegacy,eLegacy,'과거 참여자','["2025-11-05","2025-11-11"]','ACTIVE');
let r=await call('/health');assert.equal(r.body.ok,true);assert.deepEqual(r.body.tables,['events','responses']);
r=await call('/api/data');assert.equal(r.status,403);assert(!JSON.stringify(r.body).includes(eLegacy));
r=await call('/api/events/'+eLegacy);assert.equal(r.status,200);assert.equal(r.body.event.status,'CLOSED');
assert.equal(r.body.responses.length,1);assert.equal(r.body.responses[0].name,'과거 참여자');
assert.deepEqual(r.body.responses[0].dates,['2025-11-05','2025-11-11']);
r=await call('/api/recover','POST',{title:'이미 마감된 2025 모임',name:'과거 참여자',dates:['2025-11-11','2025-11-05']});
assert.equal(r.status,200);assert.equal(r.body.eventId,eLegacy);
r=await call('/api/recover','POST',{title:'이미 마감된 2025 모임',name:'과거 참여자',dates:['2025-11-11']});assert.equal(r.status,404);
r=await call('/api/events/99999999-9999-4999-8999-999999999999');assert.equal(r.status,404);
await worker.scheduled();
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,1,'old event survives scheduled cleanup');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM responses').get().n,1,'old vote survives scheduled cleanup');

const eId='11111111-1111-4111-8111-111111111111';
const event={id:eId,operation:'create',title:'연말 송년 모임',description:'편안하게 만나요',location:'서울',startDate:'2026-12-01',endDate:'2026-12-31',deadline:'2026-12-20',status:'OPEN',publicNames:false,allowedDates:['2026-12-12','2026-12-19'],password:'only-for-admin-2026'};
r=await call('/api/events','POST',event);assert.equal(r.status,200);assert.equal(r.body.ok,true);
assert.match(db.prepare('SELECT password_hash FROM events WHERE id=?').get(eId).password_hash,/^pbkdf2\$10000\$/);
r=await call('/api/events','POST',event);assert.equal(r.body.alreadyExists,true);
r=await call('/api/events/'+eId);assert.equal(r.body.event.title,'연말 송년 모임');
assert.equal(r.body.event.password_hash,undefined);assert.equal(r.body.responses.length,0);
r=await call('/api/events','POST',{...event,operation:'update',title:'변조된 이름',password:'wrong-password'});
assert.equal(r.status,403);assert.equal(db.prepare('SELECT title FROM events WHERE id=?').get(eId).title,'연말 송년 모임');
r=await call('/api/events','POST',{...event,operation:'update',title:'연말 송년 모임 (확정)',password:event.password});
assert.equal(r.body.ok,true);assert.equal(db.prepare('SELECT title FROM events WHERE id=?').get(eId).title,'연말 송년 모임 (확정)');
const responseId='22222222-2222-4222-8222-222222222222';
const token='a'.repeat(64);
const response={id:responseId,eventId:eId,name:'김민수',dates:['2026-12-12','2026-12-19'],token};
r=await call('/api/responses','POST',response);assert.equal(r.body.ok,true);
assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='response_tokens'").get().name,'response_tokens');
r=await call('/api/data');assert.equal(r.status,403);
r=await call('/api/events/'+eId);assert.equal(r.body.responses.length,1);assert.equal(r.body.responses[0].name,'김민수');
assert.deepEqual(r.body.responses[0].dates,['2026-12-12','2026-12-19']);
assert(!JSON.stringify(r.body).includes('only-for-admin'));
r=await call('/api/recover','POST',{title:'연말 송년 모임 (확정)',name:'김민수',dates:['2026-12-19','2026-12-12']});
assert.equal(r.status,200);assert.equal(r.body.eventId,eId);
r=await call('/api/responses','POST',{...response,dates:['2026-12-19'],token:'b'.repeat(64)});
assert.equal(r.status,403);
r=await call('/api/responses','POST',{...response,dates:['2026-12-19']});assert.equal(r.body.operation,'update');
r=await call('/api/events/'+eId);assert.deepEqual(r.body.responses[0].dates,['2026-12-19']);
r=await call('/api/events','POST',{...event,operation:'update',status:'CLOSED'});assert.equal(r.body.ok,true);
r=await call('/api/responses','POST',response);assert.equal(r.status,409);
r=await call('/api/events/'+eId);assert.equal(r.body.event.status,'CLOSED');assert.equal(r.body.responses.length,1);
r=await call('/api/recover','POST',{title:event.title,name:'김민수',dates:['2026-12-19']});assert.equal(r.status,200);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,2,'closed legacy + new event preserved');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM responses').get().n,2,'closed legacy + new votes preserved');
r=await call('/api/events/'+eLegacy,'GET',undefined,'https://malicious.example');assert.equal(r.status,403);
r=await call('/api/events/'+eLegacy,'OPTIONS');assert.equal(r.status,204);
for(let i=0;i<RECOVERY_ATTEMPTS_BEFORE_LIMIT();i++) {
 r=await call('/api/recover','POST',{title:'unknown',name:'가명',dates:['2026-12-01']});
 if(r.status===429)break;
}
assert.equal(r.status,429,'recovery throttling');
function RECOVERY_ATTEMPTS_BEFORE_LIMIT(){return 30;}
console.log('OK: historical CLOSED records intact, invite-only read, exact recovery, rate limit, create/edit, name/date breakdown, token auth and CORS');
