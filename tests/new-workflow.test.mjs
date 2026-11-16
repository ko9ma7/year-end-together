import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const app=await import(pathToFileURL(path.join(root,'cloudflare/worker.js')).href);
const db=new DatabaseSync(':memory:');
// Simulate the pre-existing production D1 tables; the migration must not recreate or erase them.
db.exec(`CREATE TABLE events (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', location TEXT DEFAULT '', start_date TEXT NOT NULL, end_date TEXT NOT NULL, deadline TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'OPEN', public_names INTEGER NOT NULL DEFAULT 1, allowed_dates TEXT DEFAULT '[]', password_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE responses (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, name TEXT NOT NULL, dates_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE');
CREATE TABLE response_tokens (response_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
db.prepare(`INSERT INTO events (id,title,description,location,start_date,end_date,deadline,status,public_names,allowed_dates,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .run('legacy-event','기존 모임','','','2026-12-20','2026-12-20','','CLOSED',0,'[]','hash','2026-11-01','2026-11-01');
db.prepare(`INSERT INTO responses (id,event_id,name,dates_json,created_at,updated_at,status) VALUES (?,?,?,?,?,?,?)`)
  .run('legacy-response','legacy-event','기존 참여자','["2026-12-20"]','2026-11-01','2026-11-01','ACTIVE');
const sql=fs.readFileSync(path.join(root,'cloudflare/schema.sql'),'utf8');
db.exec(sql);
db.exec(sql); // migration is idempotent and does not drop earlier data
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,1,'legacy event row preserved');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM responses').get().n,1,'legacy response row preserved');
const adapter={
  prepare(sql){let args=[];return {
    bind(...a){args=a;return this;},
    async first(){return db.prepare(sql).get(...args)||null;},
    async all(){return {results:db.prepare(sql).all(...args)};},
    async run(){return db.prepare(sql).run(...args);},
  };},
  async batch(statements){db.exec('BEGIN');try{let out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}
    catch(e){db.exec('ROLLBACK');throw e;}}
};
const realDate=globalThis.Date;
function current(iso='2026-11-16'){globalThis.Date=class extends realDate {constructor(...args){super(...(args.length?args:[iso+'T02:00:00Z']));}static now(){return new realDate(iso+'T02:00:00Z').getTime();}};}
async function request(route,body=undefined,method='POST'){
  const url='https://example.workers.dev'+route;
  const r=new Request(url,{method:body?method:'GET',headers:{Origin:'https://ko9ma7.github.io',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const response=await app.default.fetch(r,{DB:adapter});
  const json=await response.json();
  return {status:response.status,...json};
}
const uid=(n)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const pw='private1234';
let checks=0;
function ok(x,msg){assert.ok(x,msg);checks++;}
try {
  current();
  let res=await request('/health');ok(res.ok&&res.tables.length===7,'health shows 7 required tables');
  res=await request('/');ok(res.routes.includes('/api/places/vote'),'new routes');
  res=await request('/api/data');ok(res.status===403,'bulk endpoint blocked');
  const evPlace=uid(1),evBoth=uid(2),evDate=uid(3),rid=uid(101);
  const common={operation:'create',title:'연말 장소 모임',description:'테스트',location:'',password:pw,
    publicNames:true,status:'OPEN',allowedDates:[]};
  const placeEvent={...common,id:evPlace,mode:'place',startDate:'2026-12-20',endDate:'2026-12-20',deadline:'',
    meetingDate:'2026-12-20',proposalDeadline:'2026-11-18',voteDeadline:'2026-11-21'};
  res=await request('/api/events',placeEvent);ok(res.status===200&&res.ok,'place create');
  res=await request('/api/events/'+evPlace);ok(res.event.mode==='place'&&res.place.stage==='proposals','initial place stage');
  res=await request('/api/places/propose',{eventId:evPlace,id:uid(11),name:'민수',placeName:'서울숲 카페',comment:'소중한 추억의 장소',lat:37.5445,lng:127.0374});
  ok(res.ok,'propose place');
  res=await request('/api/places/propose',{eventId:evPlace,id:uid(12),name:'영희',placeName:'한강공원',comment:'야경 추천',lat:37.5216,lng:126.9404});
  ok(res.ok,'second proposal');
  res=await request('/api/places/propose',{eventId:evPlace,id:uid(13),name:'민수',placeName:'중복',lat:37,lng:127});
  ok(res.status===409,'one candidate per name');
  res=await request('/api/places/vote',{eventId:evPlace,name:'민수',proposalId:uid(11),token:'a'.repeat(64)});
  ok(res.status===409,'cannot vote before proposal deadline');
  res=await request('/api/events',{...common,id:evBoth,mode:'both',title:'날짜 장소 둘다',startDate:'2026-12-25',endDate:'2026-12-26',deadline:'2026-11-17',
    proposalDeadline:'2026-11-19',voteDeadline:'2026-11-22',meetingDate:'2026-12-25'});
  ok(res.ok,'both mode create');
  res=await request('/api/events/'+evBoth);ok(res.place.stage==='waiting','both starts date first');
  res=await request('/api/events',{...common,id:evDate,mode:'date',title:'날짜 전용',startDate:'2026-12-12',endDate:'2026-12-20',deadline:'2026-12-01'});
  ok(res.ok,'date-only event create');
  res=await request('/api/responses',{id:rid,eventId:evDate,name:'유저',dates:['2026-12-12'],token:'b'.repeat(64)});
  ok(res.ok,'date response saved');
  res=await request('/api/events/'+evDate);ok(res.responses.length===1&&res.place.stage==='none','date-only read');
  // A pre-v2 meeting without event_settings must still be readable.
  const legacyId=uid(4);
  db.prepare(`INSERT INTO events(id,title,description,location,start_date,end_date,deadline,status,public_names,allowed_dates,password_hash,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(legacyId,'옛 모임','','','2026-12-15','2026-12-15','2026-11-30','OPEN',0,'[]','legacy','2026-11-01','2026-11-01');
  res=await request('/api/events/'+legacyId);ok(res.ok&&res.event.mode==='date','legacy event without settings is readable');
  res=await request('/api/places/propose',{eventId:evDate,id:uid(14),name:'유저',placeName:'없는 장소',lat:37,lng:127});
  ok(res.status===409,'date-only prevents place suggestions');
  current('2026-11-19');
  res=await request('/api/events/'+evPlace);ok(res.place.stage==='voting'&&res.place.proposals.length===2,'auto move to vote');
  res=await request('/api/places/vote',{eventId:evPlace,name:'민수',proposalId:uid(11),token:'a'.repeat(64)});
  ok(res.ok,'vote created');
  res=await request('/api/places/vote',{eventId:evPlace,name:'민수',proposalId:uid(12),token:'c'.repeat(64)});
  ok(res.status===409,'vote cannot be hijacked with new token');
  res=await request('/api/places/vote',{eventId:evPlace,name:'민수',proposalId:uid(12),token:'a'.repeat(64)});
  ok(res.ok&&res.operation==='update','same browser can edit vote');
  res=await request('/api/places/vote',{eventId:evPlace,name:'영희',proposalId:uid(11),token:'b'.repeat(64)});
  ok(res.ok,'second voter');
  res=await request('/api/events/'+evPlace);
  ok(res.place.stage==='voting'&&res.place.winner===null,'no winner before close');
  res=await request('/api/places/propose',{eventId:evPlace,id:uid(15),name:'다른사람',placeName:'늦은곳',lat:37,lng:127});
  ok(res.status===409,'cannot propose after close');
  current('2026-11-22');
  res=await request('/api/events/'+evPlace);
  ok(res.place.stage==='result','auto final after vote deadline');
  ok(res.place.winner?.proposalId===uid(11)&&res.place.winner.tie===true,'ties prefer earliest proposal');
  res=await request('/api/places/vote',{eventId:evPlace,name:'늦은사람',proposalId:uid(11),token:'d'.repeat(64)});
  ok(res.status===409,'cannot vote after close');
  const counts=db.prepare('SELECT (SELECT COUNT(*) FROM events) AS events,(SELECT COUNT(*) FROM responses) AS responses,(SELECT COUNT(*) FROM place_proposals) AS places,(SELECT COUNT(*) FROM place_votes) AS votes').get();
  ok(counts.events===5&&counts.responses===2&&counts.places===2&&counts.votes===2,'saved rows remain intact');
  res=await request('/api/events/'+evBoth);ok(res.place.stage==='voting','both transitions by date');
  res=await request('/api/events',{...common,id:evBoth,mode:'place',title:'type-change',startDate:'2026-12-25',endDate:'2026-12-25',deadline:'',
    proposalDeadline:'2026-11-24',voteDeadline:'2026-11-25',meetingDate:'2026-12-25',operation:'update'});
  ok(res.ok,'mode can change before any place activity');
  res=await request('/api/events',{...common,id:evPlace,mode:'date',title:'change after proposal',startDate:'2026-12-20',endDate:'2026-12-20',deadline:'2026-12-01',operation:'update'});
  ok(res.status===409,'mode cannot change after place activity');
  console.log(`PASS ${checks} assertions. Tables ${JSON.stringify(counts)}.`);
}finally{globalThis.Date=realDate;db.close();}
