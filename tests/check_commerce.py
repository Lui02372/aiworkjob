"""Exercise real Node routes and browser callback/download flow with injected payments."""
import json,zipfile,io,os
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,FixtureServer,report
checks=[]
sdk="window.TossPayments=()=>({payment:()=>({requestPayment:async request=>{window.checkoutRequest=request;}})});"
with FixtureServer() as server,sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel=os.environ.get('AIWORKJOB_BROWSER_CHANNEL','chrome') or None)
 context=browser.new_context(viewport={'width':1440,'height':1080},accept_downloads=True)
 context.route('https://js.tosspayments.com/v2/standard',lambda route:route.fulfill(body=sdk,content_type='text/javascript'))
 page=context.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.goto(server.url+'store.html',wait_until='networkidle')
 expect(page.locator('#checkout')).to_have_text('테스트 결제하기');expect(page.locator('#sale-mode')).to_contain_text('실제 출금 없음')
 assert page.locator('#contents li').count()==7
 page.screenshot(path=str(ROOT/'artifacts/commerce-desktop.png'),full_page=True)
 checks.append('store explains real product contents, sample, seller and test-only payment state')
 with context.expect_page() as sample_info:page.locator('.sample-link').click()
 sample=sample_info.value;sample.wait_for_load_state('networkidle');expect(sample.locator('h1')).to_contain_text('확인한 사실');sample.close()
 checks.append('sample opens before purchase without collecting payment details')
 def checkout(prefix):
  page.locator('#purchase-consent').check();page.locator('#checkout').click();page.wait_for_function('Boolean(window.checkoutRequest)')
  request=page.evaluate('window.checkoutRequest');assert request['amount']=={'currency':'KRW','value':9900}
  key=prefix+request['orderId'];page.goto(request['successUrl']+'&orderId='+request['orderId']+'&paymentKey='+key+'&amount=9900',wait_until='networkidle')
  expect(page.locator('#check-order')).to_be_visible();return request,key
 request,key=checkout('paid_')
 expect(page.locator('#order-state')).to_contain_text('입금 확인 완료');expect(page.locator('#order-state')).to_contain_text('테스트 주문')
 expect(page.locator('#purchase-status')).not_to_contain_text('구매를 접수하지 않습니다')
 assert 'paymentKey' not in page.url
 checks.append('callback verifies stored server price and removes sensitive redirect parameters')
 with page.expect_download() as download_info:page.locator('#download-order').click()
 download=download_info.value
 with zipfile.ZipFile(download.path()) as z:assert len(z.namelist())==11 and z.testzip() is None
 checks.append('provider-confirmed synthetic payment downloads the actual eleven-file product ZIP')
 page.reload(wait_until='networkidle');expect(page.locator('#download-order')).to_be_visible()
 checks.append('buyer order receipt and authorization survive a page reload')
 # A fresh order returns a deposit account; issuance alone must never unlock the file.
 page.evaluate('window.checkoutRequest=null');page.locator('#payment-method').select_option('VIRTUAL_ACCOUNT')
 request,waiting=checkout('wait_');expect(page.locator('#order-state')).to_contain_text('입금 대기');expect(page.locator('#download-order')).not_to_be_visible()
 checks.append('virtual-account issuance remains waiting with no download or real-income claim')
 invalid=page.request.post(server.url+'api/store/webhook',data={'orderId':request['orderId'],'secret':'wrong','status':'DONE'});assert invalid.status==400
 server.command(command='payment',paymentKey=waiting,status='DONE')
 delivered=page.request.post(server.url+'api/store/webhook',data={'orderId':request['orderId'],'secret':'fixture-deposit-secret','status':'DONE'});assert delivered.status==200
 page.locator('#check-order').click();expect(page.locator('#download-order')).to_be_visible()
 checks.append('verified synthetic deposit webhook refreshes provider status; forged callback is rejected')
 server.command(command='payment',paymentKey=waiting,status='CANCELED')
 page.locator('#download-order').click();expect(page.locator('#download-order')).not_to_be_visible();expect(page.locator('#order-state')).to_contain_text('입금이 확인된')
 checks.append('a cancellation revokes the download even after the purchase page was opened')
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(ROOT/'artifacts/commerce-mobile.png'),full_page=True)
 assert not errors,errors
 checks.append('desktop and 390px mobile store run without overflow or JavaScript errors')
 # The actual Pages output must remain honest and not call a payment backend.
 static=browser.new_context(viewport={'width':390,'height':844});static.route('**/config.js',lambda route:route.fulfill(body=(ROOT/'dist/pages/config.js').read_text(encoding='utf-8'),content_type='text/javascript'))
 public=static.new_page();requests=[];public.on('request',lambda request:requests.append(request.url) if '/api/store/' in request.url else None)
 public.goto(server.url+'store.html',wait_until='networkidle');expect(public.locator('#checkout')).to_be_disabled()
 expect(public.locator('#purchase-status')).to_contain_text('구매를 접수하지 않습니다');assert not requests
 checks.append('static Pages store keeps checkout disabled and sends no payment API requests')
 assert not page.evaluate("Object.values(localStorage).some(value=>value.includes('aua_test_fixture')||value.includes('test_sk_fixture'))")
 checks.append('browser storage contains neither vault tokens nor payment server secrets')
 browser.close()
report('commerce-report.json',checks)
