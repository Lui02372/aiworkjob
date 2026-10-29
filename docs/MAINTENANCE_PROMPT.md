# 오늘의 후속 점검·수정

사용자는 aiworkjob을 GitHub 릴리스로 받고, 이후에도 실제로 사용 가능한지 계속 확인하며 자동으로 개선해 달라고 요청했다. 현재 저장소는 C:\Android ProjectList\aiworkjob, GitHub는 https://github.com/Lui02372/aiworkjob 이다. 다른 Android ProjectList 앱은 수정하지 않는다.

이 자동 개발 예약은 Asia/Seoul 기준 2026-10-29 하루만 유효하다. 해당 날짜가 아니면 개발을 실행하지 않고 종료 사실만 보고한다. 오늘 23:59 이후로 예약을 연장하지 않는다.

1. Git 상태·원격 main·최신 릴리스와 이전 점검 기록을 읽는다. 사용자 변경과 다른 실행의 작업을 덮어쓰지 않는다. 진행 중인 같은 작업이 있다면 중복 수정·릴리스를 만들지 않는다.
2. 공개 웹 https://lui02372.github.io/aiworkjob/ 와 최신 릴리스 파일을 실제로 확인한다. 공고 출처·현재 모집 확인 방식·매칭 조건·수락·작업 도구·제작 링크의 외부 열람·데이터 유지·Android 설치/업데이트를 우선한다.
3. 가장 큰 실제 결함 하나를 재현하고 수정한다. 실패·근거·수정·검증을 docs 개선 기록에 남긴다. 단순히 검사를 반복하거나 타임스탬프만 바꾼 것을 기능 개선으로 세지 않는다.
4. 필요한 검사만 실행한다. 기본 검사: npm test, npm run build:pages, python tests/check_pages.py. PC 서버가 필요하면 기존 서버 또는 소유한 node server.mjs를 사용한다. 설치된 Chrome·Playwright를 재사용하고 불필요한 대형 다운로드를 하지 않는다.
5. Android 변경 시 기존 JDK/SDK와 Gradle wrapper로 APK를 빌드한다. 기존 로컬 개발 서명키를 유지하고 서명키를 저장소나 릴리스에 넣지 않는다. API 36 에뮬레이터가 있으면 명시한 대상에서 검증한다. 물리 기기에 임의 설치하거나 사용자 데이터를 지우지 않는다.
6. 실제 수정이 있고 관련 검사가 통과한 경우에만 패치 버전을 올린다. package.json·version.properties·web/config.js·api.mjs의 버전과 APK를 일치시킨다. tools/package_release.py로 APK·웹 ZIP·해시를 만들고 tests/check_release.py로 압축 해제 실행을 확인한다.
7. GitHub의 사용자 소유 Lui02372/aiworkjob에 정상 fast-forward push하고, 새 버전의 draft 릴리스에 파일을 올린다. 해시와 버전을 확인한 후 공개한다. 이전 태그·릴리스·자산을 덮어쓰거나 강제로 push하지 않는다. 기본 GitHub CLI 계정을 확인하고 다른 계정·저장소로 임의 전환하지 않는다.
8. GitHub Pages의 해당 workflow와 실제 공개 URL 동작을 확인한다. 매일 공고 갱신과 검증은 .github/workflows/pages.yml이 담당한다. 기존 Sites 비공개 사이트의 공개 범위·계정·결제·API 비밀키는 변경하지 않는다.
9. 수정할 결함이 발견되지 않으면 통과 범위와 남은 제한만 기록하고 불필요한 새 릴리스는 만들지 않는다. 마지막에 새 버전/다운로드 링크, 확인한 동작, 해결되지 않은 문제를 간결하게 보고한다.

실제 지원서·메시지 전송, 외부 계약·채용 확정·납품 제출·금전 이동은 실행하지 않는다. 실제 공고의 지원 자격과 AI 사용 권한을 과장하지 않는다. 현재 서버 LLM·공고별 완성 앱 자동 개발·클라우드 동기화·결제 정산은 미연결이다. 키나 비용·계정 승인이 필요한 연결을 완료된 것처럼 표시하지 않는다.
