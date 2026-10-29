# v0.1.4 공개 후 검증

메인 앱의 여러 창 입력 손실 수정 소스 `fae17005b6bf36041c9bba9b36c770e3c2c1d0e3`을 원격 main에 정상 fast-forward로 반영했다. 새 v0.1.4 초안 파일 네 개를 다시 내려받아 바이트·SHA-256·버전과 소스 커밋을 대조한 뒤 2026-10-29 15:33 KST에 공개했다. 이전 태그·릴리스·자산은 교체하지 않았다. 공개 태그는 같은 소스 커밋을 가리킨다.

- [공개 릴리스](https://github.com/Lui02372/aiworkjob/releases/tag/v0.1.4)
- [Android APK](https://github.com/Lui02372/aiworkjob/releases/download/v0.1.4/aiworkjob-0.1.4-android.apk)
- [웹 ZIP](https://github.com/Lui02372/aiworkjob/releases/download/v0.1.4/aiworkjob-0.1.4-webapp.zip)
- [Pages workflow](https://github.com/Lui02372/aiworkjob/actions/runs/40829660615): build/deploy 성공, 공고 갱신과 모든 등록 검사 통과.
- [공개 웹](https://lui02372.github.io/aiworkjob/): 별도 비로그인 Chrome의 19개 검사 통과. 실제 공고·원문 링크·수동 현재 모집 확인·재로딩 보존·외부 제작 링크·스튜디오 동시 편집·미연결 판매 차단과 메인 앱의 새 회귀 10개를 확인했다. 새 회귀는 격리된 모의 공고를 사용했다.

공개 APK·ZIP·매니페스트·해시 네 파일을 인증 없이 받아 로컬 패키지와 일치하는지 다시 확인했다. `draft-verification.json`, `published-release.json`, `public-downloads.json`, `pages-workflow.json`, `../public-report.json`에 결과가 있다. 초안의 임시 untagged URL은 공개 후 사용하지 않고 공개 릴리스의 최종 다운로드 URL로 확인했다.

A 활성 포인터는 `20261029T062803087821Z-72963627c138`, sourceHash `72963627c13872f882ba0f93e7a8218f060b67e286c1c2aa861dfa2efa73d019`다. 공용 도구의 검사와 B 해시 대조를 통과했다. 사용 중 A v0.1.3 서버와 원본 main `0f8ef93`을 보존했다. 새 A 버전은 다음 실행부터 적용된다. 검증용으로 소유한 8794 Node 서버만 종료했다.

실제 지원·메시지·계약·납품 제출·금전 이동은 하지 않았다. 서버 LLM·공고별 완성 앱 자동 개발·클라우드 동기화·라이브 PG·은행 정산은 미연결이며 실제 수익을 검증한 결과가 아니다. 오늘 23:59 KST 예약 종료일은 그대로다.
