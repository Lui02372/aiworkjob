import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
const output='dist/pages';await mkdir(output,{recursive:true});
await cp('web',output,{recursive:true});
const config=(await readFile('web/config.js','utf8')).replace("FEED_MODE='api'","FEED_MODE='static'");
await writeFile(output+'/config.js',config);await writeFile(output+'/.nojekyll','');
console.log('Static Pages app prepared at '+output+'; acceptance uses explicit source review.');
