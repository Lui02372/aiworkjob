"""Read-only source + isolated local state checks on one explicitly selected emulator."""
import json,subprocess,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
serial=sys.argv[1] if len(sys.argv)>1 else ''
if not serial.startswith('emulator-'):raise SystemExit('Provide an explicit emulator serial.')
def adb(*args):return subprocess.check_output(['adb','-s',serial,*args],text=True,encoding='utf-8',timeout=35).strip()
checks=[]
def check(name,value=True):
    assert value,name
    checks.append(name)
pkg='com.projectlist.aiworkjob'
adb('shell','am','start','-W','-n',pkg+'/.MainActivity')
pid=adb('shell','pidof',pkg)
adb('forward','tcp:9224','localabstract:webview_devtools_remote_'+pid)
try:
 with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9224',no_defaults=True)
    page=browser.contexts[0].pages[0]
    page.goto('https://app.aiworkjob.local/index.html',wait_until='networkidle')
    page.wait_for_selector('.job-card',timeout=40000)
    original_state=page.evaluate("localStorage.getItem('aiworkjob.live.v1')")
    installed_version=page.evaluate("async()=>{const c=await import('./config.js');return c.APP_VERSION}")
    expected_version=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
    check('installed Android version matches the source release',installed_version==expected_version)
    check('native bundled interface loads',page.title().startswith('aiworkjob'))
    check('native interface has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    check('native interface does not expose a JS bridge',page.evaluate("typeof window.Android==='undefined'"))
    live=page.evaluate("(async()=>{try{const r=await fetch('/api/jobs?country=South%20Korea');return {status:r.status,data:await r.json()};}catch{return {status:0};}})()")
    check('native collector reads real official jobs',live['status']==200 and len(live['data'].get('jobs',[]))>0)
    actual=live['data']['jobs'][0]
    current=page.evaluate("(async u=>{const r=await fetch('/api/check?'+new URLSearchParams({url:u}));return {code:r.status,data:await r.json()};})",actual['guid'])
    check('native check confirms a currently open actual job',current['code']==200 and current['data']['status']=='open')
    page.locator('.job-card [data-action="save"][aria-pressed="false"]').first.click()
    page.reload(wait_until='networkidle')
    check('native saved job persists after reload',page.evaluate("JSON.parse(localStorage.getItem('aiworkjob.live.v1')).saved.length>0"))
    page.locator('.job-title').first.click()
    expect(page.locator('#dialog')).to_be_visible()
    adb('shell','input','keyevent','4')
    expect(page.locator('#dialog')).not_to_be_visible()
    check('Android back closes the job detail')
    page.locator('#bottom-nav a[href="#profile"]').click()
    expect(page.locator('#profile-form')).to_be_visible()
    check('native bottom navigation opens profile')
    adb('shell','input','keyevent','4')
    page.wait_for_url('**#home')
    check('Android back returns to home')
    # A temporary allowed workspace must still keep vault requests out of Android.
    bridge_requests=[];page.on('request',lambda req:bridge_requests.append(req.url) if '/api/account-manager/' in req.url else None)
    workspace_id=page.evaluate("async raw=>{const d=await import('./domain.js');const s=d.loadState(localStorage.getItem('aiworkjob.live.v1'));const w=d.createWorkspace(raw);w.policy='allowed';w.policyNote='TEST ONLY public draft permission for native connection notice.';s.workspaces.push(w);localStorage.setItem('aiworkjob.live.v1',JSON.stringify(s));return w.id;}",actual)
    page.goto('https://app.aiworkjob.local/index.html#workspace/'+workspace_id,wait_until='networkidle');page.reload(wait_until='networkidle')
    expect(page.locator('.account-manager-panel')).to_contain_text('PC에서 aiworkjob 로컬 서버')
    check('Android allowed workspace explains the local-server bridge without vault requests',not bridge_requests)
    page.goto('https://app.aiworkjob.local/index.html#home',wait_until='networkidle')
    page.evaluate("original=>{if(original===null)localStorage.removeItem('aiworkjob.live.v1');else localStorage.setItem('aiworkjob.live.v1',original);location.reload();}",original_state)
    page.wait_for_selector('.job-card',timeout=35000)
    page.screenshot(path=str(ROOT/'artifacts/android.png'))
    (ROOT/'artifacts/android-report.json').write_text(json.dumps({'status':'passed','version':installed_version,'serial':serial,'checks':checks,'count':len(checks),'officialJobs':len(live['data']['jobs']),'source':'Himalayas','checkedAt':time.strftime('%Y-%m-%dT%H:%M:%S')},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'status':'passed','checks':len(checks),'officialJobs':len(live['data']['jobs'])}))
    browser.close()
finally:adb('forward','--remove','tcp:9224')
