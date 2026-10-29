import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {createStore,storeReadiness} from '../commerce.mjs';
import {PRODUCT} from '../web/product.js';
import {buildKit} from '../product-kit.mjs';

function fixture(t,extra={}){
 const directory=mkdtempSync(path.join(tmpdir(),'aiworkjob-commerce-')),calls=[],payments=new Map(),origin='http://127.0.0.1:8787';let time=Date.now(),behavior;
 const env={AIWORKJOB_PAYMENT_MODE:'test',AIWORKJOB_PUBLIC_ORIGIN:origin,TOSS_CLIENT_KEY:'test_ck_fixture',TOSS_SECRET_KEY:'test_sk_fixture',AIWORKJOB_ADMIN_TOKEN:'test-only-admin-token-that-is-long-enough',...extra};
 const fetchImpl=async(url,options)=>{calls.push({url,method:options.method,body:options.body,key:options.headers['Idempotency-Key']});if(behavior)return behavior(url,options);const request=options.body?JSON.parse(options.body):null;const key=request?.paymentKey||decodeURIComponent(url.split('/').at(-1));const payment=payments.get(key);return new Response(JSON.stringify(payment||{error:'not_found'}),{status:payment?200:404});};
 const options={env,fetchImpl,dbPath:path.join(directory,'orders.sqlite'),now:()=>time},peers=[];let store=createStore(options);
 t.after(()=>{for(const peer of peers)peer.close();store.close();assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));rmSync(directory,{recursive:true,force:true});});
 const request=(route,{method='GET',body,token,originHeader=origin,instance=store}={})=>instance.handle(new Request(origin+'/api/store/'+route,{method,headers:{Origin:originHeader,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));
 const order=async()=>{const r=await request('orders',{method:'POST',body:{productId:PRODUCT.id,consent:true,amount:1}});assert.equal(r.status,201);return r.json();};
 const payment=(o,status='DONE',key='pay_'+o.orderId)=>{const p={paymentKey:key,orderId:o.orderId,currency:'KRW',totalAmount:PRODUCT.price,balanceAmount:status==='CANCELED'?0:PRODUCT.price,status,approvedAt:status==='DONE'?'2026-10-29T12:00:00+09:00':null,secret:'fixture-webhook-secret',virtualAccount:status==='WAITING_FOR_DEPOSIT'?{accountNumber:'TEST-NOT-A-REAL-ACCOUNT',bankCode:'TEST',dueDate:'2026-10-30T12:00:00+09:00'}:null};payments.set(key,p);return p;};
 const confirm=(o,p,amount=PRODUCT.price)=>request('orders/'+o.orderId+'/confirm',{method:'POST',token:o.orderToken,body:{paymentKey:p.paymentKey,amount}});
 return {env,calls,payments,request,order,payment,confirm,directory,setBehavior:f=>behavior=f,advance:n=>time+=n,restart:()=>{store.close();store=createStore(options);},openPeer:()=>{const peer=createStore(options);peers.push(peer);return peer;}};
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

test('overlapping order checks cannot restore DONE after a newer verified cancellation',async t=>{
 const f=fixture(t),o=await f.order(),paid=f.payment(o);await f.confirm(o,paid);
 let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
 let calls=0;const canceled={...paid,status:'CANCELED',balanceAmount:0};
 f.setBehavior(async()=>{if(++calls===1){started();await gate;return Response.json(paid);}return Response.json(canceled);});
 const earlier=f.request('orders/'+o.orderId,{token:o.orderToken});await ready;
 try{
  assert.equal((await f.request('webhook',{method:'POST',body:{orderId:o.orderId,secret:paid.secret}})).status,200);
 }finally{release();}
 const response=await earlier;assert.equal(response.status,200);const receipt=await response.json();
 assert.equal(receipt.status,'CANCELED');assert.equal(receipt.downloadAvailable,false);
 const summary=await(await f.request('admin/summary',{token:f.env.AIWORKJOB_ADMIN_TOKEN})).json();
 assert.equal(summary.test.confirmedKRW,0);assert.equal(summary.live.confirmedKRW,0);assert.equal(summary.settledKRW,null);
 f.restart();assert.equal((await(await f.request('admin/summary',{token:f.env.AIWORKJOB_ADMIN_TOKEN})).json()).test.confirmedKRW,0);
});

test('overlapping download verification cannot deliver bytes after a newer verified cancellation',async t=>{
 const f=fixture(t),o=await f.order(),paid=f.payment(o);await f.confirm(o,paid);
 let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
 let calls=0;const canceled={...paid,status:'CANCELED',balanceAmount:0};
 f.setBehavior(async()=>{if(++calls===1){started();await gate;return Response.json(paid);}return Response.json(canceled);});
 const download=f.request('orders/'+o.orderId+'/download',{token:o.orderToken});await ready;
 try{assert.equal((await(await f.request('orders/'+o.orderId,{token:o.orderToken})).json()).status,'CANCELED');}finally{release();}
 const response=await download;assert.equal(response.status,409);assert.match(response.headers.get('Content-Type'),/application\/json/);
 const summary=await(await f.request('admin/summary',{token:f.env.AIWORKJOB_ADMIN_TOKEN})).json();assert.equal(summary.test.confirmedKRW,0);
});

test('overlapping approval response cannot restore a payment canceled by a later provider check',async t=>{
 const f=fixture(t),o=await f.order(),paid=f.payment(o);
 let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
 const canceled={...paid,status:'CANCELED',balanceAmount:0};
 f.setBehavior(async(url)=>{if(url.endsWith('/confirm')){started();await gate;return Response.json(paid);}return Response.json(canceled);});
 const approval=f.confirm(o,paid);await ready;
 try{assert.equal((await(await f.request('orders/'+o.orderId,{token:o.orderToken})).json()).status,'CANCELED');}finally{release();}
 const response=await approval;assert.equal(response.status,200);const receipt=await response.json();assert.equal(receipt.status,'CANCELED');assert.equal(receipt.downloadAvailable,false);
 assert.equal(f.calls.filter(call=>call.method==='POST').length,1);
});

test('a later failed verification does not discard an earlier successful provider response',async t=>{
 const f=fixture(t),o=await f.order(),paid=f.payment(o);await f.confirm(o,paid);
 let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
 let calls=0;const canceled={...paid,status:'CANCELED',balanceAmount:0};
 f.setBehavior(async()=>{if(++calls===1){started();await gate;return Response.json(canceled);}throw Error('TEST ONLY later provider outage');});
 const earlier=f.request('orders/'+o.orderId,{token:o.orderToken});await ready;
 try{assert.equal((await f.request('orders/'+o.orderId,{token:o.orderToken})).status,503);}finally{release();}
 assert.equal((await(await earlier).json()).status,'CANCELED');
 const summary=await(await f.request('admin/summary',{token:f.env.AIWORKJOB_ADMIN_TOKEN})).json();assert.equal(summary.test.confirmedKRW,0);
});

test('overlapping verification across server instances sharing a DB cannot restore a canceled download',async t=>{
 const f=fixture(t),o=await f.order(),paid=f.payment(o);await f.confirm(o,paid);const peer=f.openPeer();
 let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
 let calls=0;const canceled={...paid,status:'CANCELED',balanceAmount:0};
 f.setBehavior(async()=>{if(++calls===1){started();await gate;return Response.json(paid);}return Response.json(canceled);});
 const download=f.request('orders/'+o.orderId+'/download',{token:o.orderToken});await ready;
 try{assert.equal((await(await f.request('orders/'+o.orderId,{token:o.orderToken,instance:peer})).json()).status,'CANCELED');}finally{release();}
 assert.equal((await download).status,409);
 assert.equal((await(await f.request('admin/summary',{token:f.env.AIWORKJOB_ADMIN_TOKEN,instance:peer})).json()).test.confirmedKRW,0);
});

test('a newer invalid provider payload does not suppress an earlier valid cancellation',async t=>{
 const f=fixture(t),o=await f.order(),paid=f.payment(o);await f.confirm(o,paid);
 let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
 let calls=0;const canceled={...paid,status:'CANCELED',balanceAmount:0};
 f.setBehavior(async()=>{if(++calls===1){started();await gate;return Response.json(canceled);}return Response.json({...paid,totalAmount:1});});
 const earlier=f.request('orders/'+o.orderId,{token:o.orderToken});await ready;
 try{assert.equal((await f.request('orders/'+o.orderId,{token:o.orderToken})).status,502);}finally{release();}
 assert.equal((await(await earlier).json()).status,'CANCELED');
});

test('a delayed verification for one order does not block another order',async t=>{
 const f=fixture(t),a=await f.order(),b=await f.order(),paidA=f.payment(a),paidB=f.payment(b);await f.confirm(a,paidA);await f.confirm(b,paidB);
 let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
 f.setBehavior(async(url)=>{if(url.endsWith(paidA.paymentKey)){started();await gate;return Response.json(paidA);}return Response.json({...paidB,status:'CANCELED',balanceAmount:0});});
 const pending=f.request('orders/'+a.orderId,{token:a.orderToken});await ready;
 try{assert.equal((await(await f.request('orders/'+b.orderId,{token:b.orderToken})).json()).status,'CANCELED');}finally{release();}
 assert.equal((await(await pending).json()).status,'DONE');
});

test('a newer payload without a webhook secret preserves the hash saved by an overlapping approval',async t=>{
 const f=fixture(t),o=await f.order(),paid=f.payment(o);
 let releaseApproval,releaseCheck,startApproval,startCheck;
 const approvalGate=new Promise(resolve=>releaseApproval=resolve),checkGate=new Promise(resolve=>releaseCheck=resolve);
 const approvalReady=new Promise(resolve=>startApproval=resolve),checkReady=new Promise(resolve=>startCheck=resolve);
 f.setBehavior(async(url)=>{if(url.endsWith('/confirm')){startApproval();await approvalGate;return Response.json(paid);}startCheck();await checkGate;return Response.json({...paid,secret:undefined});});
 const approval=f.confirm(o,paid);await approvalReady;
 const check=f.request('orders/'+o.orderId,{token:o.orderToken});await checkReady;
 try{releaseApproval();assert.equal((await approval).status,200);releaseCheck();assert.equal((await check).status,200);}finally{releaseApproval();releaseCheck();}
 f.setBehavior(()=>Response.json({...paid,status:'CANCELED',balanceAmount:0}));
 assert.equal((await f.request('webhook',{method:'POST',body:{orderId:o.orderId,secret:paid.secret}})).status,200);
 assert.equal((await(await f.request('orders/'+o.orderId,{token:o.orderToken})).json()).status,'CANCELED');
});

test('upgrading the released legacy order schema preserves receipts, hashed tokens and product bytes',async t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'aiworkjob-legacy-orders-')),filename=path.join(directory,'orders.sqlite');let store;
 t.after(()=>{store?.close();assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));rmSync(directory,{recursive:true,force:true});});
 const db=new DatabaseSync(filename);
 db.exec(`CREATE TABLE orders (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, mode TEXT NOT NULL, amount INTEGER NOT NULL,
  product TEXT NOT NULL, product_name TEXT NOT NULL, artifact_hash TEXT NOT NULL, artifact_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED', payment_key TEXT UNIQUE, secret_hash TEXT,
  created_at INTEGER NOT NULL, checked_at INTEGER, approved_at TEXT, downloads INTEGER NOT NULL DEFAULT 0
 )`);
 const digest=value=>createHash('sha256').update(value).digest('hex'),bytes=buildKit(),token='TEST ONLY previous buyer token',orderId='awj_00000000-0000-4000-8000-000000000001';
 db.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(orderId,digest(token),'test',PRODUCT.price,PRODUCT.id,PRODUCT.name,digest(bytes),PRODUCT.filename,'DONE','legacy-payment',digest('TEST ONLY webhook secret'),123,456,'2026-10-29T12:00:00+09:00',7);
 const before={...db.prepare('SELECT * FROM orders').get()};db.close();
 const {mkdirSync}=await import('node:fs');mkdirSync(path.join(directory,'products'));writeFileSync(path.join(directory,'products',digest(bytes)+'.zip'),bytes);
 const env={AIWORKJOB_PAYMENT_MODE:'test',AIWORKJOB_PUBLIC_ORIGIN:'http://127.0.0.1:8787',TOSS_CLIENT_KEY:'test_ck_fixture',TOSS_SECRET_KEY:'test_sk_fixture'};
 const payment={orderId,paymentKey:'legacy-payment',currency:'KRW',totalAmount:PRODUCT.price,balanceAmount:PRODUCT.price,status:'DONE',approvedAt:before.approved_at};
 store=createStore({env,dbPath:filename,fetchImpl:async()=>Response.json(payment)});
 const inspect=new DatabaseSync(filename),after={...inspect.prepare('SELECT * FROM orders').get()};
 for(const [key,value] of Object.entries(before))assert.equal(after[key],value,key);
 assert.equal(after.verification_seq,0);assert.equal(after.verified_seq,0);inspect.close();
 const response=await store.handle(new Request(env.AIWORKJOB_PUBLIC_ORIGIN+'/api/store/orders/'+orderId+'/download',{headers:{Authorization:'Bearer '+token}}));
 assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 store.close();store=createStore({env,dbPath:filename,fetchImpl:async()=>Response.json(payment)});
 const reopened=new DatabaseSync(filename),row=reopened.prepare('SELECT * FROM orders').get();reopened.close();
 assert.equal(row.token_hash,before.token_hash);assert.equal(row.secret_hash,before.secret_hash);assert.equal(row.downloads,8);assert.equal(row.verification_seq,1);assert.equal(row.verified_seq,1);
});
