// Isolated browser-test server. All payment/model/agent traffic is injected; no real credentials.
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline';
import {createApp} from '../server.mjs';
import {createStore} from '../commerce.mjs';
import {createAccountBridge} from '../account-manager.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'aiworkjob-browser-')),payments=new Map(),missions=new Map(),products=new Map(),accountId=randomUUID();
let store,locked=false;
const caps={contractVersion:1,permissions:['missions:create','missions:read','products:read'],modelConfigured:true,paused:false,modelCallLimits:{perMission:5,daily:20,used:0,reserved:0},modes:['local_product_drafts'],realMoneySpending:false,verifiedIncome:false,publishing:false};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
const agentFetch=async(url,options)=>{
 if(locked)return response({error:'Fixture vault locked'},401);
 const route=new URL(url).pathname;
 if(route==='/api/agent/capabilities')return response(caps);
 if(route==='/api/agent/delegations')return response([{id:randomUUID(),account_id:accountId,account_label:'TEST ONLY delegated account',provider:'local_demo',active:1,expires:new Date(Date.now()+86400000).toISOString(),actions:['login'],per_payment:0,total_budget:0,used:0}]);
 if(route==='/api/agent/missions'&&options.method==='POST'){
  const input=JSON.parse(options.body);if(!missions.has(input.requestKey)){const mid=randomUUID(),pid=randomUUID();missions.set(input.requestKey,{id:mid,source:'aiworkjob',sourceId:input.sourceId,status:'completed',calls:1,maxCalls:input.maxCalls,summary:'TEST ONLY: draft prepared; no sale or income.',products:[{id:pid,title:'Test review draft',created:new Date().toISOString()}]});products.set(pid,{id:pid,title:'Test review draft',content:'# TEST ONLY\n<script>window.__unsafeMissionExecuted=true</script>\nHuman review required. No verified income.',mission_id:mid,created:new Date().toISOString()});}return response(missions.get(input.requestKey),201);
 }
 if(route==='/api/agent/missions')return response([...missions.values()]);
 if(route.startsWith('/api/agent/missions/'))return response([...missions.values()].find(m=>m.id===route.split('/').at(-1))||{},200);
 if(route.startsWith('/api/agent/products/'))return response(products.get(route.split('/').at(-1))||{},200);
 return response({error:'Fixture not found'},404);
};
const bridge=createAccountBridge({env:{AUA_URL:'http://127.0.0.1:8781',AUA_TOKEN:'aua_test_fixture_no_real_credentials'},fetchImpl:agentFetch});
const server=createApp({store:{handle:request=>store.handle(request)},accountBridge:bridge});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
store=createStore({env:{AIWORKJOB_PAYMENT_MODE:'test',AIWORKJOB_PUBLIC_ORIGIN:origin,TOSS_CLIENT_KEY:'test_ck_fixture',TOSS_SECRET_KEY:'test_sk_fixture',AIWORKJOB_ADMIN_TOKEN:'fixture-only-admin-token-long-enough'},dbPath:path.join(directory,'orders.sqlite'),fetchImpl:async(url,options)=>{
 const input=options.body?JSON.parse(options.body):null,key=input?.paymentKey||decodeURIComponent(url.split('/').at(-1));
 if(input&&!payments.has(key)){const waiting=key.startsWith('wait_');payments.set(key,{paymentKey:key,orderId:input.orderId,currency:'KRW',totalAmount:input.amount,balanceAmount:input.amount,status:waiting?'WAITING_FOR_DEPOSIT':'DONE',approvedAt:waiting?null:new Date().toISOString(),secret:'fixture-deposit-secret',virtualAccount:waiting?{accountNumber:'TEST-NO-REAL-ACCOUNT',bankCode:'TEST',dueDate:'2026-10-30T12:00:00+09:00'}:null});}
 return payments.has(key)?response(payments.get(key)):response({error:'not_found'},404);
}});
console.log(JSON.stringify({ready:true,url:origin}));
const input=createInterface({input:process.stdin});let closing=false;
async function close(){if(closing)return;closing=true;input.close();await new Promise(resolve=>server.close(resolve));store.close();if(!path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unsafe temporary path');rmSync(directory,{recursive:true,force:true});process.exit(0);}
input.on('line',line=>{const command=JSON.parse(line);if(command.command==='stop'){close();return;}if(command.command==='payment'){const p=payments.get(command.paymentKey);if(p){p.status=command.status;p.balanceAmount=command.status==='CANCELED'?0:p.totalAmount;p.approvedAt=command.status==='DONE'?new Date().toISOString():p.approvedAt;}}if(command.command==='lock')locked=command.value;console.log(JSON.stringify({ack:command.command}));});
input.on('close',()=>{if(!closing)close();});
