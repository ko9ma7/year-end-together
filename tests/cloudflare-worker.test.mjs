import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const source=await readFile(resolve(import.meta.dirname,'../cloudflare/worker.js'),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON;');
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
let r=await call('/health');assert.equal(r.body.ok,true);assert.deepEqual(r.body.tables,['events','responses']);
r=await call('/api/data');assert.deepEqual(r.body.events,[]);assert.deepEqual(r.body.responses,[]);
const eId='11111111-1111-4111-8111-111111111111';
const event={id:eId,operation:'create',title:'연말 송년 모임',description:'편안하게 만나요',location:'서울',startDate:'2026-12-01',endDate:'2026-12-31',deadline:'2026-12-20',status:'OPEN',publicNames:false,allowedDates:['2026-12-12','2026-12-19'],password:'only-for-admin-2026'};
r=await call('/api/events','POST',event);assert.equal(r.status,200);assert.equal(r.body.ok,true);
assert.match(db.prepare('SELECT password_hash FROM events WHERE id=?').get(eId).password_hash,/^pbkdf2\$10000\$/);
r=await call('/api/events','POST',event);assert.equal(r.body.alreadyExists,true);
r=await call('/api/data');assert.equal(r.body.events[0].title,'연말 송년 모임');
assert.equal(r.body.events[0].password_hash,undefined);
assert.equal(r.body.responses.length,0);
r=await call('/api/events','POST',{...event,operation:'update',title:'변조된 이름',password:'wrong-password'});
assert.equal(r.status,403);assert.equal(db.prepare('SELECT title FROM events').get().title,'연말 송년 모임');
r=await call('/api/events','POST',{...event,operation:'update',title:'연말 송년 모임 (확정)',password:event.password});
assert.equal(r.body.ok,true);assert.equal(db.prepare('SELECT title FROM events').get().title,'연말 송년 모임 (확정)');
const responseId='22222222-2222-4222-8222-222222222222';
const token='a'.repeat(64);
const response={id:responseId,eventId:eId,name:'김민수',dates:['2026-12-12','2026-12-19'],token};
r=await call('/api/responses','POST',response);assert.equal(r.body.ok,true);
assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='response_tokens'").get().name,'response_tokens');
r=await call('/api/data');assert.equal(r.body.responses.length,1);assert.equal(r.body.responses[0].name,'비공개');
assert.equal(r.body.responses[0].dates.length,2);
assert(!JSON.stringify(r.body).includes('only-for-admin'));
assert(!JSON.stringify(r.body).includes('김민수'));
r=await call('/api/responses','POST',{...response,dates:['2026-12-19'],token:'b'.repeat(64)});
assert.equal(r.status,403);
r=await call('/api/responses','POST',{...response,dates:['2026-12-19']});assert.equal(r.body.operation,'update');
r=await call('/api/data');assert.deepEqual(r.body.responses[0].dates,['2026-12-19']);
r=await call('/api/events','POST',{...event,operation:'update',publicNames:true});assert.equal(r.body.ok,true);
r=await call('/api/data');assert.equal(r.body.responses[0].name,'김민수');
r=await call('/api/events','POST',{...event,operation:'update',status:'CLOSED'});assert.equal(r.body.ok,true);
r=await call('/api/responses','POST',response);assert.equal(r.status,409);
r=await call('/api/data','GET',undefined,'https://malicious.example');assert.equal(r.status,403);
r=await call('/api/data','OPTIONS');assert.equal(r.status,204);
// Third-party Worker must stay unrelated; accidental writes to other DB not modeled.
console.log('OK: health, read, event create/idempotence/update/hashed password, response save/edit/token, privacy, closed status, CORS');
