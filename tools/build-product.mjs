import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildKit,kitInfo} from '../product-kit.mjs';
const bytes=buildKit();await mkdir('artifacts/product',{recursive:true});
await writeFile('artifacts/product/'+kitInfo.filename,bytes);
await writeFile('artifacts/product/manifest.json',JSON.stringify({...kitInfo,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');
console.log('실무 키트 생성: '+kitInfo.files.length+'개 파일, '+bytes.length+' bytes (결제·매출 발생 없음)');
