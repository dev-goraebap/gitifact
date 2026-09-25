---
id: I-krc7tyzyfh
title: 검증
description: pnpm check가 하는 일, 동시에 돌리면 안 되는 것, 검증 기준과 보고 방법. 변경을 검증하거나 커밋하기 전에 쓴다.
---

통합 검증은 저장소 루트의 `pnpm check`다. 커밋 전에 실행하고 결과를 보고한다. 작업 중에는 바뀐 부분의 테스트 파일만 돌리고, 전체 검사는 커밋 묶음마다 한 번 한다.

## pnpm check가 하는 일

루트 package.json의 스크립트가 아래 순서로 실행한다. 전체는 약 200초 걸린다.

1. 타입 검사: core·contracts를 빌드한 뒤 모든 패키지의 `typecheck`
2. 전체 빌드: core·contracts → browser → cli
3. 패키지 테스트: core·contracts·intro·CLI·브라우저의 `test:built`를 한 패키지씩 차례로(`--workspace-concurrency=1`)
4. 패키지 오프라인 설치 검사: `scripts/test-package.mjs`(`pnpm test:package`)

| 테스트 | 동시 실행 |
| :--- | :--- |
| CLI (`node --test`) | 테스트 파일 4개(`--test-concurrency=4`) |
| 브라우저 (Playwright) | Chromium 워커 4개(`apps/browser/playwright.config.ts`) |

> [!WARNING]
> `pnpm check`를 다른 `pnpm check`·빌드·테스트와 겹쳐 돌리지 않는다. CLI 테스트는 git 프로세스를 수백 개 띄우므로, 브라우저 테스트나 다른 실행과 겹치면 PC 전체가 느려지고 Git 조회가 시간 초과로 실패한다.

CLI 테스트의 임시 저장소는 `apps/cli/test/git-fixture.mjs`가 전역 Git 설정(`GIT_CONFIG_GLOBAL`)을 자체 파일로 바꿔 `maintenance.auto = false`, `gc.auto = 0`으로 둔다. 커밋마다 Git의 백그라운드 정리 프로세스가 뜨지 않게 하기 위해서다.

## 검증 기준

- 파서·상태 전이·부분 staging·형식 호환·복구는 예상 결과가 고정된 자료로 검증한다. gitifact 자신의 check 결과만으로 구현이 맞다고 판단하지 않는다.
- 실패·복구 시험은 임시 저장소에서만 한다. 실제 프로젝트의 이력과 사용자 설정을 실험 대상으로 삼지 않는다.
- 화면 변경은 테스트와 별도로 실제 앱을 띄워 확인한다. 스크린샷 한 장은 한 상태일 뿐이므로 이동·새로고침·좁은 폭을 함께 본다.
- 화면 변경은 사용자 검수를 받는다. 바뀐 화면의 테스트 파일만 돌린 뒤 `pnpm cli browser`로 띄운 주소를 알리고 검수를 요청한다. 앱은 browser를 빌드한 다음 CLI를 빌드해야 새 화면이 실린다. 사용자가 고칠 점이 없다고 하면 커밋 직전에 서버를 끄고 `pnpm check`를 한 번 돌린다. 검수를 주고받는 동안에는 전체 검사를 돌리지 않는다.
- 실행한 검증과 실행하지 못한 검증을 구분해 보고한다.
