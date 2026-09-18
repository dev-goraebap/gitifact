---
id: W-hwwbtzdipa
---

# 결정 0004. 모노레포와 패키지 경계

상태: Accepted · 2026-09-18

## 맥락

CLI와 브라우저가 같은 기록 규칙과 데이터 계약을 써야 하지만 실행 환경은 다르다. 이 결정은 이전 ARCHITECTURE.md가 담던 구조를 결정 기록으로 옮겨 적은 것이다.

## 결정

`apps`(실행·배포 단위)와 `packages`(독립된 책임과 공개 API가 있는 코드 단위)로 나눈 pnpm TypeScript 모노레포로 둔다.

```text
apps/cli         명령 실행, Git·파일 접근, 로컬 HTTP 서버
apps/browser     React 브라우저 앱과 정적 빌드
packages/core    명세·위키·이력 규칙과 유스케이스(순수 함수)
packages/contracts  버전이 있는 외부 DTO·검증 계약
packages/intro   언어별 제품 소개 글
```

의존은 `apps/browser → contracts, intro`, `apps/cli → core, contracts` 방향으로만 둔다. 패키지는 `apps`를 참조하지 않고, 앱끼리 소스를 import하지 않으며, exports로 공개한 진입점만 쓴다. 브라우저는 `core`를 가져오지 않는다. 외부로 나가는 데이터는 contracts의 버전 있는 스키마로만 내보내고 필드 추가도 버전을 올린다. 언어는 TypeScript(strict, ESM), 워크스페이스는 pnpm과 단일 lockfile, 브라우저는 React 19·Vite·Astryx·TanStack Router·Query, 검증은 zod 계약·node:test·Playwright다.

## 결과

CLI와 서버가 같은 core 규칙을 쓰고 브라우저에 Node 코드가 섞이지 않는다. 대가는 계약 변경마다 버전을 올리는 비용과, 공통으로 보이는 코드도 경계를 넘기려면 공개 API를 설계해야 하는 것이다. 빈 계층을 미리 만들지 않으며, UI 공통 코드는 React 앱이 하나인 동안 브라우저의 `shared/ui`에 둔다. 추가 모노레포 도구는 빌드 병목이 생기기 전에는 도입하지 않는다.
