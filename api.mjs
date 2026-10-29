// Shared adapter: Node preview and Cloudflare Worker. Public job data only.
const cache=new Map();
const COUNTRY_SET=new Set(['South Korea','United States','United Kingdom','Canada','Australia','Japan','Germany']);
const QUERIES=['content marketing','graphic designer','video editor','automation developer','research analyst'];
export const FEED_TTL=24*60*60*1000;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
export function checkPath(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='himalayas.app'||u.port||u.username||u.password||!/^\/companies\/[a-zA-Z0-9_%.-]+\/jobs\/[a-zA-Z0-9_%.-]+\/?$/.test(u.pathname))return null;return 'https://himalayas.app/jobs/api'+u.pathname;}catch{return null;}}
async function sourceFetch(url){const response=await fetch(url,{headers:{'User-Agent':'aiworkjob/0.1 (public jobs integration)'},signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error(response.status===429?'source_rate_limited':'source_unavailable');return response.json();}
export async function handleApi(request){
  const url=new URL(request.url);
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  if(url.pathname==='/api/health')return json({service:'aiworkjob',version:'0.1.2',source:'Himalayas',auth:'device-local records',model:'rule-based matching; no hosted LLM'});
  if(url.pathname==='/api/check'){
    const target=checkPath(url.searchParams.get('url'));if(!target)return json({error:'invalid_source_url'},400);
    try{const r=await fetch(target,{signal:AbortSignal.timeout(15000)});if(r.status===410)return json({status:'closed'},410);if(r.status===404)return json({status:'unconfirmed'},404);if(!r.ok)return json({status:'unavailable'},503);const data=await r.json();return json({status:'open',job:data.job});}catch{return json({status:'unavailable'},503);}
  }
  if(url.pathname!=='/api/jobs')return json({error:'not_found'},404);
  const country=url.searchParams.get('country')||'South Korea';if(!COUNTRY_SET.has(country))return json({error:'unsupported_country'},400);
  const cached=cache.get(country);if(cached&&Date.now()-cached.fetchedAt<FEED_TTL)return json({...cached,cached:true,jobs:cached.jobs.filter(j=>j.expiryDate*1000>Date.now())});
  let persistent;
  if(globalThis.caches){persistent=await caches.open('aiworkjob-public-jobs-v1');const stored=await persistent.match(new Request('https://cache.aiworkjob.local/'+encodeURIComponent(country)));if(stored){const c=await stored.json();if(Date.now()-c.fetchedAt<FEED_TTL){cache.set(country,c);return json({...c,cached:true,jobs:c.jobs.filter(j=>j.expiryDate*1000>Date.now())});}}}
  const results=await Promise.allSettled(QUERIES.map(q=>sourceFetch('https://himalayas.app/jobs/api/search?'+new URLSearchParams({q,country,sort:'recent'}))));
  const jobs=new Map();let successes=0;
  for(const result of results)if(result.status==='fulfilled'&&Array.isArray(result.value.jobs)){successes++;for(const j of result.value.jobs)if(checkPath(j.guid)&&checkPath(j.applicationLink)&&j.expiryDate*1000>Date.now())jobs.set(j.guid,j);}
  if(!successes)return json({error:'source_unavailable',jobs:[],source:'Himalayas',sourceUrl:'https://himalayas.app/',fetchedAt:null},503);
  const data={jobs:[...jobs.values()],source:'Himalayas',sourceUrl:'https://himalayas.app/',fetchedAt:Date.now(),country,queries:QUERIES,partial:successes!==QUERIES.length,cached:false};
  cache.set(country,data);if(persistent)await persistent.put(new Request('https://cache.aiworkjob.local/'+encodeURIComponent(country)),new Response(JSON.stringify(data),{headers:{'Cache-Control':'public, max-age=86400'}}));
  return json(data);
}
