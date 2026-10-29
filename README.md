# aiworkjob

AI 활용자가 실제 공고를 찾고, 자신의 조건을 비교한 뒤 지원 페이지·작업 도구·제작 화면 링크까지 이어가는 Android·웹 앱입니다.

**다운로드:** [GitHub Releases](https://github.com/Lui02372/aiworkjob/releases)에서 Android APK와 압축 해제 후 실행하는 웹앱 ZIP을 받을 수 있습니다.

**설치 없이 웹 실행:** <https://lui02372.github.io/aiworkjob/>. 공개 웹은 갱신된 공고 피드와 원문 직접 확인을 사용합니다. Android·Node 실행판은 모집 상태를 API에서 다시 확인합니다.

## 실행

- Android 테스트 설치 파일: [aiworkjob-debug.apk](aiworkjob-debug.apk). Android 8.0 이상. 개발용 서명이며 Play 스토어 게시용 서명은 별도입니다.
- PC: 이 폴더에서 `node server.mjs` → <http://127.0.0.1:8787>.
- Windows ZIP은 압축을 푼 뒤 `start-aiworkjob.bat`을 실행하면 브라우저가 열립니다.
- Node 24와 설치된 JDK 21·Android SDK 36·Gradle 9.6.0을 사용했습니다. 런타임 npm 패키지를 추가하지 않았습니다.

## 사용 흐름

1. **내 프로필**에 실제 역량·도구·실무 경력·거주국·시간대·영어 가능 여부를 등록합니다.
2. **내게 맞는 일감 매칭**을 누르면 실제 수집 공고 중 초기 조건을 비교한 후보를 보여줍니다.
3. 원문의 필수 기술·경력·언어 조건을 읽고 매칭을 수락합니다. 현재 모집 상태를 재확인한 뒤 개인 작업 페이지를 만듭니다.
4. 제공된 **원문에서 지원하기** 링크로 직접 지원합니다. 앱의 수락은 외부 지원이나 채용 확정이 아닙니다.
5. 의뢰인·채용사의 AI 사용 허용 범위를 확인해 기록하면 **업무별 작업 스튜디오**, 제작 화면 편집기, 반복 검토 프롬프트가 열립니다.
6. 콘텐츠 기획·디자인 검토·영상 스토리보드·구현 검증·리서치 근거를 편집하고 결과물 미리보기를 만듭니다. 제작 페이지는 정적 화면 또는 간단한 기능 시안입니다.
7. 실제로 배포·검수한 최종 HTTPS 주소를 납품 링크로 기록합니다. 계약·납품·입금은 외부에서 확인한 사실만 단계별로 기록합니다.

프로필·지원 메시지·작업·입금 기록·스튜디오 항목은 **기기 내부 저장**입니다. 다른 사용자와 공유되는 서버 계정 DB나 자동 동기화는 없습니다. 미리보기 공유 링크에는 입력한 본문이 포함되므로 공개 가능한 내용만 사용하세요. 웹 링크의 접근 권한은 사이트의 공개 범위를 따릅니다.

## 실제 연결과 제한

| 영역 | 현재 상태 |
|---|---|
| 공고 | Himalayas 공식 API 연결. 분야별 검색 결과의 일부를 수집하며 전체 시장을 포괄하지 않음 |
| 국내 외주·채용 | 위시켓·원티드·고용24 공식 탐색 링크. 인증·재배포 연동은 미연결 |
| 추천 | 설명 가능한 규칙 점수. 채용 확률·완전한 자격 심사가 아님 |
| AI 사용 | 명시적 금지 문구 감지와 사용자 확인 기록. 고용주의 자동 인증은 아님 |
| 지원 | 원문의 applicationLink 유지. 자동 지원·메시지 전송 없음 |
| 제작 | 분야별 실용 편집 도구·검토 프롬프트·열리는 화면 링크. 서버 LLM과 공고별 완성 앱 자동 개발은 미연결 |
| 금전 | 본인이 확인한 입금 기록. 결제·인출·은행 연동 없음 |

## 검증과 구조

상품 샘플은 [실무 키트](https://lui02372.github.io/aiworkjob/store.html)에서 확인할 수 있습니다. 서버용 판매·주문·가상계좌 입금 확인 코드와 계정 관리자 미션 어댑터를 포함하지만, 기본 상태는 **실결제·금고 미연결**입니다. 실제 가맹점·결제사 키·본인 명의 정산 계좌와 활성 위임이 없으면 구매나 미션을 시작하지 않습니다. 서버의 `AUA_URL/AUA_TOKEN`은 브라우저·Android에 저장하지 않습니다. [연결 범위와 운영 안내](docs/MONETIZATION.md)를 확인하세요.

공동 작업실에서는 `C:/Android ProjectList/commonn/b/aiworkjob`에서 개발하고 검사 후 공통 승격 도구로 A를 갱신합니다. 원본 체크아웃과 실행 중인 A는 개발 중 교체하지 않습니다. A/B 주문 DB와 비밀값은 `commonn/runtime/aiworkjob/<a 또는 b>/`에 분리합니다.

```powershell
node --test tests/domain.test.mjs
python tests/check_browser.py
cd android
.\gradlew.bat :app:assembleDebug :app:lintDebug --console=plain
cd ..
python tests/check_android.py emulator-5560
```

브라우저 검사에는 실행 중인 PC 서버와 기존 Chrome·Python Playwright가 필요합니다. Android 검사는 명시한 에뮬레이터에서만 수행하며 실제 사용자나 실제 채용·수익 검증으로 세지 않습니다.

- [공식 조사·매칭 점수·후속 연동](docs/RESEARCH.md)
- [반복 개발 프롬프트](docs/ITERATION_PROMPT.md)
- [수정·개선 기록](docs/IMPROVEMENTS.md)
- [검증 결과](docs/VALIDATION.md)
- [오프라인 코드·구조 지도](docs/codevisualization/index.html)

코드 지도 재생성: `npm run map`. 정적 분석의 미해결 3건은 웹 자산 디렉터리, APK 바이너리, 공동 작업실의 두 앱 검사에서 참조하는 상대 프로젝트 소스입니다. 서버 미션은 패키지 안의 SDK를 사용합니다. Java·Python의 호출 관계는 자동 추출하지 않습니다.

게시 패키지는 `npm run build`로 생성합니다. `tools/build-site.mjs`는 웹 자산·공개 피드 스냅샷·APK·동일한 API 코드를 단일 Worker로 묶습니다. APK를 먼저 빌드하고 루트에 복사해야 합니다. `android/local.properties`는 PC별 설정으로 Git에서 제외합니다.
