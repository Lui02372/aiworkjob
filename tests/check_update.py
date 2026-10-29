"""Verify an in-place APK update preserves data on one explicit emulator."""
import json,subprocess,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
serial=sys.argv[1] if len(sys.argv)>1 else ''
if not serial.startswith('emulator-'):raise SystemExit('Explicit emulator serial required.')
pkg='com.projectlist.aiworkjob';checks=[]
def adb(*args):return subprocess.check_output(['adb','-s',serial,*args],text=True,encoding='utf-8',timeout=50).strip()
def attach(p):
    adb('shell','am','start','-W','-n',pkg+'/.MainActivity')
    pid=adb('shell','pidof',pkg)
    adb('forward','tcp:9225','localabstract:webview_devtools_remote_'+pid)
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9225',no_defaults=True)
    page=browser.contexts[0].pages[0];page.wait_for_selector('.job-card',timeout=40000)
    return browser,page
old=ROOT/'releases/0.1.0/aiworkjob-0.1.0-android.apk'
new=ROOT/'releases/0.1.1/aiworkjob-0.1.1-android.apk'
marker='update-'+str(time.time())
try:
 with sync_playwright() as p:
    adb('install','-r',str(old))
    browser,page=attach(p)
    saved=page.evaluate("localStorage.getItem('aiworkjob.live.v1')")
    page.evaluate("value=>{localStorage.setItem('aiworkjob.update-check',value)}",marker)
    assert page.evaluate("localStorage.getItem('aiworkjob.update-check')")==marker
    # Let WebView commit storage before deliberately stopping/replacing the process.
    adb('shell','input','keyevent','3')
    time.sleep(6)
    browser.close();adb('forward','--remove','tcp:9225')
    adb('shell','am','force-stop',pkg)
    browser,page=attach(p)
    assert page.evaluate("localStorage.getItem('aiworkjob.update-check')")==marker,'old version storage did not survive restart before update'
    checks.append('baseline data persists across process restart before the update')
    browser.close();adb('forward','--remove','tcp:9225')
    adb('install','-r',str(new))
    checks.append('0.1.1 installs over 0.1.0 with the existing signature')
    browser,page=attach(p)
    assert page.evaluate("localStorage.getItem('aiworkjob.update-check')")==marker
    assert page.evaluate("localStorage.getItem('aiworkjob.live.v1')")==saved
    checks.append('in-place update preserves browser data and profile storage')
    config=page.evaluate("async()=>{const c=await import('./config.js');return {version:c.APP_VERSION,origin:c.HOSTED_ORIGIN,mode:c.FEED_MODE}}")
    assert config['version']=='0.1.1' and config['mode']=='api'
    assert config['origin']=='https://lui02372.github.io/aiworkjob/'
    checks.append('updated Android app uses live API mode and the public share origin')
    page.evaluate("localStorage.removeItem('aiworkjob.update-check')")
    page.screenshot(path=str(ROOT/'artifacts/android-update.png'))
    browser.close()
finally:
    try:adb('forward','--remove','tcp:9225')
    except subprocess.CalledProcessError:pass
report={'status':'passed','count':len(checks),'checks':checks,'serial':serial,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%S')}
(ROOT/'artifacts/android-update-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','checks':len(checks)}))
