'use strict';
// Apps Script unit smoke tests via isolated local mocks (not a live Google deployment).
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sheetMap = new Map();
class Sheet {
  constructor(name) {this.name=name;this.rows=[];}
  getLastRow() {return this.rows.length;}
  getRange(r,c,h=1,w=1) {
    const sheet=this;
    return {
      getValues(){return Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>sheet.rows[r+i-1]?.[c+j-1]??''));},
      getDisplayValues(){return this.getValues().map(row=>row.map(String));},
      setValues(values){for(let i=0;i<h;i++){const ri=r+i-1;while(sheet.rows.length<=ri)sheet.rows.push([]);for(let j=0;j<w;j++)sheet.rows[ri][c+j-1]=values[i][j];}return this;},
      setNumberFormat(){return this;},setFontWeight(){return this;},setBackground(){return this;},setFontColor(){return this;}
    };
  }
  setFrozenRows() {}autoResizeColumns() {}
}
const props = new Map();
const book={getSheetByName(name){return sheetMap.get(name)||null;}, insertSheet(name){const s=new Sheet(name);sheetMap.set(name,s);return s;}};
const sandbox={
  SpreadsheetApp:{getActiveSpreadsheet(){return book;},flush(){}},
  PropertiesService:{getScriptProperties(){return {getProperty(key){return props.get(key)||null;},setProperty(key,value){props.set(key,value);},deleteProperty(key){props.delete(key);}};}},
  LockService:{getScriptLock(){return {tryLock(){return true;},releaseLock(){}};}},
  Utilities:{
    DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},getUuid(){return crypto.randomUUID();},
    computeDigest(_,s){return [...crypto.createHash('sha256').update(s,'utf8').digest()].map(n=>n>127?n-256:n);},
    formatDate(value,_,fmt){const d=new Date(value);const pieces=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const dict=Object.fromEntries(pieces.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return `${dict.year}-${dict.month}-${dict.day}`;}
  },
  ContentService:{MimeType:{JAVASCRIPT:'js',JSON:'json'},createTextOutput(body){return {body,setMimeType(){return this;}};}},
  console
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../apps-script/Code.gs'),'utf8'),sandbox);
assert.match(sandbox.setupSheets(),/완료/);
assert.equal(book.getSheetByName('EVENTS').getLastRow(),1);
assert.equal(typeof props.get('ADMIN_KEY_SHA256'),'string');
const key=sandbox.resetAdminKey().match(/[0-9a-f]{64}/)[0];
const eid='year-end-2026';
let created=JSON.parse(sandbox.doPost({parameter:{action:'event',operation:'create',id:eid,adminKey:key,title:'2026 연말 모임',description:'함께해요',location:'서울',startDate:'2026-12-01',endDate:'2026-12-31',deadline:'2026-12-31',status:'OPEN',publicNames:'true',allowedDates:'[]'}}).body);
assert.equal(created.ok,true);
assert.equal(book.getSheetByName('EVENTS').getLastRow(),2);
created=JSON.parse(sandbox.doPost({parameter:{action:'event',operation:'create',id:'missing-admin-key',adminKey:'x',title:'나쁜 요청',startDate:'2026-12-01',endDate:'2026-12-31',status:'OPEN',allowedDates:'[]'}}).body);
assert.equal(created.ok,false);
const changed=JSON.parse(sandbox.doPost({parameter:{action:'event',operation:'update',id:eid,adminKey:key,title:'2026 연말 모임',description:'함께해요',location:'서울',startDate:'2026-12-01',endDate:'2026-12-31',deadline:'2026-12-31',status:'OPEN',publicNames:'true',allowedDates:'[]'}}).body);
assert.equal(changed.ok,true);
const uid='11111111-1111-4111-8111-111111111111',tok='a'.repeat(64);
const args={action:'save',id:uid,token:tok,eventId:'year-end-2026',name:'김모임',dates:JSON.stringify(['2026-12-01','2026-12-19'])};
let res=JSON.parse(sandbox.doPost({parameter:args}).body);
assert.equal(res.ok,true);assert.equal(res.created,true);
let output=JSON.parse(sandbox.doGet({parameter:{action:'read'}}).body);
assert.equal(output.events.length,1);assert.equal(output.responses.length,1);
assert.equal(output.responses[0].name,'김모임');
assert.deepEqual(Array.from(output.responses[0].dates),['2026-12-01','2026-12-19']);
assert.equal(output.responses[0].token,undefined);
res=JSON.parse(sandbox.doPost({parameter:{...args,name:'박모임',dates:JSON.stringify(['2026-12-20'])}}).body);
assert.equal(res.ok,true);assert.equal(res.updated,true);
assert.equal(book.getSheetByName('RESPONSES').getLastRow(),2);
assert.equal(JSON.parse(sandbox.doGet({parameter:{action:'read'}}).body).responses[0].name,'박모임');
res=JSON.parse(sandbox.doPost({parameter:{...args,token:'b'.repeat(64)}}).body);
assert.equal(res.ok,false);
res=JSON.parse(sandbox.doPost({parameter:{...args,id:'22222222-2222-4222-8222-222222222222',name:'=HYPERLINK',dates:JSON.stringify(['2026-12-01'])}}).body);
assert.equal(res.ok,false);
book.getSheetByName('EVENTS').getRange(2,9).setValues([['FALSE']]);
assert.equal(JSON.parse(sandbox.doGet({parameter:{action:'read'}}).body).responses[0].name,'비공개');
console.log('PASS Apps Script: setup, admin key, event create/update, save, edit response, read, invalid token, formula injection, private names');
