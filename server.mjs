import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {handleApi} from './api.mjs';
import {createStore} from './commerce.mjs';
import {createAccountBridge} from './account-manager.mjs';
const root=new URL('./web/',import.meta.url);
const assets=new Set(['index.html','app.js','account-manager-ui.js','catalog.js','domain.js','icons.js','styles.css','icon.svg','deliverable.html','deliverable.js','deliverable.css','snapshot.json','config.js','studio.html','studio.js','studio.css','store.html','store.js','store.css','product.js','kit-sample.html','fonts/PretendardVariable.woff2','fonts/OFL.txt']);
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',json:'application/json',woff2:'font/woff2',txt:'text/plain'};
const port=Number(process.env.AIWORKJOB_PORT||8787);
async function storeBody(req){
 if(['GET','HEAD'].includes(req.method))return undefined;
 return new Promise((resolve,reject)=>{const chunks=[];let size=0;req.on('data',chunk=>{size+=chunk.length;if(size<=16384)chunks.push(chunk);});req.on('end',()=>size>16384?reject(Object.assign(Error('body_too_large'),{status:413})):resolve(Buffer.concat(chunks)));req.on('error',reject);});
}
export function createApp({store=createStore(),accountBridge=createAccountBridge()}={}){
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  try{
    if(url.pathname.startsWith('/api/account-manager/')){const body=await storeBody(req),localPeer=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);const r=await accountBridge.handle(new Request(url,{method:req.method,headers:req.headers,...(body?{body}:{} )}),{localPeer});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;}
    if(url.pathname.startsWith('/api/store/')){const body=await storeBody(req),r=await store.handle(new Request(url,{method:req.method,headers:req.headers,...(body?{body}:{} )}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;}
    if(url.pathname==='/aiworkjob-debug.apk'){const data=await readFile(new URL('./aiworkjob-debug.apk',import.meta.url));res.writeHead(200,{'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="aiworkjob-debug.apk"','X-Content-Type-Options':'nosniff'});res.end(data);return;}
    if(url.pathname.startsWith('/api/')){const r=await handleApi(new Request(url,{method:req.method}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;}
    const asset=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
    if(!assets.has(asset)){res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(new URL(asset,root));res.writeHead(200,{'Content-Type':(mime[asset.split('.').pop()]||'application/octet-stream')+'; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache'});res.end(data);
  }catch(error){res.writeHead(error.status===413?413:500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:error.status===413?'request_too_large':'local_server_error'}));}
});
server.requestTimeout=20000;
return server;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))createApp().listen(port,process.env.AIWORKJOB_HOST||'127.0.0.1',()=>console.log('aiworkjob preview http://127.0.0.1:'+port));
