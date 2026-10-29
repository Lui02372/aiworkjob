import {readFile,readdir,mkdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),web=path.join(root,'web'),assets={};
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',json:'application/json',woff2:'font/woff2',txt:'text/plain'};
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,item.name);if(item.isDirectory())await walk(f);else{const rel=path.relative(web,f).replaceAll('\\','/');assets['/'+rel]={type:mime[rel.split('.').pop()]||'application/octet-stream',data:(await readFile(f)).toString('base64')};}}}
await walk(web);
assets['/aiworkjob-debug.apk']={type:'application/vnd.android.package-archive',data:(await readFile(path.join(root,'aiworkjob-debug.apk'))).toString('base64')};
const api=(await readFile(path.join(root,'api.mjs'),'utf8')).replaceAll('export ','');
const worker=`${api}\nconst ASSETS=${JSON.stringify(assets)};\nexport default {async fetch(request){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleApi(request);const asset=ASSETS[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return new Response('Not found',{status:404});return new Response(Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type+'; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache'}});}};\n`;
await mkdir(path.join(root,'worker'),{recursive:true});await mkdir(path.join(root,'dist/server'),{recursive:true});await mkdir(path.join(root,'dist/.openai'),{recursive:true});
await writeFile(path.join(root,'worker/index.js'),worker);await writeFile(path.join(root,'dist/server/index.js'),worker);
const config=JSON.parse((await readFile(path.join(root,'.openai/hosting.json'),'utf8')).replace(/^\uFEFF/,''));
await writeFile(path.join(root,'.openai/hosting.json'),JSON.stringify(config,null,2));
await writeFile(path.join(root,'dist/.openai/hosting.json'),JSON.stringify(config,null,2));
console.log(JSON.stringify({assets:Object.keys(assets).length,workerBytes:Buffer.byteLength(worker),output:'dist/server/index.js'}));
