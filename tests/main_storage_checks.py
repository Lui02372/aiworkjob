"""Real browser concurrency regressions, using only isolated synthetic job records."""
import time
from pathlib import Path

from playwright.sync_api import expect

KEY = 'aiworkjob.live.v1'


def check_main_storage(browser, base):
    raw = {'title': 'TEST ONLY Content Creator', 'companyName': 'Storage regression fixture',
           'guid': 'https://himalayas.app/companies/test/jobs/storage-first',
           'applicationLink': 'https://himalayas.app/companies/test/jobs/storage-first',
           'description': 'Test only content writing, no real application or delivery.',
           'locationRestrictions': [], 'timezoneRestrictions': [9],
           'expiryDate': int(time.time()) + 86400, 'pubDate': int(time.time())}
    second = {**raw, 'guid': raw['guid'] + '-second', 'applicationLink': raw['guid'] + '-second'}
    context = browser.new_context(viewport={'width': 390, 'height': 844})
    context.route('**/snapshot.json', lambda route: route.fulfill(json={
        'jobs': [raw, second], 'country': 'South Korea', 'fetchedAt': int(time.time() * 1000)}))
    checks, errors = [], []

    def open_page(path=''):
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + path, wait_until='networkidle')
        return page

    def saved(page):
        return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))', KEY)

    def proposal_saved(page, value):
        page.wait_for_function('(value)=>JSON.parse(localStorage.getItem("aiworkjob.live.v1")).workspaces[0].proposal===value', arg=value)

    def save_proposal(page):
        page.locator('[data-action="save-proposal"]').click()

    try:
        editor = open_page()
        workspace_id = editor.evaluate("""async raw => {
            const d=await import('./domain.js'); const state=d.defaultState();
            state.profile.configured=true;state.profile.english=true;
            const w=d.createWorkspace(raw);w.proposal='TEST ONLY saved baseline';
            state.workspaces=[w];localStorage.setItem(d.STORAGE_KEY,JSON.stringify(state));return w.id;
        }""", raw)
        workspace = '#workspace/' + workspace_id
        editor.goto(base + workspace, wait_until='networkidle')
        other = open_page()
        pending = 'TEST ONLY proposal kept while another window saves a job.'
        editor.locator('#proposal').fill(pending)
        other.locator(f'[data-action="save"][data-id="{raw["guid"]}"]').click()
        expect(editor.locator('#sync-warning')).to_be_visible()
        expect(editor.locator('#proposal')).to_have_value(pending)
        save_proposal(editor)
        proposal_saved(editor, pending)
        assert saved(editor)['saved'] == [raw['guid']]
        editor.reload(wait_until='networkidle')
        expect(editor.locator('#proposal')).to_have_value(pending)
        checks.append('main workspace keeps pending proposal and merges an independently saved job across tabs and reload')

        other.goto(base + workspace, wait_until='networkidle')
        editor.locator('#proposal').fill('TEST ONLY winning proposal')
        other.locator('#proposal').fill('TEST ONLY conflicting input stays available')
        save_proposal(editor)
        proposal_saved(editor, 'TEST ONLY winning proposal')
        expect(other.locator('#proposal')).to_have_value('TEST ONLY conflicting input stays available')
        save_proposal(other)
        expect(other.locator('#sync-warning')).to_contain_text('같은 기록')
        assert saved(other)['workspaces'][0]['proposal'] == 'TEST ONLY winning proposal'
        expect(other.locator('#proposal')).to_have_value('TEST ONLY conflicting input stays available')
        other.screenshot(path=str(Path(__file__).resolve().parents[1] / 'artifacts/main-storage-conflict.png'))
        checks.append('same-workspace conflict preserves pending input and the other window saved result')

        other.reload(wait_until='networkidle')
        other.locator('#proposal').fill('TEST ONLY quota failure input')
        other.evaluate("()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')};}")
        save_proposal(other)
        expect(other.locator('#storage-warning')).to_be_visible()
        expect(other.locator('#proposal')).to_have_value('TEST ONLY quota failure input')
        assert saved(other)['workspaces'][0]['proposal'] == 'TEST ONLY winning proposal'
        other.evaluate('()=>{Storage.prototype.setItem=window.originalSetItem;}')
        save_proposal(other)
        proposal_saved(other, 'TEST ONLY quota failure input')
        checks.append('main storage failure preserves text, avoids false success and allows a later successful save')

        stale = context.new_page()
        stale.add_init_script("window.addEventListener('storage',event=>event.stopImmediatePropagation())")
        stale.goto(base, wait_until='networkidle')
        other.goto(base, wait_until='networkidle')
        other.locator(f'[data-action="save"][data-id="{second["guid"]}"]').click()
        other.wait_for_function('()=>JSON.parse(localStorage.getItem("aiworkjob.live.v1")).saved.length===2')
        stale.locator(f'[data-action="save"][data-id="{raw["guid"]}"]').click()
        stale.wait_for_function('(id)=>{const s=JSON.parse(localStorage.getItem("aiworkjob.live.v1"));return s.saved.length===1&&s.saved[0]===id}', arg=second['guid'])
        assert [job['guid'] for job in saved(stale)['savedJobs']] == [second['guid']]
        checks.append('missed storage notifications cannot erase a different saved job or leave orphan snapshots')

        other.evaluate("""key=>{window.lockReady=false;navigator.locks.request(key,()=>{
            window.lockReady=true;return new Promise(resolve=>window.releaseMainLock=resolve)});} """, KEY)
        other.wait_for_function('()=>window.lockReady')
        stale.locator(f'[data-action="save"][data-id="{raw["guid"]}"]').click()
        assert stale.evaluate('(key)=>navigator.locks.query().then(s=>s.pending.some(lock=>lock.name===key))', KEY)
        assert len(saved(stale)['saved']) == 1
        other.evaluate("key=>{const s=JSON.parse(localStorage.getItem(key));s.profile.name='TEST locked latest';localStorage.setItem(key,JSON.stringify(s));}", KEY)
        other.evaluate('window.releaseMainLock()')
        stale.wait_for_function('()=>JSON.parse(localStorage.getItem("aiworkjob.live.v1")).saved.length===2')
        assert saved(stale)['profile']['name'] == 'TEST locked latest'
        checks.append('main writes wait for an exclusive browser lock and merge the latest storage inside it')

        editor.goto(base + workspace, wait_until='networkidle')
        other.evaluate("key=>{window.lockReady=false;navigator.locks.request(key,()=>{window.lockReady=true;return new Promise(resolve=>window.releaseMainLock=resolve)});}", KEY)
        other.wait_for_function('()=>window.lockReady')
        editor.locator('#proposal').fill('TEST ONLY text captured at save')
        save_proposal(editor)
        assert editor.evaluate('(key)=>navigator.locks.query().then(s=>s.pending.some(lock=>lock.name===key))', KEY)
        editor.locator('#proposal').fill('TEST ONLY newer input while save waits')
        other.evaluate('window.releaseMainLock()')
        proposal_saved(editor, 'TEST ONLY text captured at save')
        expect(editor.locator('#proposal')).to_have_value('TEST ONLY newer input while save waits')
        assert editor.locator('#proposal').evaluate('(field)=>field.defaultValue') == 'TEST ONLY text captured at save'
        save_proposal(editor)
        proposal_saved(editor, 'TEST ONLY newer input while save waits')
        checks.append('editing during a queued save keeps newer input pending instead of falsely marking it saved')

        editor.goto(base + '#profile', wait_until='networkidle')
        editor.locator('#profile-name').fill('TEST pending profile')
        editor.locator('h1').click()
        stale.locator(f'[data-action="save"][data-id="{raw["guid"]}"]').click()
        expect(editor.locator('#sync-warning')).to_be_visible()
        expect(editor.locator('#profile-name')).to_have_value('TEST pending profile')
        editor.locator('#profile-form button[type="submit"]').click()
        editor.wait_for_function('()=>JSON.parse(localStorage.getItem("aiworkjob.live.v1")).profile.name==="TEST pending profile"')
        assert saved(editor)['saved'] == [second['guid']]
        checks.append('blurred profile edits survive another window update and merge with saved-job changes')

        editor.goto(base + '#profile', wait_until='networkidle')
        other.goto(base + '#profile', wait_until='networkidle')
        editor.locator('#profile-name').fill('TEST profile winner')
        other.locator('#profile-name').fill('TEST profile pending')
        editor.locator('#profile-form button[type="submit"]').click()
        editor.wait_for_function('()=>JSON.parse(localStorage.getItem("aiworkjob.live.v1")).profile.name==="TEST profile winner"')
        other.locator('#profile-form button[type="submit"]').click()
        expect(other.locator('#sync-warning')).to_contain_text('같은 기록')
        expect(other.locator('#profile-name')).to_have_value('TEST profile pending')
        assert saved(other)['profile']['name'] == 'TEST profile winner'
        checks.append('conflicting profile saves retain the pending form without overwriting the newer profile')

        editor.goto(base + workspace, wait_until='networkidle')
        editor.locator('#proposal').fill('TEST ONLY input after another window clears storage')
        other.evaluate('localStorage.clear()')
        expect(editor.locator('#sync-warning')).to_be_visible()
        expect(editor.locator('#proposal')).to_have_value('TEST ONLY input after another window clears storage')
        save_proposal(editor)
        expect(editor.locator('#sync-warning')).to_contain_text('같은 기록')
        assert editor.evaluate('(key)=>localStorage.getItem(key)', KEY) is None
        checks.append('storage clear preserves pending input and stale editing cannot resurrect deleted work')
        assert not errors, errors
        assert editor.evaluate('document.documentElement.scrollWidth<=innerWidth')
        checks.append('mobile main concurrency flow has no script errors or horizontal overflow')
        return checks
    finally:
        context.close()
