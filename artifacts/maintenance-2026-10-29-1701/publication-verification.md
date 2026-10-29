# v0.1.5 공개 후 검증

겹친 결제 확인 응답이 취소 주문과 다운로드를 되살리는 수정 소스 `29630b2e888fee54f3397fc23544d1d298a9f8e1`을 원격 main에 정상 fast-forward로 반영했다. 같은 커밋을 대상으로 새 draft에 APK·ZIP·매니페스트·해시 네 파일을 올렸다. 네 파일을 재다운로드하여 바이트·SHA-256·버전·ZIP 안 commerce 코드·APK와 기존 검증 패키지의 일치를 확인한 뒤 공개했다. 이전 태그·릴리스·자산은 교체하지 않았다. 공개 태그 v0.1.5도 이 소스 커밋을 가리킨다.

- [공개 릴리스](https://github.com/Lui02372/aiworkjob/releases/tag/v0.1.5)
- [APK](https://github.com/Lui02372/aiworkjob/releases/download/v0.1.5/aiworkjob-0.1.5-android.apk)
- [웹 ZIP](https://github.com/Lui02372/aiworkjob/releases/download/v0.1.5/aiworkjob-0.1.5-webapp.zip)
- [소스 Pages workflow](https://github.com/Lui02372/aiworkjob/actions/runs/40841003584): build/deploy 성공. 전체 Node 80개와 공고 갱신·정적 웹·판매·계정 관리자·예약 검증이 등록된 기존 workflow를 사용했다.
- [실제 공개 웹](https://lui02372.github.io/aiworkjob/): 별도 비로그인 Chrome 19개 검사 통과. 0.1.5/static 설정, 실제 공고·원문 링크·수동 모집 확인·새로고침 보존·독립 브라우저의 제작 화면·스튜디오 동시 편집·판매 미연결 차단과 메인 앱 저장 회귀를 확인했다.

공개 후에도 네 최종 다운로드 URL에서 인증 없이 파일을 받아 로컬 검증 패키지와 바이트·SHA-256·GitHub 자산 digest를 대조했다. `draft-verification.json`, `published-release.json`, `public-downloads.json`, `pages-workflow.json`, `public-report.json`이 근거다. draft의 untagged URL은 역사 기록이며 다운로드 안내에는 최종 공개 URL만 사용한다.

A 포인터는 `20261029T081445126566Z-824123027c1f`, sourceHash는 `824123027c1f00e31c8a1737dc2e930b4688d0c474a48c85855955208a3773ee`다. 공용 도구의 소유 lease·전체 Node·정적 웹·판매·계정 관리자 화면 검사 6명령을 통과했고 CLI 상태로 B 해시와의 일치를 확인했다. 사용 중인 A 0.1.3은 계속 응답하며 새 소스는 다음 A 실행부터 적용한다. 원본 checkout main `0f8ef93438659607354b40efce0a932c753fad03`도 깨끗하게 보존했다.

최신 상대 인계의 계정 관리자 v0.3.5를 읽고 기존 v1 SDK로 두 앱 HTTP 검사 4개를 다시 통과했다. 공유 SDK·승격 도구·상대 담당 소스와 A/B 실행 데이터를 변경하거나 복사하지 않았다. 실제 모델·PG·판매자/정산 및 수익 영수증 연결은 여전히 필요하다. 실제 지원·메시지·계약·납품 제출·금전 이동을 실행하거나 실수익을 확인한 결과가 아니다. 오늘 23:59 KST 예약 종료일을 연장하지 않았다.
