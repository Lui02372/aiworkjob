// Node-only merchant adapter. Never include this module, its database or keys in a Worker.
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {PRODUCT} from './web/product.js';
import {buildKit} from './product-kit.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
class StoreError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new StoreError(status,message);};
export function storeReadiness(env){
 const mode=env.AIWORKJOB_PAYMENT_MODE||'disabled',missing=[];
 if(!['disabled','test','live'].includes(mode))missing.push('AIWORKJOB_PAYMENT_MODE');
 let origin;try{const u=new URL(env.AIWORKJOB_PUBLIC_ORIGIN);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||(u.protocol!=='https:'&&!(mode==='test'&&u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname))))throw Error();origin=u.origin;}catch{missing.push('AIWORKJOB_PUBLIC_ORIGIN');}
 const prefix=mode==='live'?'live':'test';
 if(!new RegExp('^'+prefix+'_ck_[A-Za-z0-9_-]+$').test(env.TOSS_CLIENT_KEY||''))missing.push('TOSS_CLIENT_KEY');
 if(!new RegExp('^'+prefix+'_sk_[A-Za-z0-9_-]+$').test(env.TOSS_SECRET_KEY||''))missing.push('TOSS_SECRET_KEY');
 if(mode==='live'){
  for(const field of ['AIWORKJOB_SELLER_NAME','AIWORKJOB_SELLER_EMAIL','AIWORKJOB_SELLER_BUSINESS_NUMBER','AIWORKJOB_SELLER_ADDRESS','AIWORKJOB_REFUND_POLICY'])if(!env[field]?.trim())missing.push(field);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.AIWORKJOB_SELLER_EMAIL||''))missing.push('valid seller email');
  if(env.AIWORKJOB_LIVE_PAYMENTS_ENABLED!=='yes')missing.push('AIWORKJOB_LIVE_PAYMENTS_ENABLED');
  if((env.AIWORKJOB_ADMIN_TOKEN||'').length<32)missing.push('AIWORKJOB_ADMIN_TOKEN (32+ characters)');
 }
 return {mode,ready:mode!=='disabled'&&missing.length===0,missing,origin};
}
export function createStore({env=process.env,fetchImpl=globalThis.fetch,dbPath,now=Date.now}={}){
 const config=storeReadiness(env),inFlight=new Map();let db;
 const catalog=()=>({product:PRODUCT,mode:config.mode==='live'?'live':config.mode==='test'?'test':'disabled',checkoutAvailable:config.ready,
  seller:config.ready?{name:env.AIWORKJOB_SELLER_NAME||'테스트 상점',email:env.AIWORKJOB_SELLER_EMAIL||'',businessNumber:env.AIWORKJOB_SELLER_BUSINESS_NUMBER||'',address:env.AIWORKJOB_SELLER_ADDRESS||'',refundPolicy:env.AIWORKJOB_REFUND_POLICY||'실제 결제가 발생하지 않는 테스트입니다.'}:null});
 if(config.ready){
  const filename=dbPath||env.AIWORKJOB_STORE_DB||path.resolve('data/store.sqlite');mkdirSync(path.dirname(filename),{recursive:true});
  db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS orders (
   id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, mode TEXT NOT NULL, amount INTEGER NOT NULL,
   product TEXT NOT NULL, product_name TEXT NOT NULL, artifact_hash TEXT NOT NULL, artifact_name TEXT NOT NULL,
   status TEXT NOT NULL DEFAULT 'CREATED', payment_key TEXT UNIQUE, secret_hash TEXT,
   created_at INTEGER NOT NULL, checked_at INTEGER, approved_at TEXT, downloads INTEGER NOT NULL DEFAULT 0,
   verification_seq INTEGER NOT NULL DEFAULT 0, verified_seq INTEGER NOT NULL DEFAULT 0
  )`);
  // Keep the existing orders, tokens and product files when upgrading an older database.
  db.exec('BEGIN IMMEDIATE');
  try{
   const columns=new Set(db.prepare('PRAGMA table_info(orders)').all().map(column=>column.name));
   for(const name of ['verification_seq','verified_seq'])if(!columns.has(name))db.exec('ALTER TABLE orders ADD COLUMN '+name+' INTEGER NOT NULL DEFAULT 0');
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 const productDir=dbPath?path.join(path.dirname(dbPath),'products'):path.join(path.dirname(env.AIWORKJOB_STORE_DB||path.resolve('data/store.sqlite')),'products');
 function artifact(){const bytes=buildKit(),digest=hash(bytes);mkdirSync(productDir,{recursive:true});const filename=path.join(productDir,digest+'.zip');try{writeFileSync(filename,bytes,{flag:'wx',mode:0o600});}catch(err){if(err.code!=='EEXIST')throw err;const existing=readFileSync(filename);if(hash(existing)!==digest)fail(503,'상품 파일을 확인하지 못해 주문을 받지 않습니다.');}return digest;}
 function orderById(id){return db.prepare('SELECT * FROM orders WHERE id=?').get(id);}
 function authorized(request,id){const row=orderById(id),token=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!row||!token||!equal(hash(token),row.token_hash)||row.mode!==config.mode)fail(404,'이 브라우저의 주문을 확인할 수 없습니다. 구매한 브라우저에서 다시 열어 주세요.');return row;}
 async function bodyOf(request){if(!(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))fail(415,'JSON 요청이 필요합니다.');const text=await request.text();if(Buffer.byteLength(text)>16384)fail(413,'요청 내용이 너무 큽니다.');try{const body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}catch{fail(400,'요청 내용을 읽을 수 없습니다.');}}
 async function provider(endpoint,body,idempotencyKey){
  let response,payment;try{response=await fetchImpl('https://api.tosspayments.com/v1/payments'+endpoint,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(env.TOSS_SECRET_KEY+':').toString('base64'),'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});payment=await response.json();}catch{fail(503,'결제사 확인이 지연되고 있습니다. 재결제하지 말고 주문 상태를 다시 확인해 주세요.');}
  if(!response.ok)fail(502,'결제를 확인하지 못했습니다. 재결제 전에 결제 내역과 주문 상태를 확인해 주세요.');return payment;
 }
 // SQLite allocates these across requests and server instances sharing the same DB.
 const beginVerification=row=>db.prepare('UPDATE orders SET verification_seq=verification_seq+1 WHERE id=? RETURNING verification_seq').get(row.id).verification_seq;
 function recordPayment(row,payment,sequence){
  if(!payment||payment.orderId!==row.id||payment.paymentKey!==row.payment_key||payment.currency!=='KRW'||payment.totalAmount!==row.amount||!Number.isSafeInteger(payment.balanceAmount)||payment.balanceAmount<0||payment.balanceAmount>row.amount)fail(502,'결제 정보가 주문과 일치하지 않아 파일을 제공하지 않았습니다.');
  if(!['READY','IN_PROGRESS','WAITING_FOR_DEPOSIT','DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED'].includes(payment.status))fail(502,'확인되지 않은 결제 상태입니다.');
  if(payment.status==='DONE'&&(payment.balanceAmount!==row.amount||!payment.approvedAt))fail(502,'결제 완료 금액을 확인하지 못했습니다.');
  const secretHash=typeof payment.secret==='string'&&payment.secret?hash(payment.secret):null;
  // Only a validated response can advance verified_seq. A later failed lookup must
  // not discard an earlier valid result; an older response must not revive a refund.
  const result=db.prepare('UPDATE orders SET status=?,secret_hash=COALESCE(?,secret_hash),approved_at=?,checked_at=?,verified_seq=? WHERE id=? AND verified_seq<?').run(payment.status,secretHash,payment.approvedAt||null,now(),sequence,row.id,sequence);
  return {row:orderById(row.id),payment:result.changes?payment:null};
 }
 const refresh=async row=>{if(!row.payment_key)return {row,payment:null};const sequence=beginVerification(row);return recordPayment(row,await provider('/'+encodeURIComponent(row.payment_key)),sequence);};
 function view(row,payment){const virtual=payment?.virtualAccount;return {id:row.id,productName:row.product_name,amount:row.amount,currency:'KRW',status:row.status,test:row.mode==='test',downloadAvailable:row.status==='DONE',approvedAt:row.approved_at,checkedAt:row.checked_at,
  ...(row.status==='WAITING_FOR_DEPOSIT'&&virtual?{virtualAccount:{accountNumber:virtual.accountNumber,bankCode:virtual.bankCode,dueDate:virtual.dueDate}}:{})};}
 async function confirm(request,row,body){
  if(!Number.isSafeInteger(body.amount)||body.amount!==row.amount)fail(400,'주문 금액이 일치하지 않습니다. 결제를 다시 진행하지 말고 주문을 확인해 주세요.');
  if(typeof body.paymentKey!=='string'||body.paymentKey.length<1||body.paymentKey.length>200||/[\s\x00-\x1f]/.test(body.paymentKey))fail(400,'결제 식별값이 올바르지 않습니다.');
  if(row.payment_key&&row.payment_key!==body.paymentKey)fail(409,'다른 결제가 연결된 주문입니다.');
  if(row.status==='CREATED'&&now()-row.created_at>30*60*1000)fail(410,'주문 시간이 만료되었습니다. 결제 내역을 확인한 뒤 새 주문을 시작해 주세요.');
  if(inFlight.has(row.id))return json(await inFlight.get(row.id));
  const work=(async()=>{
   if(row.payment_key&&row.status!=='CONFIRMING'){const current=await refresh(row);return view(current.row,current.payment);}
   try{db.prepare("UPDATE orders SET payment_key=?,status='CONFIRMING' WHERE id=?").run(body.paymentKey,row.id);}catch{fail(409,'이미 다른 주문에 사용된 결제입니다.');}
   row=orderById(row.id);let payment,sequence=beginVerification(row);
   try{payment=await provider('/confirm',{paymentKey:body.paymentKey,orderId:row.id,amount:row.amount},row.id);}catch(error){
    // A timeout may occur after approval. Query the same payment; never invent a second order/charge.
    try{sequence=beginVerification(row);payment=await provider('/'+encodeURIComponent(row.payment_key));}catch{throw error;}
   }
   const current=recordPayment(row,payment,sequence);return view(current.row,current.payment);
  })();inFlight.set(row.id,work);try{return json(await work);}finally{inFlight.delete(row.id);}
 }
 let bucket=0,created=0;
 async function handle(request){
  try{
   const url=new URL(request.url),route=url.pathname;
   if(route==='/api/store/catalog'&&request.method==='GET')return json(catalog());
   if(!config.ready)return json({error:'아직 구매를 접수하지 않습니다. 무료 샘플을 먼저 확인해 주세요.'},503);
   if(request.method==='POST'&&route!=='/api/store/webhook'&&request.headers.get('Origin')!==config.origin)fail(403,'구매 페이지에서 다시 시도해 주세요.');
   if(route==='/api/store/orders'&&request.method==='POST'){
    const body=await bodyOf(request);if(body.productId!==PRODUCT.id||body.consent!==true)fail(400,'상품과 이용·제공 조건을 확인해 주세요.');
    const minute=Math.floor(now()/60000);if(bucket!==minute){bucket=minute;created=0;}if(++created>30)fail(429,'주문 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    const digest=artifact(),id='awj_'+randomUUID(),token=randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO orders (id,token_hash,mode,amount,product,product_name,artifact_hash,artifact_name,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id,hash(token),config.mode,PRODUCT.price,PRODUCT.id,PRODUCT.name,digest,PRODUCT.filename,now());
    return json({orderId:id,orderToken:token,clientKey:env.TOSS_CLIENT_KEY,amount:PRODUCT.price,currency:'KRW',orderName:PRODUCT.name,test:config.mode==='test',successUrl:config.origin+'/store.html?payment=success',failUrl:config.origin+'/store.html?payment=fail'},201);
   }
   if(route==='/api/store/webhook'&&request.method==='POST'){
    const payload=await bodyOf(request),body=payload.data||payload,row=typeof body.orderId==='string'?orderById(body.orderId):null;
    if(!row||row.mode!==config.mode||!row.secret_hash||typeof body.secret!=='string'||!equal(hash(body.secret),row.secret_hash))fail(400,'웹훅을 확인하지 못했습니다.');
    await refresh(row);return json({received:true});
   }
   if(route==='/api/store/admin/summary'&&request.method==='GET'){
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!env.AIWORKJOB_ADMIN_TOKEN||!token||!equal(token,env.AIWORKJOB_ADMIN_TOKEN))fail(403,'운영자 인증이 필요합니다.');
    const totals=db.prepare("SELECT mode,COUNT(*) AS orders,COALESCE(SUM(CASE WHEN status='DONE' THEN amount ELSE 0 END),0) AS confirmedKRW FROM orders GROUP BY mode").all();
    return json({basis:'last-provider-verification',test:totals.find(r=>r.mode==='test')||{orders:0,confirmedKRW:0},live:totals.find(r=>r.mode==='live')||{orders:0,confirmedKRW:0},settlementConnected:false,settledKRW:null});
   }
   const match=route.match(/^\/api\/store\/orders\/(awj_[a-f0-9-]{36})(?:\/(confirm|download))?$/);
   if(match){
    const row=authorized(request,match[1]);
    if(match[2]==='confirm'&&request.method==='POST')return await confirm(request,row,await bodyOf(request));
    if(request.method==='GET'&&!match[2]){const current=await refresh(row);return json(view(current.row,current.payment));}
    if(request.method==='GET'&&match[2]==='download'){
     const current=await refresh(row);if(current.row.status!=='DONE')fail(409,'입금이 확인된 주문만 다운로드할 수 있습니다.');
     const file=readFileSync(path.join(productDir,row.artifact_hash+'.zip'));if(hash(file)!==row.artifact_hash)fail(503,'상품 파일을 확인하지 못했습니다. 판매자에게 문의해 주세요.');
     db.prepare('UPDATE orders SET downloads=downloads+1 WHERE id=?').run(row.id);
     return new Response(file,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+row.artifact_name+'"','Content-Length':String(file.length),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
    }
    fail(405,'지원하지 않는 요청입니다.');
   }
   fail(404,'요청한 판매 기능을 찾을 수 없습니다.');
  }catch(error){return json({error:error instanceof StoreError?error.message:'주문을 처리하지 못했습니다. 재결제 전에 주문 내역을 확인해 주세요.'},error instanceof StoreError?error.status:500);}
 }
 return {handle,catalog,readiness:config,close:()=>db?.close()};
}
