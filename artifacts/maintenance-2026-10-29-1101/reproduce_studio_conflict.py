"""Reproduce the v0.1.1 defect; optionally pass the URL of an extracted baseline runtime."""
import base64, json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(__file__).resolve().parent
data = {'v': 1, 'id': 'maintenance-conflict-test', 'title': 'TEST ONLY concurrent studio edits',
        'category': '콘텐츠·마케팅', 'policy': 'allowed'}
base = (sys.argv[1] if len(sys.argv) > 1 else 'https://lui02372.github.io/aiworkjob/').rstrip('/') + '/'
url = base + 'studio.html#' + base64.b64encode(
    json.dumps(data, ensure_ascii=False).encode()).decode()

def add(page, title):
    page.locator('#add-row').click()
    page.locator('#row-title').fill(title)
    page.locator('#row-context').fill('TEST ONLY local browser data')
    page.locator('#row-body').fill('Concurrent editing data retention check.')
    page.get_by_role('button', name='작업 항목 저장', exact=True).click()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')
    context = browser.new_context()
    first = context.new_page()
    first.goto(url, wait_until='networkidle')
    assert first.evaluate("async()=>(await import('./config.js')).APP_VERSION") == '0.1.1', 'Serve the v0.1.1 baseline to reproduce the original loss.'
    assert first.locator('#add-row').is_visible()
    second = context.new_page()
    second.goto(url, wait_until='networkidle')
    add(first, 'First tab saved evidence A')
    add(second, 'Second tab saved evidence B')
    first.reload(wait_until='networkidle')
    titles = first.locator('.studio-row h2').all_text_contents()
    report = {'status': 'reproduced' if 'First tab saved evidence A' not in titles else 'not reproduced',
              'url': url.split('#')[0], 'version': '0.1.1',
              'expected': ['First tab saved evidence A', 'Second tab saved evidence B'],
              'actual': titles, 'failure': 'Second stale tab overwrote evidence saved in the first tab.',
              'checkedAt': time.strftime('%Y-%m-%dT%H:%M:%S%z')}
    first.screenshot(path=str(out / 'studio-conflict-before.png'), full_page=True)
    (out / 'studio-conflict-before.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))
    assert report['status'] == 'reproduced'
    browser.close()
