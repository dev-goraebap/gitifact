# 프론트엔드 개발 환경

적용 대상은 apps/browser의 React·TypeScript·Vite CSR 앱이다. Gentask의 01-development.md를 2026-09-14 사용자 요청으로 적용했다. Gentask의 clients 경로, npm workspace, Spring·인증·OpenAPI 구성과 과거 검증 결과는 가져오지 않는다.

의존성은 apps/browser/package.json과 pnpm-lock.yaml을 기준으로 한다. React 19, TanStack Router·Query, Astryx stone 테마를 사용한다. 명령은 루트에서 pnpm --filter @gitifact/browser dev, typecheck, build, test:built이며 통합 검증은 pnpm check다. 실제 검사 범위는 package.json을 확인한다.

브라우저는 같은 출처 /api/v1을 사용한다. 개발 프록시는 GITIFACT_API_PORT의 로컬 CLI로 연결한다. 런타임 계약은 packages/contracts에서 검증하며 브라우저에 Node 모듈이나 비밀 값을 포함하지 않는다. CLI는 시작한 checkout만 읽고 세션·Host·Origin을 검증한다.

Astryx 에이전트 지침은 apps/browser에서 npx @astryxdesign/cli init으로 생성한다. core·theme-stone·stylex는 기존 호환 설치를 유지하고 CLI를 개발 의존성으로 설치한다. 생성된 AGENTS.md와 컴포넌트 문서를 읽는다. 프로토타입의 mock은 실제 데이터의 증거가 아니다.
