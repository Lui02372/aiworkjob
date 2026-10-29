// Static source map generator. Does not import/execute project modules or read secrets.
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ignored=new Set(['node_modules','.git','dist','worker','build','target','.venv','venv','__pycache__','.gradle','.idea','codevisualization','data']);
const extensions=new Set(['.js','.jsx','.mjs','.cjs','.ts','.tsx','.java','.py','.sql','.css','.html','.json','.yml','.yaml','.md','.ps1','.xml']);
const source=/\.(?:[cm]?js|jsx|tsx?|java|py)$/;
const slash=p=>p.split(path.sep).join('/');
export async function scan(root){
 root=path.resolve(root);const files=[];
 async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink()||e.name.startsWith('.env')||e.name.includes('lock')||e.name.startsWith('.smoke')||e.name.startsWith('.'))continue;const absolute=path.join(dir,e.name);if(e.isDirectory()){if(!ignored.has(e.name))await walk(absolute);}else if(extensions.has(path.extname(e.name))&&!/secret|credential/i.test(e.name))files.push(slash(path.relative(root,absolute)));}}
 await walk(root);files.sort();const known=new Set(files),edges=[],unresolved=[],signals=[];
 function resolve(from,spec){const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));return [base,...['.js','.jsx','.mjs','.cjs','.ts','.tsx','.json','.css','/index.js','/index.jsx','/index.ts','/index.tsx'].map(e=>base+e)].find(p=>known.has(p));}
 for(const file of files.filter(f=>source.test(f))){const text=await readFile(path.join(root,file),'utf8');
  // Intentionally heuristic: report confidence; do not pretend this is an AST/call graph.
  const patterns=[['import',/\b(?:import|export)\s+(?:[\w*$,\s{}]+?\s+from\s*)?["']([^"'\n]+)["']/g],['dynamic-import',/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g],['require',/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g],['file-url',/new\s+URL\(\s*["'](\.[^"']+)["']\s*,\s*import\.meta\.url/g]];
  if(/\.(?:[cm]?js|jsx|tsx?)$/.test(file))for(const[kind,regex]of patterns)for(const m of text.matchAll(regex)){const spec=m[1],line=text.slice(0,m.index).split('\n').length;if(!spec.startsWith('.'))continue;const to=resolve(file,spec);if(to)edges.push({from:file,to,kind,line,confidence:'static-heuristic'});else unresolved.push({from:file,spec,line,kind});}
  for(const[kind,regex]of [['effect',/\buseEffect\s*\(/g],['timer',/\b(?:setInterval|setTimeout)\s*\(/g],['event',/\baddEventListener\s*\(/g],['network',/\b(?:fetch|fetcher)\s*\(/g],['storage',/\b(?:localStorage|sessionStorage)\b/g],['loop',/\b(?:for|while)\s*\(/g]])for(const m of text.matchAll(regex))signals.push({file,kind,line:text.slice(0,m.index).split('\n').length});
 }
 const unique=[...new Map(edges.map(e=>[`${e.from}:${e.to}:${e.kind}:${e.line}`,e])).values()];
 // Tarjan: strongly connected components reveal static dependency cycles, not runtime loops.
 let index=0;const indices=new Map(),low=new Map(),stack=[],onStack=new Set(),cycles=[];const adjacency=new Map(files.map(f=>[f,unique.filter(e=>e.from===f).map(e=>e.to)]));
 function visit(v){indices.set(v,index);low.set(v,index++);stack.push(v);onStack.add(v);for(const w of adjacency.get(v)){if(!indices.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)));}else if(onStack.has(w))low.set(v,Math.min(low.get(v),indices.get(w)));}if(low.get(v)===indices.get(v)){const group=[];let w;do{w=stack.pop();onStack.delete(w);group.push(w);}while(w!==v);if(group.length>1||adjacency.get(v).includes(v))cycles.push(group);}}
 for(const f of files)if(!indices.has(f))visit(f);
 return {generatedAt:new Date().toISOString(),scope:'First-party source inventory; excludes dependencies/builds/secrets/data directories. JS/TS literal relative import/require/file-URL edges only; heuristic, not complete semantic analysis. Java/Python inventoried but not resolved. No runtime connectivity claim.',files,edges:unique,unresolved,signals,cycles};
}
export async function generate(root,out,architecturePath){const graph=await scan(root);let architecture={nodes:[],edges:[]};if(architecturePath)architecture=JSON.parse(await readFile(architecturePath,'utf8'));const ids=new Set(architecture.nodes.map(n=>n.id));for(const e of architecture.edges)if(!ids.has(e.from)||!ids.has(e.to))throw Error('Architecture endpoint missing');for(const n of architecture.nodes)for(const f of n.evidence||[])if(!graph.files.includes(f))throw Error('Evidence file missing: '+f);
 await mkdir(out,{recursive:true});await writeFile(path.join(out,'graph.json'),JSON.stringify({...graph,architecture},null,2));
 const architectureDiagram=['flowchart LR',...architecture.nodes.map((n,i)=>` a${i}["${n.label.replaceAll('"','')} · ${n.status}"]`),...architecture.edges.map(e=>` a${architecture.nodes.findIndex(n=>n.id===e.from)} ${e.status==='planned'?'-.->':'-->'} a${architecture.nodes.findIndex(n=>n.id===e.to)}`)].join('\n');await writeFile(path.join(out,'architecture.mmd'),architectureDiagram);
 const mermaid=['flowchart LR',...graph.files.map((f,i)=>` n${i}["${f.replaceAll('"','')}"]`),...graph.edges.map(e=>` n${graph.files.indexOf(e.from)} -->|${e.kind}| n${graph.files.indexOf(e.to)}`)].join('\n');await writeFile(path.join(out,'files.mmd'),mermaid);
 await writeFile(path.join(out,'README.md'),`# Code Visualization\n\nGenerated: ${graph.generatedAt}\n\nOpen index.html (offline, no CDN). Files: ${graph.files.length}; static edges: ${graph.edges.length}; unresolved: ${graph.unresolved.length}; cycles: ${graph.cycles.length}.\n\n${graph.scope}\n\nView the full graph in graph.json / files.mmd; select a file in HTML for readable incoming/outgoing links. Runtime signals are candidates requiring source review, not proof of scheduled jobs.\n`);
 const template=await readFile(new URL('./codevisualization-viewer.html',import.meta.url),'utf8');await writeFile(path.join(out,'index.html'),template.replace('/*GRAPH_DATA*/',JSON.stringify({...graph,architecture}).replaceAll('<','\\u003c')));return graph;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const root=path.resolve(process.argv[2]||'.'),out=path.resolve(process.argv[3]||path.join(root,'docs/codevisualization'));const graph=await generate(root,out,process.argv[4]);console.log(JSON.stringify({files:graph.files.length,edges:graph.edges.length,unresolved:graph.unresolved.length,cycles:graph.cycles.length,out}));}
