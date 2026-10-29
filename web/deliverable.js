import {escapeHtml as e} from './domain.js';
const out=document.querySelector('#output');
try{
  if(location.hash.length>80000)throw Error('link');
  const decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(location.hash.slice(1)),c=>c.charCodeAt(0))));
  if(decoded.v!==1||!['landing','app','research'].includes(decoded.template)||typeof decoded.title!=='string'||typeof decoded.intro!=='string'||typeof decoded.body!=='string'||decoded.title.length>200||decoded.intro.length>2500||decoded.body.length>10000)throw Error('data');
  document.title=decoded.title+' · aiworkjob 제작 화면';document.body.dataset.template=decoded.template;
  const blocks=decoded.body.split(/\n\s*\n/).filter(Boolean);
  out.innerHTML=`<header><div class="page-label">${decoded.template==='research'?'Research brief':decoded.template==='app'?'Workspace preview':'Made for your next idea'}</div><h1>${e(decoded.title)}</h1><p class="intro">${e(decoded.intro)}</p><button id="explore" class="explore">내용 살펴보기 ↓</button></header><section id="content" class="blocks">${blocks.map((block,i)=>{const [title,...body]=block.split('\n');return `<article><span class="block-index">${String(i+1).padStart(2,'0')}</span><h2>${e(title)}</h2><p>${e(body.join('\n'))}</p></article>`;}).join('')}</section>${decoded.template==='app'?`<section class="task-app"><h2>아이디어를 작업으로</h2><p>이 화면에서 직접 항목을 추가하고 완료할 수 있습니다. 현재 브라우저에만 저장됩니다.</p><form id="task-form"><label for="task-input">새 작업</label><div><input id="task-input" maxlength="150" required placeholder="할 일을 입력하세요"><button type="submit">추가</button></div></form><ul id="tasks"></ul></section>`:''}`;
  document.querySelector('#explore').onclick=()=>document.querySelector('#content').scrollIntoView({behavior:'smooth'});
  if(decoded.template==='app'){
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(location.hash));const key='aiworkjob.output.'+Array.from(new Uint8Array(hash)).slice(0,12).map(v=>v.toString(16).padStart(2,'0')).join('');
    let tasks=[];try{const raw=JSON.parse(localStorage.getItem(key));if(Array.isArray(raw))tasks=raw.filter(v=>v&&typeof v.text==='string'&&v.text.length<=150&&typeof v.done==='boolean').slice(0,100);}catch{}
    const render=()=>{document.querySelector('#tasks').innerHTML=tasks.map((t,i)=>`<li><label><input type="checkbox" data-toggle="${i}" ${t.done?'checked':''}><span>${e(t.text)}</span></label><button data-remove="${i}" aria-label="작업 삭제">×</button></li>`).join('');try{localStorage.setItem(key,JSON.stringify(tasks));}catch{document.querySelector('.task-app>p').textContent='현재 저장 공간을 사용할 수 없어 새로고침하면 작업 항목이 사라집니다.';}};
    document.querySelector('#task-form').addEventListener('submit',event=>{event.preventDefault();const input=document.querySelector('#task-input');if(input.value.trim()&&tasks.length<100){tasks.push({text:input.value.trim(),done:false});input.value='';render();}});
    document.querySelector('#tasks').addEventListener('change',event=>{if(event.target.matches('[data-toggle]')){tasks[Number(event.target.dataset.toggle)].done=event.target.checked;render();}});
    document.querySelector('#tasks').addEventListener('click',event=>{if(event.target.matches('[data-remove]')){tasks.splice(Number(event.target.dataset.remove),1);render();}});render();
  }
}catch{out.innerHTML='<div class="error"><h1>제작 내용을 열 수 없습니다.</h1><p>링크가 잘렸거나 올바르지 않습니다. 작업 페이지에서 미리보기 링크를 다시 만들어 주세요.</p><a href="./index.html">aiworkjob 열기</a></div>';}
document.querySelector('#print').addEventListener('click',()=>window.print());

window.addEventListener('hashchange',()=>location.reload());
