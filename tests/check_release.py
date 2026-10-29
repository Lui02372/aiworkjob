"""Start the extracted runtime ZIP rather than the development checkout."""
import hashlib,json,os,socket,subprocess,sys,time,urllib.request,zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
version=sys.argv[1] if len(sys.argv)>1 else json.loads((ROOT/'package.json').read_text())['version']
release=ROOT/'releases'/version
manifest=json.loads((release/'release-manifest.json').read_text(encoding='utf-8'))
checks=[]
for item in manifest['assets']:
    assert hashlib.sha256((release/item['name']).read_bytes()).hexdigest()==item['sha256'],'release checksum mismatch'
checks.append('release asset hashes match manifest')
out=ROOT/'artifacts'/'release-smoke'/f'{version}-{int(time.time())}'
out.mkdir(parents=True)
with zipfile.ZipFile(release/f'aiworkjob-{version}-webapp.zip') as z:
    for member in z.infolist():
        assert (out/member.filename).resolve().is_relative_to(out.resolve()),'unsafe ZIP path'
        assert not member.filename.startswith(('.git/','.openai/','android/')),'unexpected private/build metadata'
    z.extractall(out)
checks.append('runtime ZIP excludes hosting identity and development caches')
with socket.socket() as reservation:
    reservation.bind(('127.0.0.1',0))
    port=reservation.getsockname()[1]
base=f'http://127.0.0.1:{port}'
env={**os.environ,'AIWORKJOB_PORT':str(port)}
process=subprocess.Popen(['node','server.mjs'],cwd=out,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
try:
    for _ in range(40):
        try:
            health=json.load(urllib.request.urlopen(base+'/api/health',timeout=2));break
        except Exception:time.sleep(.25)
    else:raise AssertionError('extracted server did not start')
    assert health['version']==version,'server version disagrees with release'
    checks.append('extracted runtime starts and reports release version')
    with urllib.request.urlopen(base+'/aiworkjob-debug.apk') as r:
        assert r.read(2)==b'PK' and 'android.package-archive' in r.headers['Content-Type']
    checks.append('runtime serves the installable Android APK')
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,channel='chrome')
        page=browser.new_page(viewport={'width':390,'height':844})
        errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
        page.goto(base,wait_until='networkidle')
        page.wait_for_selector('.job-card',timeout=40000)
        expect(page.locator('#bottom-nav')).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        page.screenshot(path=str(ROOT/'artifacts'/f'release-{version}.png'))
        checks.append('extracted web app loads real job cards on mobile without JS errors')
        browser.close()
finally:
    process.terminate()
    try:process.wait(timeout=10)
    except subprocess.TimeoutExpired:process.kill();process.wait()
report={'version':version,'status':'passed','checks':checks,'count':len(checks),'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%S')}
(ROOT/'artifacts'/f'release-{version}-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','version':version,'checks':len(checks)}))
