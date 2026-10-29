"""Check the deployed public URL in a fresh browser without owner authentication."""
import base64,json,time
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
 assert not errors,errors
 page.locator('#dialog [data-action="close"]').first.click()
 page.screenshot(path=str(ROOT/'artifacts/public-web.png'))
 checks.append('deployed mobile page has no JavaScript errors')
 browser.close()
report={'url':base,'status':'passed','count':len(checks),'checks':checks,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%S')}
(ROOT/'artifacts/public-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','checks':len(checks),'url':base}))
