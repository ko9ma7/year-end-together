/* 모두의 연말 · 지도 SDK 어댑터. 좌표만 저장하며 주소/검색 서비스 키는 저장하지 않습니다. */
(() => {
  'use strict';
  const scriptCache=new Map();
  const baseCenter={lat:37.5665,lng:126.9780};
  function script(url) {
    if(!scriptCache.has(url))scriptCache.set(url,new Promise((resolve,reject)=>{
      const el=document.createElement('script');el.src=url;el.async=true;
      el.onload=resolve;el.onerror=()=>reject(new Error('지도 제공사의 스크립트를 불러오지 못했습니다. 키와 허용 도메인을 확인하세요.'));
      document.head.append(el);
    }));
    return scriptCache.get(url);
  }
  function css(url) {if([...document.querySelectorAll('link[rel=stylesheet]')].some(x=>x.href===url))return;
    const el=document.createElement('link');el.rel='stylesheet';el.href=url;document.head.append(el);}
  function asPoint(p){return {lat:Number(p.lat),lng:Number(p.lng)};}
  function valid(p){return p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && Math.abs(Number(p.lat))<=90 && Math.abs(Number(p.lng))<=180;}
  async function mount({element,provider='open',keys={},proposals=[],picked=null,onPick=()=>{}}) {
    if(!element)return null;
    const center=valid(picked)?asPoint(picked):(proposals.find(valid)?asPoint(proposals.find(valid)):baseCenter);
    const dots=proposals.filter(valid);
    const title=el=>String(el.name||el.placeName||'추천 장소');
    const select=(lat,lng)=>{if(Number.isFinite(lat)&&Number.isFinite(lng))onPick({lat:Number(lat.toFixed(6)),lng:Number(lng.toFixed(6))});};
    if(provider==='kakao') {
      if(!keys.kakaoJavaScriptKey)throw new Error('카카오 지도 JavaScript 키를 config.js에 입력해 주세요.');
      await script('https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(keys.kakaoJavaScriptKey));
      await new Promise(resolve=>window.kakao.maps.load(resolve));
      if(!element.isConnected)return null;
      const k=window.kakao.maps,map=new k.Map(element,{center:new k.LatLng(center.lat,center.lng),level:6});
      dots.forEach(p=>new k.Marker({map,position:new k.LatLng(p.lat,p.lng),title:title(p)}));
      let selected=valid(picked)?new k.Marker({map,position:new k.LatLng(picked.lat,picked.lng)}):null;
      k.event.addListener(map,'click',e=>{
        const pos=e.latLng;
        if(!selected)selected=new k.Marker({map,position:pos});else selected.setPosition(pos);
        select(pos.getLat(),pos.getLng());
      });
      return {pan:(lat,lng)=>map.setCenter(new k.LatLng(lat,lng))};
    }
    if(provider==='naver') {
      if(!keys.naverClientId)throw new Error('네이버 지도 ncpKeyId를 config.js에 입력해 주세요.');
      await script('https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId='+encodeURIComponent(keys.naverClientId));
      if(!element.isConnected)return null;
      const n=window.naver.maps,map=new n.Map(element,{center:new n.LatLng(center.lat,center.lng),zoom:12});
      dots.forEach(p=>new n.Marker({map,position:new n.LatLng(p.lat,p.lng),title:title(p)}));
      let selected=valid(picked)?new n.Marker({map,position:new n.LatLng(picked.lat,picked.lng)}):null;
      n.Event.addListener(map,'click',e=>{
        const pos=e.coord;
        if(!selected)selected=new n.Marker({map,position:pos});else selected.setPosition(pos);
        select(pos.lat(),pos.lng());
      });
      return {pan:(lat,lng)=>map.setCenter(new n.LatLng(lat,lng))};
    }
    if(provider==='google') {
      if(!keys.googleApiKey)throw new Error('구글 Maps JavaScript API 키를 config.js에 입력해 주세요.');
      // Google maps requires an async callback rather than relying solely on script.onload.
      await new Promise((resolve,reject)=>{
        if(window.google?.maps?.Map){resolve();return;}
        const callback='__yearEndGoogleMapsReady';
        window[callback]=()=>{delete window[callback];resolve();};
        script('https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(keys.googleApiKey)+'&loading=async&language=ko&callback='+callback)
          .catch(reject);
      });
      if(!element.isConnected)return null;
      const g=window.google.maps,map=new g.Map(element,{center,zoom:12,mapTypeControl:false});
      dots.forEach(p=>new g.Marker({map,position:asPoint(p),title:title(p)}));
      let selected=valid(picked)?new g.Marker({map,position:asPoint(picked)}):null;
      map.addListener('click',e=>{
        const lat=e.latLng.lat(),lng=e.latLng.lng();
        if(!selected)selected=new g.Marker({map,position:{lat,lng}});else selected.setPosition({lat,lng});
        select(lat,lng);
      });
      return {pan:(lat,lng)=>map.panTo({lat,lng})};
    }
    const cssUrl='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css(cssUrl);
    await script('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    if(!element.isConnected)return null;
    const L=window.L,map=L.map(element,{scrollWheelZoom:false}).setView([center.lat,center.lng],12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
    dots.forEach(p=>L.circleMarker([p.lat,p.lng],{radius:9,color:'#cd7058',fillOpacity:.8}).addTo(map).bindPopup(title(p).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))));
    let selected=valid(picked)?L.circleMarker([picked.lat,picked.lng],{radius:10,color:'#23483e',fillOpacity:.8}).addTo(map):null;
    map.on('click',e=>{
      if(!selected) selected=L.circleMarker(e.latlng,{radius:10,color:'#23483e',fillOpacity:.8}).addTo(map);
      else selected.setLatLng(e.latlng);
      select(e.latlng.lat,e.latlng.lng);
    });
    setTimeout(()=>{if(element.isConnected)map.invalidateSize();},50);
    return {pan:(lat,lng)=>map.setView([lat,lng],15),destroy:()=>map.remove()};
  }
  window.SiteMaps=Object.freeze({mount});
})();
