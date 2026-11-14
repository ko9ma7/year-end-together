"""Desktop/mobile smoke: private list, invite link, names by date, recovery, closed record."""
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
events={}; responses={}; requests=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 def handle(route):
  req=route.request
  if req.method=='OPTIONS':
   return route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'})
  path=req.url.split('.dev')[-1]
  status=200
  if path=='/':data={'ok':True,'service':'year-end-together-api','routes':['/health','/api/events/:id','/api/recover']}
  elif path=='/api/data':status=403;data={'ok':False,'error':'private'}
  elif path.startswith('/api/events/') and req.method=='GET':
   key=path.split('/')[-1];item=events.get(key)
   if item:data={'ok':True,'event':item,'responses':[r for r in responses.values() if r['eventId']==key]}
   else:status=404;data={'ok':False,'error':'not found'}
  elif path=='/api/events' and req.method=='POST':
   body=req.post_data_json;requests.append({'route':'event','body':body})
   item={k:v for k,v in body.items() if k not in ('password','passwordConfirm','operation')}
   events[body['id']]=item
   data={'ok':True,'id':body['id']}
  elif path=='/api/responses':
   body=req.post_data_json;requests.append({'route':'response','body':body})
   item={k:v for k,v in body.items() if k!='token'}
   item['updatedAt']='2026-11-14T00:00:00Z'
   responses[body['id']]=item
   data={'ok':True,'id':body['id']}
  elif path=='/api/recover':
   body=req.post_data_json
   keys=[]
   for e in events.values():
    if e['title']==body['title']:
     for r in responses.values():
      if r['eventId']==e['id'] and r['name']==body['name'] and sorted(r['dates'])==sorted(body['dates']):keys.append(e['id'])
   if len(set(keys))==1:data={'ok':True,'eventId':keys[0]}
   else:status=404;data={'ok':False,'error':'not found'}
  else:status=404;data={'ok':False,'error':'not found'}
  route.fulfill(status=status,content_type='application/json',body=json.dumps(data,ensure_ascii=False),headers={'Access-Control-Allow-Origin':'*'})
 html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',(root/'index.html').read_text())
 css=(root/'styles.css').read_text(); config=(root/'config.js').read_text(); app=(root/'app.js').read_text()
 def new_page(width):
  ctx=browser.new_context(viewport={'width':width,'height':900})
  ctx.route('https://floral-thunder-c7b0.mullimulli-api.workers.dev/**',handle)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content(html,wait_until='domcontentloaded');page.add_style_tag(content=css)
  page.add_script_tag(content=config);page.add_script_tag(content=app)
  page.wait_for_selector('#recover-form')
  return ctx,page,errors
 # Legacy data already stored before the upgrade: five responses, no browser bookmarks.
 legacy_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 events[legacy_id]={
  'id':legacy_id,'title':'예전 완료 모임','description':'기존 모임 안내','location':'서울',
  'startDate':'2025-11-05','endDate':'2025-12-31','deadline':'2025-11-20',
  'status':'CLOSED','publicNames':False,'allowedDates':[]}
 for n in range(5):
  rid=f'bbbbbbbb-bbbb-4bbb-8bbb-{n+1:012d}'
  responses[rid]={'id':rid,'eventId':legacy_id,'name':f'테스트참여자{n+1}',
    'dates':['2025-11-28','2025-12-05'] if n<4 else ['2025-11-27'],
    'updatedAt':'2025-11-10T09:00:00Z'}
 ctx,page,errors=new_page(1280)
 # An older event that was not in localStorage can be imported by the original invite URL.
 assert page.locator('.event-card').count()==0
 page.fill('#existing-link',f'https://ko9ma7.github.io/year-end-together/#event/{legacy_id}')
 page.locator('#open-existing-form button[type="submit"]').click()
 page.wait_for_function(f"location.hash==='#event/{legacy_id}'",timeout=8000)
 page.get_by_text('예전 완료 모임').first.wait_for(timeout=8000)
 assert page.locator('.participant-list .person').count()==5
 assert page.locator('.winner-summary').get_by_text('테스트참여자1').count()>0
 assert len(responses)==5 and len(events)==1 and not requests, 'import must be read-only'
 page.evaluate("location.hash='#home'")
 page.locator('.event-card').get_by_text('예전 완료 모임').wait_for(timeout=8000)
 # Continue original create/response and privacy tests.
 assert page.locator('.event-card').count()==1, 'only restored event visible on this device'
 page.evaluate("location.hash='#create'")
 page.fill('#ev-title','실제 공유되는 연말 모임')
 page.fill('#ev-start','2026-12-01');page.fill('#ev-end','2026-12-31')
 page.fill('#ev-deadline','2026-12-20')
 page.fill('#ev-admin-key','secure-secret-2026');page.fill('#ev-admin-confirm','secure-secret-2026')
 page.click('#event-save-button')
 page.wait_for_function("location.hash.startsWith('#event/')", timeout=8000)
 key=page.evaluate('location.hash.slice(7)')
 page.locator('[data-action="date"][data-date="2026-12-19"]').click()
 page.locator('[data-action="date"][data-date="2026-12-12"]').click()
 page.fill('#attendee-name','김민수')
 page.locator('#consent').check();page.click('#response-form button[type=submit]')
 page.locator('.winner-summary').wait_for(timeout=8000)
 assert len(responses)==6
 assert page.locator('.result-voters').get_by_text('김민수').count()>0
 assert '2026-12-19' in responses[next(reversed(responses))]['dates']
 ctx2,second,errors2=new_page(375)
 assert second.locator('.event-card').count()==0, 'uninvited separate browser must not see event'
 second.evaluate(f"location.hash='#event/{key}'")
 second.get_by_text('실제 공유되는 연말 모임').first.wait_for(timeout=8000)
 second.locator('.winner-summary').get_by_text('김민수').first.wait_for(timeout=8000)
 overflow=second.evaluate('document.documentElement.scrollWidth - innerWidth')
 assert overflow<=1, f'375px overflow {overflow}'
 second.set_viewport_size({'width':320,'height':800})
 overflow320=second.evaluate('document.documentElement.scrollWidth - innerWidth')
 assert overflow320<=1, f'320px overflow {overflow320}'
 events[key]['status']='CLOSED'
 ctx3,third,errors3=new_page(375)
 third.fill('#recover-title','실제 공유되는 연말 모임')
 third.fill('#recover-name','김민수')
 third.fill('#recover-dates','2026-12-19, 2026-12-12')
 third.locator('#recover-form button[type="submit"]').click()
 third.wait_for_function(f"location.hash==='#event/{key}'",timeout=8000)
 third.get_by_text('참여 마감',exact=True).first.wait_for(timeout=8000)
 third.locator('.winner-summary').get_by_text('김민수').first.wait_for(timeout=8000)
 assert third.locator('#response-form').count()==0, 'closed event shows results only'
 # Regression: mismatched legacy Worker must never cause a false deleted-meeting notice,
 # and the frontend must not fall back to unsafe /api/data (which could prune data).
 legacy_calls=[]
 ctx_legacy=browser.new_context(viewport={'width':375,'height':800})
 def handle_legacy(route):
  path=route.request.url.split('.dev')[-1]
  legacy_calls.append(path)
  if path=='/':
   data={'ok':True,'service':'year-end-together-api','routes':['/health','/api/data']}
   route.fulfill(status=200,content_type='application/json',body=json.dumps(data),headers={'Access-Control-Allow-Origin':'*'})
  else:
   route.fulfill(status=404,content_type='application/json',body=json.dumps({'ok':False,'error':'지원하지 않는 주소 또는 요청 방식입니다.'}),headers={'Access-Control-Allow-Origin':'*'})
 ctx_legacy.route('https://floral-thunder-c7b0.mullimulli-api.workers.dev/**',handle_legacy)
 legacy_page=ctx_legacy.new_page()
 legacy_page.set_content(html,wait_until='domcontentloaded');legacy_page.add_style_tag(content=css)
 legacy_page.evaluate('location.hash="#event/33333333-3333-4333-8333-333333333333"')
 legacy_page.add_script_tag(content=config);legacy_page.add_script_tag(content=app)
 legacy_page.get_by_text('모임이 삭제된 것으로 확인되지 않았습니다.').wait_for(timeout=8000)
 assert '/api/data' not in legacy_calls, 'never call legacy public bulk API, which could delete old rows'
 assert not any(c.startswith('/api/events/') for c in legacy_calls), 'fail safely before querying incompatible legacy API'
 ctx_legacy.close()
 assert not (errors+errors2+errors3),errors+errors2+errors3
 print('PASS browser: private homepage, create, vote, named date breakdown, invite-only details, closed-event recovery, 375/320px overflow',overflow,overflow320)
 browser.close()
