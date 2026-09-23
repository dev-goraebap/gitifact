---
id: W-4oau6h3awn
title: 프론트엔드 개발 환경
description: 브라우저 앱의 개발 환경, 의존성, 빌드 규칙
---

적용 대상은 apps/browser의 React·TypeScript·Vite CSR 앱이다.

## 의존성과 명령

의존성은 apps/browser/package.json과 pnpm-lock.yaml이 기준이다. React 19, TanStack Router·Query, Astryx stone 테마를 쓴다. 명령은 루트에서 `pnpm --filter @gitifact/browser dev|typecheck|build|test:built`이고 통합 검증은 `pnpm check`([검증](../verification.md))다. 화면 테스트에 쓰는 Chromium은 `pnpm browser:install`로 설치한다.

## 개발 서버

브라우저는 같은 출처 `/api/v1`만 쓴다. 개발 중에는 두 터미널에서 실행한다.

1. `pnpm cli browser --dev --port 4317`: CLI 서버
2. `pnpm dev`: Vite 개발 서버. `GITIFACT_API_PORT`(기본 4317)의 CLI로 `/api`를 프록시한다

CLI 서버가 없으면 화면은 열리지만 세션 요청이 502로 실패한다. 런타임 계약은 packages/contracts에서 검증하고 브라우저에 Node 모듈이나 비밀 값을 포함하지 않는다.

## Astryx API 확인

Astryx 에이전트 지침은 apps/browser/AGENTS.md에 CLI가 생성한다. 컴포넌트를 쓰기 전에 `pnpm exec astryx build "화면 설명"`, `docs layout`, `template <이름>`, `component <이름>`으로 설치 버전의 실제 API를 확인한다. 템플릿은 참고 코드이고 프로토타입의 mock은 실제 데이터의 증거가 아니다.

## 화면 검증

화면 검증은 빌드된 앱을 Playwright로 실행하며 계약 fixture(`test/mock-api.ts`)와 실제 CLI 서버(`test/live-server.spec.ts`)를 모두 쓴다. 변경 후에는 라이트·다크, 모바일 폭, 키보드 조작을 확인한다.
