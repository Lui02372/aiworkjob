import {FEED_MODE} from './config.js';
import {escapeHtml as e} from './domain.js';
const stateNames={queued:'대기 중',running:'진행 중',completed:'초안 생성 완료',failed:'실행 실패',paused:'일시 정지'};
export function mountAccountManager(main,workspace){
 const panel=document.createElement('section');panel.className='page-panel account-manager-panel';panel.innerHTML='<h2>계정 관리자에게 초안 맡기기</h2><p class="small-text">이미 위임한 계정 범위와 모델 호출 한도 안에서 작업 초안을 준비합니다. 결과물은 직접 검토하며, 지원·납품·매출 기록은 자동으로 바꾸지 않습니다.</p><div class="notice" role="status" data-mission-message></div>';
 (main.querySelector('.workspace-grid>div')||main).append(panel);
 const message=text=>{panel.querySelector('[data-mission-message]').textContent=text;};
 if(workspace.policy!=='allowed'){message('작업 페이지에서 AI 사용 허용 범위와 확인 근거를 먼저 저장해 주세요.');return;}
 if(FEED_MODE==='static'||location.hostname==='app.aiworkjob.local'){message('계정 관리자 미션은 PC에서 aiworkjob 로컬 서버로 열면 사용할 수 있습니다. 공개 웹과 Android에는 금고 연결 정보를 저장하지 않습니다.');return;}
 const job=workspace.rawJob,defaultGoal='이 공고의 요구사항을 기준으로 작업 계획, 검수 체크리스트와 첫 결과물 초안을 작성하세요. 확인되지 않은 자격·경험은 질문으로 남기세요. 공고: '+(job.title||'선택한 작업');
 panel.insertAdjacentHTML('beforeend',`<form data-mission-form hidden><div class="field"><label for="mission-goal">이번에 만들 초안</label><textarea id="mission-goal" name="goal" maxlength="1300" required rows="5">${e(defaultGoal)}</textarea></div><fieldset class="mission-accounts"><legend>현재 위임된 계정</legend><div data-mission-accounts></div></fieldset><div class="field"><label for="mission-calls">최대 모델 호출 횟수</label><input id="mission-calls" name="maxCalls" type="number" min="1" max="20" value="3" required><small data-mission-budget></small></div><div class="form-actions"><button type="submit" class="button" data-mission-create>초안 미션 시작</button></div></form><div class="form-actions"><button class="button outline small" type="button" data-mission-refresh>연결·미션 상태 확인</button></div><div data-mission-list></div><div data-mission-product hidden><h3 data-product-title></h3><p class="small-text">AI가 만든 초안입니다. 사실·권한·실행 결과를 직접 검토하세요. 상품 초안 생성은 판매나 입금 완료가 아닙니다.</p><label for="mission-result">결과물 본문</label><textarea id="mission-result" class="mission-result" rows="12" readonly></textarea><button type="button" class="button soft small" data-save-product>초안 Markdown 저장</button></div>`);
 let connected=false,maxCalls=0,busy=false,productTitle='초안';
 const form=panel.querySelector('[data-mission-form]'),createButton=panel.querySelector('[data-mission-create]');
 const scoped=route=>route+(route.includes('?')?'&':'?')+new URLSearchParams({workspaceId:workspace.id});
 async function api(route,body){const response=await fetch('/api/account-manager/'+route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});let result;try{result=await response.json();}catch{throw Error('계정 관리자 연결을 확인하지 못했습니다.');}if(!response.ok)throw Error(result.error||'요청을 처리하지 못했습니다.');return result;}
 function drawMissions(missions){
  const target=panel.querySelector('[data-mission-list]');target.replaceChildren();
  if(!missions.length){const p=document.createElement('p');p.className='small-text';p.textContent='이 작업에서 시작한 미션이 없습니다.';target.append(p);}
  for(const mission of missions){const article=document.createElement('article');article.className='mission-record';article.innerHTML=`<strong>${e(stateNames[mission.status]||mission.status)}</strong><span class="small-text">모델 호출 ${Number(mission.calls)||0} / ${Number(mission.maxCalls)||0}</span><p>${e(mission.summary||'상태 확인 버튼으로 진행 결과를 확인하세요.')}</p><div class="inline-actions">${mission.products.map(product=>`<button type="button" class="button soft small" data-mission-id="${e(mission.id)}" data-product-id="${e(product.id)}">${e(product.title)} 열기</button>`).join('')}</div>`;target.append(article);}
 }
 async function refresh(){
  if(busy)return;busy=true;panel.querySelector('[data-mission-refresh]').disabled=true;
  try{
   const status=await api('status');if(!panel.isConnected)return;connected=Boolean(status.connected);if(!connected){message(status.message||'PC 서버에 계정 관리자 연결이 필요합니다.');form.hidden=true;return;}
   maxCalls=status.maxCalls;form.hidden=false;createButton.disabled=!status.canCreate;panel.querySelector('#mission-calls').max=String(Math.max(1,maxCalls));if(Number(panel.querySelector('#mission-calls').value)>maxCalls)panel.querySelector('#mission-calls').value=String(Math.max(1,maxCalls));
   panel.querySelector('[data-mission-budget]').textContent='미션별 최대 '+maxCalls+'회 · 오늘 남은 호출 '+status.remainingCalls+'회';
   const checked=new Set([...panel.querySelectorAll('[name="accountId"]:checked')].map(input=>input.value)),accounts=panel.querySelector('[data-mission-accounts]');accounts.innerHTML=status.delegations.map(d=>`<label class="checkbox-line"><input name="accountId" type="checkbox" value="${e(d.accountId)}" ${checked.has(d.accountId)?'checked':''}><span>${e(d.label)} · ${e(d.provider)}<br><small>위임 만료 ${e(new Date(d.expires).toLocaleString('ko-KR'))}</small></span></label>`).join('')||'<p class="small-text">현재 사용할 수 있는 위임 계정이 없습니다.</p>';
   message(status.canCreate?'연결되었습니다. 이미 위임한 범위 안에서 초안을 준비할 수 있습니다.':'계정 관리자에서 모델 연결·실행 상태·미션 권한·호출 한도·활성 위임을 확인해 주세요.');
   drawMissions(await api(scoped('missions')));
  }catch(error){if(panel.isConnected){message(error.message);createButton.disabled=true;}}
  finally{busy=false;if(panel.isConnected)panel.querySelector('[data-mission-refresh]').disabled=false;}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!connected)return;const accountIds=[...panel.querySelectorAll('[name="accountId"]:checked')].map(input=>input.value);if(!accountIds.length){message('현재 위임된 계정을 선택해 주세요.');return;}
  const calls=Number(panel.querySelector('#mission-calls').value);if(!Number.isInteger(calls)||calls<1||calls>maxCalls){message('현재 모델 호출 한도 안에서 입력해 주세요.');return;}
  busy=true;createButton.disabled=true;
  try{await api('missions',{workspaceId:workspace.id,sourceUrl:job.guid,goal:panel.querySelector('#mission-goal').value,accountIds,maxCalls:calls,aiUsePermission:workspace.policy,policyNote:workspace.policyNote});message('초안 미션을 요청했습니다. 같은 목표·계정·한도의 재시도는 기존 미션을 확인합니다.');drawMissions(await api(scoped('missions')));}catch(error){message(error.message);}finally{busy=false;createButton.disabled=false;}
 };
 panel.querySelector('[data-mission-refresh]').onclick=refresh;
 panel.addEventListener('click',async event=>{const button=event.target.closest('[data-product-id]');if(!button||busy)return;busy=true;button.disabled=true;try{const product=await api(scoped('missions/'+button.dataset.missionId+'/products/'+button.dataset.productId));productTitle=product.title;panel.querySelector('[data-product-title]').textContent=product.title;panel.querySelector('#mission-result').value=product.content;panel.querySelector('[data-mission-product]').hidden=false;message('검토용 초안을 가져왔습니다. 실제 납품·판매·입금 상태는 변경하지 않았습니다.');}catch(error){message(error.message);}finally{busy=false;button.disabled=false;}});
 panel.querySelector('[data-save-product]').onclick=()=>{const blob=new Blob(['# '+productTitle+'\n\n'+panel.querySelector('#mission-result').value],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='aiworkjob-mission-draft.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
 refresh();
}
