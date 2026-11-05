import json, time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
events=[];responses=[];requests=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':1280,'height':900})
  def handle(route):
   req=route.request
   data=None
   if req.method=='OPTIONS':return route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'})
   if req.url.endswith('/api/data'): data={'ok':True,'events':events,'responses':responses}
   elif req.url.endswith('/api/events'):
    body=req.post_data_json; requests.append({'route':'event','body':body})
    item={k:v for k,v in body.items() if k not in ('password','passwordConfirm','operation')}
    existing=next((i for i,x in enumerate(events) if x['id']==body['id']),None)
    if existing is None:events.append(item)
    else:events[existing]=item
    data={'ok':True,'id':body['id']}
   elif req.url.endswith('/api/responses'):
    body=req.post_data_json;requests.append({'route':'response','body':body})
    item={k:v for k,v in body.items() if k!='token'}
    item['updatedAt']='2026-11-05T03:30:00.000Z'
    item['name']='비공개'
    responses.append(item)
    data={'ok':True,'id':body['id']}
   else:data={'ok':False,'error':'not found'}
   route.fulfill(status=200,content_type='application/json',body=json.dumps(data,ensure_ascii=False),headers={'Access-Control-Allow-Origin':'*'})
  ctx.route('https://floral-thunder-c7b0.mullimulli-api.workers.dev/**',handle)
  page=ctx.new_page();errors=[]
  page.on('pageerror',lambda err: errors.append(str(err)))
  html=(root/'index.html').read_text()
  import re
  html=re.sub(r'<script[^>]*src=\"[^\"]+\"[^>]*></script>','',html)
  page.set_content(html,wait_until='domcontentloaded')
  page.add_style_tag(content=(root/'styles.css').read_text())
  page.add_script_tag(content=(root/'config.js').read_text())
  page.add_script_tag(content=(root/'app.js').read_text())
  page.wait_for_selector('.event-empty')
  page.evaluate("location.hash='#create'")
  page.fill('#ev-title','실제 공유되는 연말 모임')
  page.fill('#ev-start','2026-12-01')
  page.fill('#ev-end','2026-12-31')
  page.fill('#ev-deadline','2026-12-20')
  page.fill('#ev-admin-key','secure-secret-2026')
  page.fill('#ev-admin-confirm','secure-secret-2026')
  page.click('#event-save-button')
  page.wait_for_function("location.hash.startsWith('#event/')", timeout=8000)
  assert requests and requests[0]['body']['password']=='secure-secret-2026'
  assert len(events)==1 and events[0]['title']=='실제 공유되는 연말 모임'
  page.click('[data-action="date"][data-date="2026-12-19"]')
  page.fill('#attendee-name','김민수')
  page.locator('#consent').check()
  page.click('#response-form button[type=submit]')
  page.wait_for_timeout(250)
  assert len(responses)==1, ('responses missing',requests)
  # Another independent page sees shared data from backend
  ctx2=browser.new_context(viewport={'width':375,'height':812})
  ctx2.route('https://floral-thunder-c7b0.mullimulli-api.workers.dev/**',handle)
  second=ctx2.new_page();second.set_content(html,wait_until='domcontentloaded')
  second.add_style_tag(content=(root/'styles.css').read_text())
  second.add_script_tag(content=(root/'config.js').read_text())
  second.add_script_tag(content=(root/'app.js').read_text())
  second.get_by_text('실제 공유되는 연말 모임').first.wait_for(timeout=8000)
  overflow=second.evaluate('document.documentElement.scrollWidth - innerWidth')
  assert overflow<=1, f'overflow {overflow}px'
  second.set_viewport_size({'width':320,'height':800})
  small_overflow=second.evaluate('document.documentElement.scrollWidth - innerWidth')
  assert small_overflow<=1, f'overflow on 320px: {small_overflow}px'
  assert not errors, errors
  print('PASS browser: create event, submit response, independent mobile context sees event, overflow 375px:', overflow, '320px:', small_overflow)
  browser.close()
finally:
 pass
