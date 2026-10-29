# 오늘의 후속 점검·수정

사용자는 aiworkjob과 계정 관리자의 대화·이력 공유, B 개발 후 검증된 A 승격, 수익화 연결을 승인했다. aiworkjob 개발 위치는 `C:\Android ProjectList\commonn\b\aiworkjob`이고 공유 루트는 `C:\Android ProjectList\commonn`이다. `C:\Android ProjectList\aiworkjob` 원본 main과 상대 담당의 계정 관리자 소스를 임의 수정·이동하지 않는다. 공개 배포 대상은 https://github.com/Lui02372/aiworkjob 이다.

이 자동 개발 예약은 Asia/Seoul 기준 2026-10-29 하루만 유효하다. 해당 날짜가 아니면 개발을 실행하지 않고 종료 사실만 보고한다. 오늘 23:59 이후로 예약을 연장하지 않는다.

0. 개발 전에 commonn/AGENTS.md, conversations/2026-10-29-user-direction.md, 양방향 handoffs, 새 history와 `python commonn/tools/lease.py status --project aiworkjob`를 읽는다. 만료 전 lease가 있으면 소유자가 같아도 중복 실행으로 보고 읽기 전용 상태 확인 후 종료한다. 비어 있을 때만 이 실행의 고유 owner로 lease를 원자적으로 acquire한다. 기본 90분이며 오늘 23:59를 넘기지 않는다. 다른 편집자의 lease를 해제하거나 공통 파일 소유권을 바꾸지 않는다. B만 개발하고 경계마다 renew, 종료 시 자신의 lease만 release한다. SDK·승격 도구는 상대 담당이 소유하므로 변경 요청을 handoff로 공유한다. 공유 기록에 토큰·키·계좌번호·원시 고객 자료를 넣지 않는다.

1. Git 상태·원격 main·최신 릴리스와 이전 점검 기록을 읽는다. 사용자 변경과 다른 실행의 작업을 덮어쓰지 않는다. 진행 중인 같은 작업이 있다면 중복 수정·릴리스를 만들지 않는다.
2. 공개 웹 https://lui02372.github.io/aiworkjob/ 와 최신 릴리스 파일을 실제로 확인한다. 공고 출처·현재 모집 확인 방식·매칭 조건·수락·작업 도구·제작 링크의 외부 열람·데이터 유지·Android 설치/업데이트를 우선한다.
3. 가장 큰 실제 결함 하나를 재현하고 수정한다. 실패·근거·수정·검증을 docs 개선 기록에 남긴다. 단순히 검사를 반복하거나 타임스탬프만 바꾼 것을 기능 개선으로 세지 않는다.
4. 필요한 검사만 실행한다. 기본 검사: npm test, npm run build:pages, python tests/check_pages.py. PC 서버가 필요하면 기존 서버 또는 소유한 node server.mjs를 사용한다. 설치된 Chrome·Playwright를 재사용하고 불필요한 대형 다운로드를 하지 않는다.
5. Android 변경 시 기존 JDK/SDK와 Gradle wrapper로 APK를 빌드한다. 기존 로컬 개발 서명키를 유지하고 서명키를 저장소나 릴리스에 넣지 않는다. API 36 에뮬레이터가 있으면 명시한 대상에서 검증한다. 물리 기기에 임의 설치하거나 사용자 데이터를 지우지 않는다.
6. 실제 수정이 있고 관련 검사가 통과한 경우에만 패치 버전을 올린다. package.json·version.properties·web/config.js·api.mjs의 버전과 APK를 일치시킨다. tools/package_release.py로 APK·웹 ZIP·해시를 만들고 tests/check_release.py로 압축 해제 실행을 확인한다.
7. GitHub의 사용자 소유 Lui02372/aiworkjob에 정상 fast-forward push하고, 새 버전의 draft 릴리스에 파일을 올린다. 해시와 버전을 확인한 후 공개한다. 이전 태그·릴리스·자산을 덮어쓰거나 강제로 push하지 않는다. 기본 GitHub CLI 계정을 확인하고 다른 계정·저장소로 임의 전환하지 않는다.
8. GitHub Pages의 해당 workflow와 실제 공개 URL 동작을 확인한다. 매일 공고 갱신과 검증은 .github/workflows/pages.yml이 담당한다. 기존 Sites 비공개 사이트의 공개 범위·계정·결제·API 비밀키는 변경하지 않는다.
9. 수정할 결함이 발견되지 않으면 통과 범위와 남은 제한만 기록하고 불필요한 새 릴리스는 만들지 않는다. 마지막에 새 버전/다운로드 링크, 확인한 동작, 해결되지 않은 문제를 간결하게 보고한다.

공유 A 승격은 `python commonn/tools/workspace.py promote --project aiworkjob --owner <이 실행의 lease owner>`로만 한다. 관련 전체 Node 검사와 정적 웹·판매·계정 관리자 화면 검사가 통과한 B의 소스만 승격하며 A/B runtime 데이터를 복사하지 않는다. 실행 중인 A를 중단하지 않는다. 공유 A 포인터 교체와 GitHub 공개 릴리스는 별개다. GitHub는 원격 main의 정상 fast-forward만 허용하며 원본 체크아웃을 덮어쓰지 않는다. `AUA_URL/AUA_TOKEN`은 runtime의 서버 환경에서만 사용하고 Pages/Android에는 넣지 않는다. AI 사용 허용·확인 근거·활성 위임·호출 한도를 확인한 작업의 미션·초안 결과만 연동한다. 실제 판매·입금·정산은 결제사·실제 증빙 없이 완료로 표시하지 않는다.

실제 지원서·메시지 전송, 외부 계약·채용 확정·납품 제출·금전 이동은 실행하지 않는다. 실제 공고의 지원 자격과 AI 사용 권한을 과장하지 않는다. 현재 서버 LLM·공고별 완성 앱 자동 개발·클라우드 동기화·결제 정산은 미연결이다. 키나 비용·계정 승인이 필요한 연결을 완료된 것처럼 표시하지 않는다.
