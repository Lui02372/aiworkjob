"""Exercise a static build under a project subdirectory with no backend API."""
import functools,http.server,json,os,threading,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/pages/'
raw={'title':'TEST Content Creator','companyName':'Static UI fixture','guid':'https://himalayas.app/companies/test/jobs/content-creator','applicationLink':'https://himalayas.app/companies/test/jobs/content-creator?utm_source=api','excerpt':'Test content job.','description':'Content creation for qualified writers.','employmentType':'Contractor','locationRestrictions':[],'timezoneRestrictions':[9],'expiryDate':int(time.time())+86400,'pubDate':int(time.time())}
fixture={'jobs':[raw],'fetchedAt':int(time.time()*1000),'country':'South Korea'}
profile={'version':1,'profile':{'name':'Static tester','tools':['ChatGPT','Canva'],'skills':['콘텐츠 작성'],'categories':['콘텐츠·마케팅'],'country':'South Korea','timezone':9,'level':'실무','years':5,'english':True,'configured':True},'saved':[],'savedJobs':[],'workspaces':[]}
checks=[]
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel=os.environ.get('AIWORKJOB_BROWSER_CHANNEL','chrome') or None)
    context=browser.new_context(viewport={'width':390,'height':844})
    context.add_init_script('localStorage.setItem("aiworkjob.live.v1",'+json.dumps(json.dumps(profile,ensure_ascii=False))+')')
    context.route('**/snapshot.json',lambda route:route.fulfill(json=fixture))
    page=context.new_page();api_requests=[];errors=[]
    page.on('request',lambda req:api_requests.append(req.url) if '/api/' in req.url else None)
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.goto(base,wait_until='networkidle')
    expect(page.locator('.job-card')).to_have_count(1)
    expect(page.locator('.source-status')).to_contain_text('공개 웹 피드')
    checks.append('static app loads attributed jobs without a backend API')
    page.locator('.job-title').click()
    page.locator('#accept-confirm').check()
    page.locator('[data-action="accept"]').click()
    expect(page.locator('#accept-error')).to_contain_text('직접 확인')
    page.locator('#accept-current').check()
    page.locator('[data-action="accept"]').click()
    expect(page.locator('#policy-form')).to_be_visible()
    expect(page.locator('main')).to_contain_text('사용자가 원문 모집 상태를 직접 확인한 기록')
    checks.append('static acceptance requires and labels manual current-source review')
    page.locator('#policy').select_option('allowed')
    page.locator('#policy-note').fill('TEST ONLY client permitted public editorial tools; no private input.')
    page.get_by_role('button',name='조건 저장',exact=True).click()
    page.locator('#draft-title').fill('공개 링크 테스트')
    page.locator('#draft-intro').fill('다른 브라우저에서도 열리는 테스트용 제작 화면입니다.')
    page.locator('#draft-body').fill('직접 확인한 결과\n프로젝트 하위 경로에서도 올바르게 화면을 열 수 있습니다.')
    page.get_by_role('button',name='제작 페이지 만들기').click()
    href=page.get_by_role('link',name='제작 화면 미리보기').get_attribute('href')
    assert href.startswith(base+'deliverable.html#'),href
    checks.append('preview links preserve the project path')
    recipient=browser.new_context()
    recipient_page=recipient.new_page();recipient_page.goto(href,wait_until='networkidle')
    expect(recipient_page.locator('h1')).to_have_text('공개 링크 테스트')
    before=recipient_page.url
    recipient_page.locator('#explore').click()
    assert recipient_page.url==before
    checks.append('recipient with no profile opens the shared page and keeps its payload')
    assert not api_requests,api_requests
    assert not errors,errors
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    checks.append('mobile static flow has no API calls, script errors or overflow')
    (ROOT/'artifacts').mkdir(exist_ok=True)
    page.screenshot(path=str(ROOT/'artifacts/pages.png'))
    browser.close()
finally:server.shutdown();server.server_close()
report={'status':'passed','count':len(checks),'checks':checks,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%S')}
(ROOT/'artifacts/pages-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','checks':len(checks)}))
