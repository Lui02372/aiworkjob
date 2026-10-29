"""Verify an in-place APK update preserves data on one explicit emulator."""
import base64,hashlib,json,subprocess,sys,time,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright,expect,Error
ROOT=Path(__file__).resolve().parents[1]
serial=sys.argv[1] if len(sys.argv)>1 else ''
if not serial.startswith('emulator-'):raise SystemExit('Explicit emulator serial required.')
pkg='com.projectlist.aiworkjob';checks=[];warnings=[]
old_version=sys.argv[2] if len(sys.argv)>2 else '0.1.1'
new_version=sys.argv[3] if len(sys.argv)>3 else json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
def adb(*args):return subprocess.check_output(['adb','-s',serial,*args],text=True,encoding='utf-8',timeout=50).strip()
def attach(p):
    adb('shell','am','start','-W','-n',pkg+'/.MainActivity')
    pid=adb('shell','pidof',pkg)
    adb('forward','tcp:9225','localabstract:webview_devtools_remote_'+pid)
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9225',no_defaults=True)
    page=browser.contexts[0].pages[0]
    page.goto('https://app.aiworkjob.local/index.html',wait_until='networkidle')
    page.wait_for_selector('.job-card',timeout=40000)
    return browser,page
old=ROOT/'releases'/old_version/f'aiworkjob-{old_version}-android.apk'
new=ROOT/'releases'/new_version/f'aiworkjob-{new_version}-android.apk'
marker='update-'+uuid.uuid4().hex
marker_key='aiworkjob.update-check.'+marker
studio_key='aiworkjob.studio.'+hashlib.sha256(marker.encode()).digest()[:12].hex()
studio_data={'v':1,'id':marker,'title':'TEST ONLY update persistence','category':'콘텐츠·마케팅','policy':'allowed'}
studio_url='https://app.aiworkjob.local/studio.html#'+base64.b64encode(json.dumps(studio_data,ensure_ascii=False).encode()).decode()
fixture_row={'title':'Update evidence','context':'TEST ONLY local storage','body':'Existing studio evidence must survive an in-place APK update.','source':'','status':'reviewed'}
try:
 with sync_playwright() as p:
    assert adb('shell','getprop','ro.build.version.sdk')=='36','API 36 emulator required'
    adb('install','-r',str(old))
    browser,page=attach(p)
    original=page.evaluate('Object.fromEntries(Object.entries(localStorage))')
    page.evaluate("data=>{localStorage.setItem(data.markerKey,data.marker);localStorage.setItem(data.studioKey,JSON.stringify([data.row]));}",{'markerKey':marker_key,'marker':marker,'studioKey':studio_key,'row':fixture_row})
    saved=page.evaluate('Object.fromEntries(Object.entries(localStorage))')
    page.goto(studio_url,wait_until='networkidle')
    assert page.locator('.studio-row h2').inner_text()==fixture_row['title']
    page.goto('https://app.aiworkjob.local/index.html',wait_until='networkidle')
    # Let WebView commit storage before deliberately stopping/replacing the process.
    adb('shell','input','keyevent','3')
    time.sleep(6)
    browser.close();adb('forward','--remove','tcp:9225')
    adb('shell','am','force-stop',pkg)
    browser,page=attach(p)
    assert page.evaluate('Object.fromEntries(Object.entries(localStorage))')==saved,'old version storage did not survive restart before update'
    checks.append('baseline data persists across process restart before the update')
    browser.close();adb('forward','--remove','tcp:9225')
    adb('install','-r',str(new))
    checks.append(f'{new_version} installs over {old_version} with the existing signature')
    browser,page=attach(p)
    assert page.evaluate('Object.fromEntries(Object.entries(localStorage))')==saved
    checks.append('in-place update preserves all existing browser data, profile and studio records')
    config=page.evaluate("async()=>{const c=await import('./config.js');return {version:c.APP_VERSION,origin:c.HOSTED_ORIGIN,mode:c.FEED_MODE}}")
    assert config['version']==new_version and config['mode']=='api'
    assert config['origin']=='https://lui02372.github.io/aiworkjob/'
    checks.append('updated Android app uses live API mode and the public share origin')
    page.goto(studio_url,wait_until='networkidle')
    assert page.locator('.studio-row h2').inner_text()==fixture_row['title']
    page.locator('[data-edit="0"]').click()
    page.locator('#row-body').fill('Updated Android studio evidence can still be saved and reloaded.')
    page.get_by_role('button',name='작업 항목 저장',exact=True).click()
    expect(page.locator('#edit-dialog')).not_to_be_visible()
    page.reload(wait_until='networkidle')
    assert 'Updated Android studio evidence' in page.locator('.studio-row p').inner_text()
    checks.append('updated Android studio reads existing rows and persists a new edit')
    locks=page.evaluate('typeof navigator.locks?.request')=='function'
    page.evaluate("keys=>{for(const key of keys)localStorage.removeItem(key)}",[marker_key,studio_key])
    assert page.evaluate('Object.fromEntries(Object.entries(localStorage))')==original
    checks.append('temporary test records are removed and all original local data remains unchanged')
    page.goto('https://app.aiworkjob.local/index.html',wait_until='networkidle')
    page.wait_for_selector('.job-card',timeout=40000)
    try:page.screenshot(path=str(ROOT/'artifacts/android-update.png'))
    except Error as err:warnings.append('Optional screenshot unavailable: '+str(err).splitlines()[0])
    if browser.is_connected():browser.close()
finally:
    try:adb('forward','--remove','tcp:9225')
    except subprocess.CalledProcessError:pass
report={'status':'passed','fromVersion':old_version,'version':new_version,'count':len(checks),'checks':checks,'serial':serial,'webLocks':locks,'warnings':warnings,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%S')}
(ROOT/'artifacts/android-update-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','checks':len(checks)}))
