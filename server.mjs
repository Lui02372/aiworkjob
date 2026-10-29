import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {handleApi} from './api.mjs';
const root=new URL('./web/',import.meta.url);
const assets=new Set(['index.html','app.js','catalog.js','domain.js','icons.js','styles.css','icon.svg','deliverable.html','deliverable.js','deliverable.css','snapshot.json','config.js','studio.html','studio.js','studio.css','fonts/PretendardVariable.woff2','fonts/OFL.txt']);
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',json:'application/json',woff2:'font/woff2',txt:'text/plain'};
const port=Number(process.env.AIWORKJOB_PORT||8787);
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  try{
    if(url.pathname==='/aiworkjob-debug.apk'){const data=await readFile(new URL('./aiworkjob-debug.apk',import.meta.url));res.writeHead(200,{'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="aiworkjob-debug.apk"','X-Content-Type-Options':'nosniff'});res.end(data);return;}
    if(url.pathname.startsWith('/api/')){const r=await handleApi(new Request(url,{method:req.method}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;}
    const asset=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
    if(!assets.has(asset)){res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(new URL(asset,root));res.writeHead(200,{'Content-Type':(mime[asset.split('.').pop()]||'application/octet-stream')+'; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache'});res.end(data);
  }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"local_server_error"}');}
});
server.listen(port,'127.0.0.1',()=>console.log('aiworkjob preview http://127.0.0.1:'+port));
