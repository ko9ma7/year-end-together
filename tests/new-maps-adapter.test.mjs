import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
const source=fs.readFileSync(path.resolve(import.meta.dirname,'../maps.js'),'utf8');
let chosen=null;
const mapListeners={};
const maker=(lat,lng)=>({lat,lng,getLat:()=>lat,getLng:()=>lng});
let map,ctx;
const kakao={maps:{LatLng:class{constructor(lat,lng){this.lat=lat;this.lng=lng;}getLat(){return this.lat;}getLng(){return this.lng;}},Map:class{constructor(el,options){this.el=el;this.options=options;map=this;}setCenter(x){this.center=x;}},Marker:class{setPosition(x){this.pos=x;}setMap(){}},event:{addListener(m,type,cb){mapListeners.kakao=cb;}},load(resolve){resolve();}}};
const naver={maps:{LatLng:class{constructor(lat,lng){this._lat=lat;this._lng=lng;}lat(){return this._lat;}lng(){return this._lng;}},Map:class{constructor(el,options){map=this;}setCenter(x){}},Marker:class{setPosition(){}},Event:{addListener(m,t,cb){mapListeners.naver=cb;}}}};
const google={maps:{Map:class{constructor(el,o){map=this;}addListener(t,cb){mapListeners.google=cb;}panTo(){}},Marker:class{setPosition(){}}}};
const L={map(el){return {setView(){return this;},on(t,cb){mapListeners.open=cb;},invalidateSize(){},remove(){}};},tileLayer(){return {addTo(){}};},circleMarker(){return {addTo(){return this;},bindPopup(){return this;},setLatLng(){}};}};
const document={querySelectorAll(){return [];},createElement(type){return {tagName:type};},head:{append(el){
  if(el.tagName==='script'){
    queueMicrotask(()=>{
      if(el.src.includes('google'))ctx.window.__yearEndGoogleMapsReady?.();
      el.onload?.();
    });
  }
}}};
ctx={window:{kakao,naver,google,L},document,Promise,Set,Map,Number,Math,Error,encodeURIComponent,setTimeout(cb){cb();}};
vm.createContext(ctx);vm.runInContext(source,ctx);
const common={element:{isConnected:true},keys:{kakaoJavaScriptKey:'key',naverClientId:'key',googleApiKey:'key'},proposals:[],onPick:p=>{chosen=p;}};
for(const provider of ['kakao','naver','google','open']) {
  chosen=null;
  const handle=await ctx.window.SiteMaps.mount({...common,provider});
  assert.ok(handle?.pan,`${provider} map mounted`);
  if(provider==='kakao')mapListeners.kakao({latLng:maker(37.12,127.34)});
  if(provider==='naver')mapListeners.naver({coord:new naver.maps.LatLng(37.12,127.34)});
  if(provider==='google')mapListeners.google({latLng:{lat:()=>37.12,lng:()=>127.34}});
  if(provider==='open')mapListeners.open({latlng:{lat:37.12,lng:127.34}});
  assert.equal(chosen?.lat,37.12,`${provider} marker latitude`);
  assert.equal(chosen?.lng,127.34,`${provider} marker longitude`);
}
console.log('PASS 4 map provider adapters and click coordinates.');
