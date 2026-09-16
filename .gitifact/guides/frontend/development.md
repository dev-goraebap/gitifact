<!-- gitifact-guide: G-v3x7s5ogd6 -->

# 프론트엔드 개발 환경

적용 대상은 apps/browser의 React·TypeScript·Vite CSR 앱이다.

의존성은 apps/browser/package.json과 pnpm-lock.yaml이 기준이다. React 19, TanStack Router·Query, Astryx stone 테마를 쓴다. 명령은 루트에서 `pnpm --filter @gitifact/browser dev|typecheck|build|test:built`이고 통합 검증은 `pnpm check`다.

브라우저는 같은 출처 `/api/v1`만 쓴다. 개발 중에는 두 터미널에서 `pnpm cli browser --dev --port 4317`과 `pnpm dev`를 실행하며 Vite는 `GITIFACT_API_PORT`(기본 4317)의 CLI로 `/api`를 프록시한다. CLI 서버가 없으면 화면은 열리지만 세션 요청이 502로 실패한다. 런타임 계약은 packages/contracts에서 검증하고 브라우저에 Node 모듈이나 비밀 값을 포함하지 않는다.

Astryx 에이전트 지침은 apps/browser/AGENTS.md에 CLI가 생성한다. 컴포넌트를 쓰기 전에 `pnpm exec astryx build "화면 설명"`, `docs layout`, `template <이름>`, `component <이름>`으로 설치 버전의 실제 API를 확인한다. 템플릿은 참고 코드이고 프로토타입의 mock은 실제 데이터의 증거가 아니다.

화면 검증은 빌드된 앱을 Playwright로 실행하며 계약 fixture(test/mock-api.ts)와 실제 CLI 서버(live-server)를 모두 쓴다. 변경 후에는 라이트·다크, 모바일 폭, 키보드 조작을 확인한다.
