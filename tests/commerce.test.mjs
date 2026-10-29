import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStore,storeReadiness} from '../commerce.mjs';
import {PRODUCT} from '../web/product.js';
import {buildKit} from '../product-kit.mjs';

function fixture(t,extra={}){
 const directory=mkdtempSync(path.join(tmpdir(),'aiworkjob-commerce-')),calls=[],payments=new Map(),origin='http://127.0.0.1:8787';let time=Date.now(),behavior;
 const env={AIWORKJOB_PAYMENT_MODE:'test',AIWORKJOB_PUBLIC_ORIGIN:origin,TOSS_CLIENT_KEY:'test_ck_fixture',TOSS_SECRET_KEY:'test_sk_fixture',AIWORKJOB_ADMIN_TOKEN:'test-only-admin-token-that-is-long-enough',...extra};
 const fetchImpl=async(url,options)=>{calls.push({url,method:options.method,body:options.body,key:options.headers['Idempotency-Key']});if(behavior)return behavior(url,options);const request=options.body?JSON.parse(options.body):null;const key=request?.paymentKey||decodeURIComponent(url.split('/').at(-1));const payment=payments.get(key);return new Response(JSON.stringify(payment||{error:'not_found'}),{status:payment?200:404});};
 const options={env,fetchImpl,dbPath:path.join(directory,'orders.sqlite'),now:()=>time};let store=createStore(options);
 t.after(()=>{store.close();assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));rmSync(directory,{recursive:true,force:true});});
 const request=(route,{method='GET',body,token,originHeader=origin}={})=>store.handle(new Request(origin+'/api/store/'+route,{method,headers:{Origin:originHeader,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));
 const order=async()=>{const r=await request('orders',{method:'POST',body:{productId:PRODUCT.id,consent:true,amount:1}});assert.equal(r.status,201);return r.json();};
 const payment=(o,status='DONE',key='pay_'+o.orderId)=>{const p={paymentKey:key,orderId:o.orderId,currency:'KRW',totalAmount:PRODUCT.price,balanceAmount:status==='CANCELED'?0:PRODUCT.price,status,approvedAt:status==='DONE'?'2026-10-29T12:00:00+09:00':null,secret:'fixture-webhook-secret',virtualAccount:status==='WAITING_FOR_DEPOSIT'?{accountNumber:'TEST-NOT-A-REAL-ACCOUNT',bankCode:'TEST',dueDate:'2026-10-30T12:00:00+09:00'}:null};payments.set(key,p);return p;};
 const confirm=(o,p,amount=PRODUCT.price)=>request('orders/'+o.orderId+'/confirm',{method:'POST',token:o.orderToken,body:{paymentKey:p.paymentKey,amount}});
 return {env,calls,payments,request,order,payment,confirm,directory,setBehavior:f=>behavior=f,advance:n=>time+=n,restart:()=>{store.close();store=createStore(options);}};
}
test('disabled or incomplete configuration never accepts payments or calls a provider',async()=>{
 let calls=0;const store=createStore({env:{},fetchImpl:()=>{calls++;throw Error();}});
 const config=await(await store.handle(new Request('http://local/api/store/catalog'))).json();assert.equal(config.checkoutAvailable,false);assert.equal(config.mode,'disabled');
 assert.equal((await store.handle(new Request('http://local/api/store/orders',{method:'POST'}))).status,503);assert.equal(calls,0);store.close();
 const info=storeReadiness({AIWORKJOB_PAYMENT_MODE:'live',AIWORKJOB_PUBLIC_ORIGIN:'http://127.0.0.1:8787',TOSS_CLIENT_KEY:'test_ck_fixture',TOSS_SECRET_KEY:'test_sk_fixture'});assert.equal(info.ready,false);assert.ok(info.missing.includes('TOSS_SECRET_KEY'));assert.ok(info.missing.includes('AIWORKJOB_PUBLIC_ORIGIN'));
});
test('orders fix price on the server, require origin and consent, and expose no server secret',async t=>{
 const f=fixture(t);assert.equal((await f.request('orders',{method:'POST',body:{productId:PRODUCT.id,consent:true},originHeader:'https://untrusted.invalid'})).status,403);
 assert.equal((await f.request('orders',{method:'POST',body:{productId:PRODUCT.id,consent:false}})).status,400);
 const order=await f.order();assert.equal(order.amount,9900);assert.equal(order.test,true);assert.equal(order.clientKey,'test_ck_fixture');assert.ok(!JSON.stringify(order).includes('test_sk_fixture'));assert.ok(order.successUrl.startsWith(f.env.AIWORKJOB_PUBLIC_ORIGIN+'/store.html'));
 const raw=readFileSync(path.join(f.directory,'orders.sqlite'));assert.ok(!raw.includes(Buffer.from(order.orderToken)));assert.equal(f.calls.length,0);
});
test('order tokens isolate buyers and never grant unpaid downloads',async t=>{
 const f=fixture(t),a=await f.order(),b=await f.order();
 assert.equal((await f.request('orders/'+a.orderId)).status,404);
 assert.equal((await f.request('orders/'+a.orderId,{token:b.orderToken})).status,404);
 assert.equal((await f.request('orders/'+a.orderId+'/download',{token:a.orderToken})).status,409);
});
test('tampered amount cannot reach payment approval',async t=>{
 const f=fixture(t),o=await f.order(),p=f.payment(o);assert.equal((await f.confirm(o,p,1)).status,400);assert.equal(f.calls.length,0);
});
test('a virtual account waits for actual provider DONE; webhook status text cannot manufacture income',async t=>{
 const f=fixture(t),o=await f.order(),p=f.payment(o,'WAITING_FOR_DEPOSIT');let r=await f.confirm(o,p);assert.equal((await r.json()).downloadAvailable,false);
 assert.equal((await f.request('orders/'+o.orderId+'/download',{token:o.orderToken})).status,409);
 const count=f.calls.length;assert.equal((await f.request('webhook',{method:'POST',body:{orderId:o.orderId,secret:'forged',status:'DONE'}})).status,400);assert.equal(f.calls.length,count);
 assert.equal((await f.request('webhook',{method:'POST',body:{orderId:o.orderId,secret:p.secret,status:'DONE'}})).status,200);
 assert.equal((await(await f.request('orders/'+o.orderId,{token:o.orderToken})).json()).status,'WAITING_FOR_DEPOSIT');
 f.payment(o,'DONE');assert.equal((await f.request('webhook',{method:'POST',body:{orderId:o.orderId,secret:p.secret,status:'DONE'}})).status,200);
 const download=await f.request('orders/'+o.orderId+'/download',{token:o.orderToken});assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),buildKit());
 const summary=await(await f.request('admin/summary',{token:f.env.AIWORKJOB_ADMIN_TOKEN})).json();assert.equal(summary.test.confirmedKRW,9900);assert.equal(summary.live.confirmedKRW,0);assert.equal(summary.settledKRW,null);
});
test('duplicate approvals and webhooks are idempotent; test receipts stay test receipts',async t=>{
 const f=fixture(t),o=await f.order(),p=f.payment(o);assert.equal((await f.confirm(o,p)).status,200);assert.equal((await f.confirm(o,p)).status,200);
 for(let i=0;i<2;i++)assert.equal((await f.request('webhook',{method:'POST',body:{orderId:o.orderId,secret:p.secret}})).status,200);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/confirm')).length,1);
 const summary=await(await f.request('admin/summary',{token:f.env.AIWORKJOB_ADMIN_TOKEN})).json();assert.equal(summary.test.confirmedKRW,PRODUCT.price);assert.equal(summary.live.confirmedKRW,0);assert.equal(summary.settlementConnected,false);
});
test('concurrent approval retries share one upstream call and return independent response bodies',async t=>{
 const f=fixture(t),o=await f.order(),p=f.payment(o);let release;const gate=new Promise(resolve=>release=resolve);
 f.setBehavior(async()=>{await gate;return new Response(JSON.stringify(p));});
 const a=f.confirm(o,p),b=f.confirm(o,p);await new Promise(resolve=>setImmediate(resolve));release();
 const responses=await Promise.all([a,b]);for(const r of responses){assert.equal(r.status,200);assert.equal((await r.json()).status,'DONE');}assert.equal(f.calls.length,1);
});
test('payment keys cannot be replayed across orders',async t=>{
 const f=fixture(t),a=await f.order(),b=await f.order(),p=f.payment(a);assert.equal((await f.confirm(a,p)).status,200);assert.equal((await f.confirm(b,p)).status,409);
});
test('mismatching provider amount/order/currency never unlocks a download',async t=>{
 const f=fixture(t);
 for(const mutation of [{totalAmount:1},{orderId:'another-order'},{currency:'USD'},{balanceAmount:1},{status:'unknown'}]){const o=await f.order(),p=f.payment(o);Object.assign(p,mutation);assert.equal((await f.confirm(o,p)).status,502);assert.notEqual((await(await f.request('orders/'+o.orderId,{token:o.orderToken})).json()).downloadAvailable,true);}
});
test('provider outage fails closed; an approved payment with a lost response reconciles by key',async t=>{
 const f=fixture(t),o=await f.order(),p=f.payment(o);f.setBehavior(()=>{throw Error('synthetic offline');});assert.equal((await f.confirm(o,p)).status,503);
 f.setBehavior((url)=>{if(url.endsWith('/confirm'))throw Error('synthetic lost response');return new Response(JSON.stringify(p));});assert.equal((await f.confirm(o,p)).status,200);
});
test('cancellations revoke future downloads and leave no settled balance',async t=>{
 const f=fixture(t),o=await f.order(),p=f.payment(o);await f.confirm(o,p);f.payment(o,'CANCELED');assert.equal((await f.request('orders/'+o.orderId+'/download',{token:o.orderToken})).status,409);assert.equal((await f.request('admin/summary')).status,403);
 const summary=await(await f.request('admin/summary',{token:f.env.AIWORKJOB_ADMIN_TOKEN})).json();assert.equal(summary.test.confirmedKRW,0);assert.equal(summary.settledKRW,null);
});
test('orders and original product bytes survive a server restart without a plaintext order token',async t=>{
 const f=fixture(t),o=await f.order(),p=f.payment(o);await f.confirm(o,p);f.restart();const r=await f.request('orders/'+o.orderId+'/download',{token:o.orderToken});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),buildKit());
});
test('expired orders and damaged product files cannot be delivered',async t=>{
 const f=fixture(t),expired=await f.order(),p=f.payment(expired);f.advance(31*60*1000);assert.equal((await f.confirm(expired,p)).status,410);
 const o=await f.order(),paid=f.payment(o);await f.confirm(o,paid);const {createHash}=await import('node:crypto');const digest=createHash('sha256').update(buildKit()).digest('hex');writeFileSync(path.join(f.directory,'products',digest+'.zip'),'damaged');assert.equal((await f.request('orders/'+o.orderId+'/download',{token:o.orderToken})).status,503);
});
test('webhook bodies are bounded and wrong methods do not change orders',async t=>{
 const f=fixture(t),o=await f.order();assert.equal((await f.request('webhook',{method:'POST',body:{text:'x'.repeat(17000)}})).status,413);assert.equal((await f.request('orders/'+o.orderId+'/download',{method:'POST',token:o.orderToken,body:{}})).status,405);
});
