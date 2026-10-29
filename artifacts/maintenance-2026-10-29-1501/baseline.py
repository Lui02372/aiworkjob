"""Read public release bytes and reproduce cross-tab loss in isolated Chrome storage."""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://lui02372.github.io/aiworkjob/').rstrip('/') + '/'
VERSION = '0.1.3'


def download(name):
    url = f'https://github.com/Lui02372/aiworkjob/releases/download/v{VERSION}/{name}'
    with urllib.request.urlopen(url, timeout=60) as response:
        payload = response.read()
        status = response.status
    (OUT / name).write_bytes(payload)
    return {'name': name, 'url': url, 'status': status, 'bytes': len(payload),
            'sha256': hashlib.sha256(payload).hexdigest()}


assets = [download(name) for name in [
    'release-manifest.json', 'SHA256SUMS.txt',
    f'aiworkjob-{VERSION}-android.apk', f'aiworkjob-{VERSION}-webapp.zip']]
manifest = json.loads((OUT / 'release-manifest.json').read_text(encoding='utf-8'))
for item in manifest['assets']:
    actual = next(a for a in assets if a['name'] == item['name'])
    assert actual['sha256'] == item['sha256'] and actual['bytes'] == item['bytes']
(OUT / 'baseline-downloads.json').write_text(json.dumps(assets, indent=2), encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    editor = context.new_page()
    assert editor.goto(BASE, wait_until='networkidle').status == 200
    editor.wait_for_selector('.job-card')
    workspace_id = editor.evaluate("""async () => {
        const d = await import('./domain.js');
        const feed = await (await fetch('snapshot.json')).json();
        const state = d.defaultState();
        const w = d.createWorkspace(feed.jobs[0]);
        w.proposal = 'TEST ONLY saved proposal baseline';
        state.workspaces.push(w);
        localStorage.setItem(d.STORAGE_KEY, JSON.stringify(state));
        return w.id;
    }""")
    editor.goto(BASE + '#workspace/' + workspace_id, wait_until='networkidle')
    editor.reload(wait_until='networkidle')
    other = context.new_page()
    other.goto(BASE, wait_until='networkidle')
    other.wait_for_selector('.job-card')
    pending = 'TEST ONLY unsaved proposal must survive another window saving a job.'
    editor.locator('#proposal').fill(pending)
    before = editor.locator('#proposal').input_value()
    editor.screenshot(path=str(OUT / 'proposal-before.png'))
    other.locator('.job-card [data-action="save"]').first.click()
    editor.wait_for_function("()=>JSON.parse(localStorage.getItem('aiworkjob.live.v1')).saved.length === 1")
    editor.wait_for_timeout(200)
    after = editor.locator('#proposal').input_value()
    editor.screenshot(path=str(OUT / 'proposal-lost.png'))
    report = {'url': BASE, 'version': VERSION, 'reproduced': before != after,
              'before': before, 'after': after, 'isolatedStorage': True,
              'trigger': 'Another tab saves a job while the workspace proposal textarea is focused.'}
    (OUT / 'proposal-loss-before.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    browser.close()
    assert report['reproduced'], report
print(json.dumps({'releaseAssetsVerified': len(assets), 'defectReproduced': True}))
