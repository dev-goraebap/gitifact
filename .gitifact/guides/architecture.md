<!-- gitifact-guide: G-hx2vdtqiys -->

# 아키텍처 기준

Gitifact는 `apps`와 `packages`로 구성하는 TypeScript 모노레포다. CLI와 브라우저는 실행 환경과 빌드를 분리하고, 기록 규칙과 외부 데이터 계약을 명시적인 패키지 경계로 나눈다. React와 Astryx는 사용자 지정이고 pnpm·Node.js·Vite·TanStack 조합은 위임받은 기술 선택이다.

## 저장소 구조

```text
apps/
  cli/            명령 실행, Git·파일 접근, 로컬 HTTP 서버
  browser/        React 브라우저 앱과 정적 빌드
packages/
  core/           명세·문서·이력 규칙과 유스케이스
  contracts/      버전이 있는 외부 DTO·검증 계약
.agents/
  skills/         이 프로젝트가 관리하는 스킬 원본
.gitifact/
  product/        제품 개요(PRODUCT.md)와 이미지
  guides/         구현 지침(이 문서들)
  spec/           기능별 요구사항·설계·변경 이유
docs/             날짜별 개발·배포·도입 기록
```

`apps`는 실행하거나 배포하는 단위다. `packages`는 독립된 책임과 공개 API가 있는 코드 단위이며, 공통으로 보인다는 이유만으로 코드를 옮기지 않는다. 빈 계층을 미리 만들지 않는다.

`core`는 명령과 HTTP가 같은 제품 규칙을 쓰고 독립적으로 시험하기 위한 단위다. `contracts`는 Node.js 코드가 브라우저에 유입되지 않게 하면서 외부 계약을 공유하기 위한 단위다.

## 기술 선택

| 영역 | 선택 | 이유 |
| :--- | :--- | :--- |
| 언어 | TypeScript, strict, ESM | CLI·브라우저에서 타입과 계약을 공유 |
| 워크스페이스 | pnpm workspaces | 로컬 패키지 경계와 의존 관계를 명시 |
| CLI 런타임 | Node.js 24 계열 | 현재 개발 환경과 장기 지원 계열 |
| 브라우저 | React 19 + TypeScript + Vite | 로컬 서버가 제공하는 SPA |
| 디자인 시스템 | Astryx (stone 테마) | 제공 컴포넌트와 테마를 우선 사용 |
| 경로·URL 상태 | TanStack Router | 타입 기반 경로와 검색 조건 |
| 서버 상태 | TanStack Query | 재조회·중복 요청·캐시 무효화 |

루트 `package.json`은 private이고 단일 lockfile을 커밋한다. 도구 버전은 `.node-version`과 `packageManager`에 고정한다. 추가 모노레포 실행 도구는 빌드 병목이나 별도 배포 요구가 생기기 전에는 도입하지 않는다.

## 의존 방향

```text
apps/browser ──→ packages/contracts
apps/cli     ──→ packages/contracts
apps/cli     ──→ packages/core
```

- `core`는 제품 모델과 규칙을, `contracts`는 외부 DTO를 소유한다. UI의 화면 모델은 브라우저 안에 둔다. 역할이 다른 모델을 하나의 거대한 공통 타입으로 합치지 않는다.
- 패키지는 `apps`를 참조하지 않고 앱끼리 소스를 직접 import하지 않는다. 다른 패키지의 `src`를 경로로 참조하지 않으며 exports로 공개한 진입점만 쓴다.
- 브라우저는 `core`의 내부 규칙이나 Git·파일 접근 코드를 가져오지 않는다.
- React UI를 쓰는 앱이 하나인 동안 UI 공통 코드는 브라우저의 `shared/ui`에 둔다. 브라우저의 FSD `shared`와 저장소의 `packages`는 다른 범위다.

## 브라우저와 CLI의 연결

`gitifact browser`가 현재 프로젝트를 대상으로 로컬 서버를 실행한다. 서버는 같은 `core` 유스케이스로 데이터를 만들고 버전이 있는 계약으로 응답한다. 브라우저는 HTTP로 읽으며 CLI 프로세스를 직접 실행하거나 파일 시스템에 접근하지 않는다.

개발 중에는 Vite 개발 서버가 `/api`를 로컬 서버로 프록시한다. 배포 시에는 미리 빌드한 브라우저 정적 파일을 CLI 배포물에 포함하고 같은 origin에서 제공한다. 설치된 CLI가 UI를 보여주기 위해 Vite 개발 서버나 workspace 원본을 필요로 해서는 안 된다. 기록 규모가 커지면 필요한 범위의 조회와 페이지네이션을 도입하되 서로 다른 관측 시점을 혼합하지 않는다.

## 스킬과 자체 적용

스킬 원본은 `.agents/skills/gitifact-workflow/SKILL.md` 하나다. 두 번째 편집 원본을 만들지 않으며 에이전트용 복사본은 `pnpm skills:sync`로 로컬 생성한다. CLI 배포에는 빌드 과정에서 원본을 배포 자산으로 수집한다. 이 저장소 자체의 기록에는 지정된 CLI 빌드를 쓰고 대체 절차는 루트 AGENTS.md를 따른다.
