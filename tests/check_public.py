"""Check the deployed public URL in a fresh browser without owner authentication."""
import base64,json,time,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
base='https://lui02372.github.io/aiworkjob/'
checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chrome')
 context=browser.new_context(viewport={'width':390,'height':844})
 page=context.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 response=page.goto(base,wait_until='networkidle')
 assert response.status==200
 deployed=page.evaluate("async()=>{const c=await import('./config.js');return {version:c.APP_VERSION,mode:c.FEED_MODE}}")
 expected_version=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
 assert deployed=={'version':expected_version,'mode':'static'},deployed
 checks.append('deployed public configuration matches the release version and static feed mode')
 page.wait_for_selector('.job-card',timeout=30000)
 expect(page.locator('.source-status')).to_contain_text('공개 웹 피드')
 checks.append('public web app opens without owner login and shows current feed data')
 page.locator('.job-card [data-action="save"]').first.click()
 page.reload(wait_until='networkidle')
 assert page.evaluate("JSON.parse(localStorage.getItem('aiworkjob.live.v1')).saved.length")==1
 checks.append('public web saved jobs survive reload')
 page.locator('.job-title').first.click()
 link=page.locator('#dialog .button.outline').get_attribute('href')
 assert link.startswith('https://himalayas.app/companies/')
 expect(page.locator('#accept-current')).to_be_visible()
 checks.append('real application URL and explicit current-source review are available')
 payload={'v':1,'title':'공개 제작 링크 열림 검증','intro':'로그인하지 않은 다른 브라우저에서 제작 화면을 확인합니다.','body':'실행 검증\n기기 내부 프로필이 없는 사용자도 이 화면의 내용을 열어볼 수 있습니다.','template':'app'}
 href=base+'deliverable.html#'+base64.b64encode(json.dumps(payload,ensure_ascii=False).encode()).decode()
 recipient=browser.new_context();preview=recipient.new_page();preview.goto(href,wait_until='networkidle')
 expect(preview.locator('h1')).to_have_text(payload['title'])
 preview.locator('#task-input').fill('공개 화면 기능 확인');preview.locator('#task-form button').click()
 expect(preview.locator('#tasks li')).to_have_count(1)
 checks.append('shared generated app page opens in a separate unauthenticated browser')
 studio_data={'v':1,'id':'public-check-'+uuid.uuid4().hex,'title':'TEST ONLY studio retention','category':'콘텐츠·마케팅','policy':'allowed'}
 studio_url=base+'studio.html#'+base64.b64encode(json.dumps(studio_data,ensure_ascii=False).encode()).decode()
 first=context.new_page();first.goto(studio_url,wait_until='networkidle')
 second=context.new_page();second.goto(studio_url,wait_until='networkidle')
 for tab in (first,second):tab.on('pageerror',lambda err:errors.append(str(err)))
 def add(tab,title):
  tab.locator('#add-row').click()
  tab.locator('#row-title').fill(title)
  tab.locator('#row-context').fill('TEST ONLY separate browser tabs')
  tab.locator('#row-body').fill('Public regression test evidence; no real client or job data.')
  tab.get_by_role('button',name='작업 항목 저장',exact=True).click()
  expect(tab.locator('#edit-dialog')).not_to_be_visible()
 add(first,'Public evidence A')
 expect(second.locator('.studio-row')).to_have_count(1)
 add(second,'Public evidence B')
 expect(first.locator('.studio-row')).to_have_count(2)
 checks.append('deployed studio preserves evidence saved in two browser tabs')
 second.locator('[data-edit="0"]').click()
 second.locator('#row-body').fill('Pending edit in the second public tab.')
 first.locator('[data-edit="0"]').click()
 first.locator('#row-body').fill('Latest review from the first public tab.')
 first.get_by_role('button',name='작업 항목 저장',exact=True).click()
 expect(first.locator('#edit-dialog')).not_to_be_visible()
 second.get_by_role('button',name='작업 항목 저장',exact=True).click()
 expect(second.locator('#row-form .form-error')).to_contain_text('다른 창')
 expect(second.locator('#row-body')).to_have_value('Pending edit in the second public tab.')
 first.reload(wait_until='networkidle')
 expect(first.locator('.studio-row p').first).to_have_text('Latest review from the first public tab.')
 checks.append('deployed studio rejects a conflicting edit while preserving pending input')
 shop=recipient.new_page();shop.goto(base+'store.html',wait_until='networkidle')
 expect(shop.locator('#checkout')).to_be_disabled()
 expect(shop.locator('#purchase-status')).to_contain_text('구매를 접수하지 않습니다')
 sample=recipient.new_page();sample.goto(base+'kit-sample.html',wait_until='networkidle')
 expect(sample.locator('h1')).to_contain_text('확인한 사실')
 checks.append('public product sample opens while unconnected checkout stays disabled')
 assert not errors,errors
 page.locator('#dialog [data-action="close"]').first.click()
 page.screenshot(path=str(ROOT/'artifacts/public-web.png'))
 checks.append('deployed mobile page has no JavaScript errors')
 browser.close()
report={'url':base,'status':'passed','version':json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version'],'count':len(checks),'checks':checks,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%S')}
(ROOT/'artifacts/public-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','checks':len(checks),'url':base}))
