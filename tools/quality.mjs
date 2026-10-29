import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const run=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/domain.test.mjs'],{encoding:'utf8',shell:false});
if(run.status!==0){process.stderr.write(run.stdout+run.stderr);process.exit(1);}
const domain={status:'passed',count:Number(run.stdout.match(/# tests (\d+)/)?.[1]),checks:[...run.stdout.matchAll(/^ok \d+ - (.+)$/gm)].map(m=>m[1]),checkedAt:new Date().toISOString()};
await writeFile('artifacts/domain-report.json',JSON.stringify(domain,null,2));
const browser=JSON.parse(await readFile('artifacts/browser-report.json','utf8')),android=JSON.parse(await readFile('artifacts/android-report.json','utf8'));
if([browser,android].some(r=>r.status!=='passed'))throw Error('Required runtime validation missing');
const axes=[
 {name:'공고 근거',weight:20,grade:4,note:'공식 API·원문·모집 상태 확인. 고용주 자체의 신뢰 보증은 아님',evidence:'artifacts/android-report.json'},
 {name:'지원자격 비교',weight:20,grade:3,note:'지역·시간대·역량·경력·언어·금지 문구 휴리스틱. 모든 필수요건을 자동 검증하지 않음',evidence:'artifacts/domain-report.json'},
 {name:'AI 사용조건',weight:15,grade:4,note:'미확인 잠금·근거 기록·금지 감지. 채용사 인증은 사용자 확인에 의존',evidence:'artifacts/browser-report.json'},
 {name:'링크 실행성',weight:10,grade:5,note:'원문 링크·작업도구·제작 링크와 GitHub 공개 웹의 비로그인 열람 확인',evidence:'artifacts/public-report.json'},
 {name:'실행 검증',weight:10,grade:5,note:'Chrome PC/모바일 및 API36 Android에서 확인',evidence:'artifacts/android-report.json'},
 {name:'저장 무결성',weight:10,grade:4,note:'기기 저장·quota 복구·손상 복구·피드 스냅샷. 클라우드 동기화 없음',evidence:'artifacts/browser-report.json'},
 {name:'사용성',weight:10,grade:4,note:'모바일·페이지 분할·기본 키보드 접근. 광범위한 사용자 사용성 연구는 미수행',evidence:'artifacts/mobile.png'},
 {name:'자동 구현 범위',weight:5,grade:2,note:'업무별 편집 도구·반복 프롬프트·동작하는 화면 시안. 서버 LLM의 공고별 완성 앱 자동 개발은 미연결',evidence:'web/studio.js'}
];
const score=axes.reduce((n,a)=>n+a.weight*a.grade/5,0);
const version=JSON.parse(await readFile('package.json','utf8')).version;
const supplemental=[];
for(const path of ['artifacts/pages-report.json','artifacts/public-report.json','artifacts/android-update-report.json',`artifacts/release-${version}-report.json`]){try{const r=JSON.parse(await readFile(path,'utf8'));if(r.status==='passed')supplemental.push({path,count:r.count});}catch{}}
const report={checkedAt:new Date().toISOString(),version,assessment:'구현자의 내부 근거 기반 점검. 성과나 수익 예측 점수가 아님.',status:'core-flow-verified; external integrations remain',totalChecks:domain.count+browser.count+android.count+supplemental.reduce((n,r)=>n+r.count,0),domain:domain.count,browser:browser.count,android:android.count,supplemental,score,maxScore:100,axes};
await writeFile('artifacts/quality-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.totalChecks,score,maxScore:100,status:report.status}));
