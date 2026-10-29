# 계정 관리자 SDK

`account-manager-client.mjs`는 `C:/Android ProjectList/commonn/sdk/account-manager-client.mjs`의 검토한 동일 바이트 복사본이다. 서버에서만 import한다. 공유 SDK는 계정 관리자 담당이 소유하고, 소비자는 변경하지 않는다. 생성자 `{baseUrl, token, fetchImpl, timeoutMs}`와 v1 미션 API를 사용한다. 원본 SHA-256은 최초 통합 및 최종 검증 기록에 남긴다. 자격 증명은 포함하지 않는다.

통합한 SDK v1 최종 원본 SHA-256: `dfb13782f2f233d0e2eef5d9026a39475ff936e556aaeff5e578d2acf9300e53` (2026-10-29, `commonn/handoffs/sdk-v1-ready.md` 기준). 초기 복사본의 임의 경로 요청을 제한하는 검사를 반영했다.

SDK 변경 시 공유 원본·계약·소비 측 검사를 대조한 후 명시적으로 복사본을 갱신한다. 브라우저 번들·Android 자산에는 이 디렉터리를 넣지 않는다.
