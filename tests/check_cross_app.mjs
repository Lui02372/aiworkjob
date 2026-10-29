// Optional commonn integration: two real local HTTP servers, fresh vault, synthetic model only.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp as createAiworkjob} from '../server.mjs';
import {createAccountBridge} from '../account-manager.mjs';
import {createStore} from '../commerce.mjs';
const {createApp:createManager}=await import('../../../b/ai-acoountmanager/server.mjs');
const directory=mkdtempSync(path.join(tmpdir(),'aiworkjob-two-apps-'));let calls=0;
const manager=createManager({dataDir:path.join(directory,'vault'),commonRoot:path.join(directory,'shared'),channel:'b',fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:++calls===1?[{type:'function_call',call_id:'fixture_product',name:'create_product',arguments:JSON.stringify({title:'Cross-app draft',content:'Original fixture draft; not a sale or real income.'})}]:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Draft complete. No external action.'}]}]})})});
let app,store;
try{
 manager.service.unlock('fixture-only-master-password',true);
 const account=manager.service.createAccount({label:'Fixture only',provider:'demo',credentials:{username:'fixture-user',password:'fixture-password'}});
 manager.service.createDelegation({accountId:account.id,actions:['login'],perPayment:0,totalBudget:0,purpose:'isolated draft only',expires:new Date(Date.now()+86400000).toISOString()});
 manager.worker.configure({apiKey:'sk-fixture-not-a-real-key',model:'fixture-model'});
 const credential=manager.service.createAgent({label:'aiworkjob fixture',accountIds:[account.id],allowMissions:true,missionCalls:3,dailyCalls:3});
 await new Promise(resolve=>manager.server.listen(0,'127.0.0.1',resolve));
 const managerUrl='http://127.0.0.1:'+manager.server.address().port;
 const bridge=createAccountBridge({env:{AUA_URL:managerUrl,AUA_TOKEN:credential.token}});store=createStore({env:{}});
 app=createAiworkjob({store,accountBridge:bridge});await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.address().port;
 const request=(route,body)=>fetch(base+'/api/account-manager/'+route,{method:body?'POST':'GET',headers:{Origin:base,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const sourceId=randomUUID(),body={workspaceId:sourceId,sourceUrl:'https://himalayas.app/companies/test/jobs/cross-app',goal:'Create one original editorial checklist draft.',accountIds:[account.id],maxCalls:3,aiUsePermission:'allowed',policyNote:'Fixture-only explicit permission.'};
 const caps=await(await request('status')).json();assert.equal(caps.connected,true);assert.equal(caps.canCreate,true);
 const first=await request('missions',body);assert.equal(first.status,201);const started=await first.json();
 const retry=await request('missions',body);assert.equal(retry.status,201,'Retry must reuse the existing mission even when its reservation exhausted the remaining budget');assert.equal((await retry.json()).id,started.id);
 await manager.worker.tick();await manager.worker.tick();
 const missions=await(await request('missions?workspaceId='+sourceId)).json();assert.equal(missions.length,1);assert.equal(missions[0].products.length,1);
 const result=await(await request('missions/'+started.id+'/products/'+missions[0].products[0].id+'?workspaceId='+sourceId)).json();assert.match(result.content,/Original fixture draft/);assert.equal(result.resultType,'draft');assert.equal(result.incomeVerified,false);
 assert.equal(manager.db.prepare('SELECT COUNT(*) n FROM income').get().n,0);
 assert.equal(manager.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 const report={status:'passed',checks:['two real local HTTP servers use the reviewed SDK','scoped fresh-vault mission creation and budget-reserved retry reuse one operation','synthetic model output crosses both servers as a draft','no external account job or income record is created'],count:4,modelCalls:calls,realModelCalls:0,realIncome:0,checkedAt:new Date().toISOString()};
 writeFileSync(new URL('../artifacts/cross-app-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'passed',checks:4,realModelCalls:0,realIncome:0}));
}finally{
 if(app)await new Promise(resolve=>app.close(resolve));store?.close();
 await new Promise(resolve=>manager.server.close(resolve));
 assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));rmSync(directory,{recursive:true,force:true});
}
