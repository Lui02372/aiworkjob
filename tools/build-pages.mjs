import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
const output='dist/pages';await mkdir(output,{recursive:true});
await cp('web',output,{recursive:true});
let config=(await readFile('web/config.js','utf8')).replace("FEED_MODE='api'","FEED_MODE='static'");
if(process.env.AIWORKJOB_CHECKOUT_ORIGIN){const origin=new URL(process.env.AIWORKJOB_CHECKOUT_ORIGIN);if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('Checkout origin must be an HTTPS origin');config=config.replace("CHECKOUT_ORIGIN=''",'CHECKOUT_ORIGIN='+JSON.stringify(origin.origin+'/'));}
await writeFile(output+'/config.js',config);await writeFile(output+'/.nojekyll','');
console.log('Static Pages app prepared at '+output+'; acceptance uses explicit source review.');
