"""Validate scoped mission UI without any real model invocation or external action."""
import json,time,os
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,FixtureServer,report
checks=[]
raw={'title':'TEST Content Creator','companyName':'Fixture only','guid':'https://himalayas.app/companies/test/jobs/content-creator','applicationLink':'https://himalayas.app/companies/test/jobs/content-creator','excerpt':'Test public source','description':'Test content work','employmentType':'Contractor','locationRestrictions':[],'timezoneRestrictions':[9],'expiryDate':int(time.time())+86400,'pubDate':int(time.time())}
with FixtureServer() as server,sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel=os.environ.get('AIWORKJOB_BROWSER_CHANNEL','chrome') or None);context=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
 context.route('**/api/jobs?*',lambda route:route.fulfill(json={'jobs':[raw],'fetchedAt':int(time.time()*1000),'country':'South Korea'}))
 page=context.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.goto(server.url,wait_until='networkidle')
 workspace=page.evaluate("async raw=>{const d=await import('./domain.js');const s=d.defaultState();s.profile.configured=true;s.profile.english=true;const w=d.createWorkspace(raw);s.workspaces.push(w);localStorage.setItem(d.STORAGE_KEY,JSON.stringify(s));return w.id;}",raw)
 page.goto(server.url+'index.html#workspace/'+workspace,wait_until='networkidle')
 expect(page.locator('.account-manager-panel')).to_contain_text('허용 범위와 확인 근거를 먼저 저장')
 checks.append('unknown AI permission blocks the mission flow before connecting to the vault')
 page.evaluate("()=>{const s=JSON.parse(localStorage.getItem('aiworkjob.live.v1'));s.workspaces[0].policy='allowed';s.workspaces[0].policyNote='TEST ONLY explicit client permission to create public drafts.';localStorage.setItem('aiworkjob.live.v1',JSON.stringify(s));}")
 page.reload(wait_until='networkidle');expect(page.locator('[data-mission-create]')).to_be_enabled()
 expect(page.locator('[data-mission-budget]')).to_contain_text('최대 5회')
 page.locator('[data-mission-create]').click();expect(page.locator('[data-mission-message]')).to_contain_text('계정을 선택')
 checks.append('connected screen shows delegated accounts and model budget; account selection is required')
 page.locator('[name="accountId"]').first.check();page.locator('#mission-goal').fill('TEST ONLY prepare an original editorial plan and review checklist.')
 original=page.evaluate("JSON.parse(localStorage.getItem('aiworkjob.live.v1')).workspaces[0]")
 page.locator('[data-mission-create]').click();expect(page.locator('.mission-record')).to_have_count(1)
 page.locator('[data-mission-create]').click();expect(page.locator('.mission-record')).to_have_count(1)
 checks.append('starting and retrying an identical mission keeps one scoped upstream operation')
 page.get_by_role('button',name='Test review draft 열기').click()
 expect(page.locator('#mission-result')).to_have_value('# TEST ONLY\n<script>window.__unsafeMissionExecuted=true</script>\nHuman review required. No verified income.')
 assert page.evaluate('window.__unsafeMissionExecuted') is None
 checks.append('result content is displayed as inert text and labeled an unreviewed draft')
 with page.expect_download() as download_info:page.locator('[data-save-product]').click()
 assert 'Human review' in download_info.value.path().read_text(encoding='utf-8')
 assert page.evaluate("JSON.parse(localStorage.getItem('aiworkjob.live.v1')).workspaces[0]")==original
 checks.append('draft download preserves all workspace, delivery and manual-income fields')
 assert not page.evaluate("Object.values(localStorage).some(value=>value.includes('aua_test_fixture'))")
 assert 'aua_test_fixture' not in page.locator('body').inner_text()
 checks.append('vault token stays out of the browser DOM and storage')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(ROOT/'artifacts/account-manager-mobile.png'),full_page=True)
 server.command(command='lock',value=True);page.locator('[data-mission-refresh]').click();expect(page.locator('[data-mission-message]')).to_contain_text('잠겼거나');expect(page.locator('[data-mission-create]')).to_be_disabled()
 checks.append('vault lock failure is actionable and disables new missions')
 # Actual static build has no bridge traffic and never asks the browser for a token.
 context.route('**/config.js',lambda route:route.fulfill(body=(ROOT/'dist/pages/config.js').read_text(encoding='utf-8'),content_type='text/javascript'))
 calls=[];page.on('request',lambda request:calls.append(request.url) if '/api/account-manager/' in request.url else None)
 page.reload(wait_until='networkidle');expect(page.locator('.account-manager-panel')).to_contain_text('PC에서 aiworkjob 로컬 서버');assert not calls
 assert not errors,errors
 checks.append('Pages output explains local-server requirement with no vault request, overflow or script error')
 browser.close()
report('account-manager-report.json',checks)
