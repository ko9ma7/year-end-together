import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import path from 'node:path';
const base=path.resolve(import.meta.dirname,'..');
let source=fs.readFileSync(path.join(base,'app.js'),'utf8');
assert.ok(source.includes('  refreshData();\n})();'));
source=source.replace('  refreshData();\n})();',`  globalThis.testApi={editPage,eventPage,placeMarkup,normalizeData,state,getDraft,getPlaceDraft};\n})();`);
const store=new Map(),root={innerHTML:'',setAttribute(){},addEventListener(){}};
const document={querySelector(s){return s==='#app'?root:null;},querySelectorAll(){return [];},documentElement:{dataset:{}},getElementById(){return null;},contains(){return false}};
const context={window:{APP_CONFIG:{apiUrl:'https://example.com',maps:{}},addEventListener(){}},document,crypto:webcrypto,
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),get length(){return store.size;},key:i=>[...store.keys()][i]},
 location:{hash:'#home',href:'https://ko9ma7.github.io/year-end-together/#home'},
 console,Intl,Date,Set,Map,URL,JSON,Math,String,Number,Array,Error,
 setInterval(){},setTimeout(){},clearTimeout(){},navigator:{}};
vm.createContext(context);vm.runInContext(source,context);
const {editPage,eventPage,placeMarkup,normalizeData,state}=context.testApi;
const create=editPage(null);
assert.match(create,/날짜 \+ 장소/);assert.match(create,/name="proposalDeadline"/);
assert.match(create,/name="voteDeadline"/);assert.match(create,/name="mode"/);
assert.match(create,/value="place"/);
const id='58648326-7ce3-42d2-8589-e709cd04ebd3';
const e={id,title:'연말 데이트',description:'장소 투표',location:'',startDate:'2026-12-04',endDate:'2026-12-20',
 deadline:'2026-11-17',status:'OPEN',mode:'both',allowedDates:[],proposalDeadline:'2026-11-19',voteDeadline:'2026-11-22',meetingDate:'2026-12-20'};
const props=[{id:'abc',proposer:'민수',name:'별빛 <카페>',comment:'옛 연인과의 추억',lat:37.5,lng:127,createdAt:'2026-11-16'}];
state.data={events:[e],responses:[]};
e.place={stage:'waiting',proposals:[],votes:[],winner:null};
let html=eventPage(e);
assert.match(html,/날짜 투표/);assert.match(html,/장소 추천 준비 중/);
assert.match(html,/place-map/);
e.place={stage:'proposals',proposals:props,votes:[],winner:null};
html=placeMarkup(e);assert.match(html,/place-proposal-form/);assert.doesNotMatch(html,/place-vote-form/);
assert.match(html,/&lt;카페&gt;/);assert.doesNotMatch(html,/<카페>/);
e.place.stage='voting';html=placeMarkup(e);
assert.match(html,/place-vote-form/);assert.doesNotMatch(html,/place-proposal-form/);
e.place={stage:'result',proposals:props,votes:[{voterName:'민수',proposalId:'abc'}],winner:{proposalId:'abc',votes:1,tie:false}};
html=placeMarkup(e);assert.match(html,/FINAL LOCATION/);assert.match(html,/1표/);
assert.match(html,/카카오 지도/);assert.match(html,/네이버 지도/);assert.match(html,/구글 지도/);
const bare={...e,mode:'place',place:{stage:'proposals',proposals:[],votes:[],winner:null}};
html=eventPage(bare);assert.doesNotMatch(html,/date-chip/);assert.match(html,/우리 모임의 장소/);
const data=normalizeData([{ok:true,event:{...bare},responses:[],place:bare.place}]);
assert.equal(data.events.length,1);assert.equal(data.events[0].mode,'place');
console.log('PASS app renders create/date/place/proposal/vote/final; escapes unsafe input.');
