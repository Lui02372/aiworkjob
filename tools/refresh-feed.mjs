import {writeFile} from 'node:fs/promises';
import {handleApi} from '../api.mjs';
const response=await handleApi(new Request('http://local/api/jobs?country=South%20Korea'));
if(!response.ok)throw Error('Official job source is unavailable; no replacement feed published.');
const feed=await response.json();if(!Array.isArray(feed.jobs)||!feed.jobs.length)throw Error('No current jobs returned.');
await writeFile('web/snapshot.json',JSON.stringify(feed));
console.log(JSON.stringify({source:feed.source,jobs:feed.jobs.length,fetchedAt:feed.fetchedAt,partial:feed.partial}));
