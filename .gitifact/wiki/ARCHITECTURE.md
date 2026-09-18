---
id: W-qct6kpdgf6
---

# 아키텍처 안내

Gitifact의 시스템 전체를 한 문서로 정의하는 최상위 지침이다. 세부 규칙은 `references/`의 페이지를, 되돌리기 어려운 선택의 배경은 `adr/`을 단일 원본으로 가리킨다.

## 1. 소개와 목표

에이전트와 제품을 만드는 대화가 요구사항과 결정의 기록으로 Git에 남게 하는 도구다. 사용자는 기록 명령을 배우지 않고, 에이전트가 CLI로 명세를 저장하며, 사람은 읽기 전용 브라우저로 기록을 본다. 제품의 대상·원칙·범위는 저장소 루트의 [README.md](../../README.md)에 있다(원본은 packages/intro).

품질 우선순위는 기록의 정확성(커밋된 명세가 기준, 추정을 사실로 만들지 않음), 사용자 변경의 보존, 외부 서비스 없는 로컬 동작, 에이전트가 형식을 추측하지 않아도 되는 명확한 지침이다.

## 2. 제약

- Node.js 24 계열과 Git이 있는 로컬 환경에서 동작한다. 외부 요청은 npm 레지스트리의 최신 버전 조회 하나뿐이다.
- 관리 단위는 Git 저장소 하나다. 멀티 레포 통합은 범위 밖이다.
- 기록은 `.gitifact/` 아래 Markdown·JSONL이며 저장 규약은 `config.json`의 schemaVersion으로 구분한다. 정식 버전 전에는 규약 전환 도구를 두지 않는다.
- 브라우저는 읽기 전용이고 CLI 프로세스를 실행하거나 파일 시스템에 접근하지 않는다.
- 자동 기록은 자동 커밋·푸시 권한이 아니다.

## 3. 컨텍스트와 범위

| 참여자 | 역할 |
| :--- | :--- |
| 에이전트 | 대화에서 요구사항·설계·위키를 정리하고 `spec save`·`spec commit`으로 저장·커밋한다 |
| 사용자 | 제품을 설명하고 구현하고 커밋을 요청한다. 명령을 직접 쓰지 않아도 된다 |
| 브라우저 사용자 | 활동·요구사항·위키·참여자·Git 상태를 읽는다 |

외부 경계는 Git 실행 파일, 파일 시스템, npm 레지스트리(버전 조회)다. 에디터·에이전트 도구와는 AGENTS.md 등 지침 파일의 GITIFACT 블록으로만 연결한다.

## 4. 솔루션 전략

- 기록 규칙은 `packages/core`에 순수 함수로 두고 CLI와 서버가 같은 규칙을 쓴다.
- 외부로 나가는 데이터는 `packages/contracts`의 버전 있는 스키마로만 내보낸다. 필드 추가도 버전을 올린다.
- 에이전트 지침은 CLI 자산 하나가 원본이며 `init`이 블록을, `docs`가 원문을 전달한다. 프로젝트는 운영 지침만 `.gitifact/overrides/`로 재정의한다.
- 파일 쓰기는 임시 파일·잠금·재검사·복구 자료로 사용자 변경을 보존한다.

## 5. 구성 요소와 의존성

```text
apps/
  cli/            명령 실행, Git·파일 접근, 로컬 HTTP 서버
  browser/        React 브라우저 앱과 정적 빌드
packages/
  core/           명세·위키·이력 규칙과 유스케이스
  contracts/      버전이 있는 외부 DTO·검증 계약
  intro/          언어별 제품 소개 글(README·소개 페이지 공용 원본)
.gitifact/
  wiki/           이 위키(ARCHITECTURE, references, adr)
  assets/         문서가 참조하는 파일
  overrides/      docs <topic> 운영 지침 재정의
  spec/           기능별 요구사항·설계·변경 이유
docs/             날짜별 개발·배포·도입 기록
```

```text
apps/browser ──→ packages/contracts, packages/intro
apps/cli     ──→ packages/core, packages/contracts
```

`apps`는 실행·배포 단위, `packages`는 독립된 책임과 공개 API가 있는 코드 단위다. 패키지는 `apps`를 참조하지 않고 앱끼리 소스를 import하지 않으며 exports로 공개한 진입점만 쓴다. 브라우저는 `core`를 가져오지 않는다. UI 공통 코드는 React 앱이 하나인 동안 브라우저의 `shared/ui`에 둔다. 빈 계층을 미리 만들지 않는다.

| 영역 | 선택 | 이유 |
| :--- | :--- | :--- |
| 언어 | TypeScript, strict, ESM | CLI·브라우저에서 타입과 계약을 공유 |
| 워크스페이스 | pnpm workspaces, 단일 lockfile | 로컬 패키지 경계와 의존 관계를 명시 |
| 브라우저 | React 19 + Vite, Astryx(stone), TanStack Router·Query | 로컬 서버가 제공하는 SPA. 세부는 [브라우저](references/browser.md) |
| 검증 | zod 계약, node:test, Playwright | 외부 계약 검증과 실제 Git 저장소 기반 테스트 |

## 6. 런타임 흐름

- 도입: `init`이 `.gitifact/config.json`과 기준선을 만들고 지침 파일에 블록을 쓴다. 커밋하지 않는다.
- 기록: 에이전트가 `spec working`으로 stamp를 얻고 `spec save`로 저장한다. CLI가 ID를 발급하고 형식을 검증하며 stamp가 다르면 거부한다.
- 커밋: `spec commit`이 이유를 history.jsonl에 쓰고 선택한 파일만 임시 index로 커밋한 뒤 결과를 검증한다. 훅 거부 시 이전 상태로 돌린다.
- 조회: `browser`가 로컬 서버를 띄우고 작업 트리와 Git 이력을 계약으로 응답한다. 세부는 [CLI](references/cli.md)와 [브라우저](references/browser.md).

## 7. 배포와 운영

npm 패키지 `gitifact` 하나에 CLI 번들, 브라우저 정적 빌드, 언어별 지침·패치노트를 담는다. 설치된 CLI는 workspace 원본이나 Vite 개발 서버 없이 동작해야 한다. `update`가 새 버전을 알리고 블록을 갱신하며 설치는 사용자가 한다. 릴리스 절차와 기록은 `docs/`에 둔다.

## 8. 공통 개념과 참고 표준

| 분류 | 페이지 | 다루는 것 |
| :--- | :--- | :--- |
| CLI | [CLI와 공통 코드](references/cli.md) | 코드 책임, 계약과 오류, 문구(i18n), 저장 규약, 저장·커밋 흐름, 로컬 서버, 빌드·테스트 |
| 브라우저 | [브라우저](references/browser.md) | 화면과 경로, FSD 구성, 데이터 흐름, 레이아웃, 차트, 서버 계약, 문서 링크 |
| 브라우저 | [프론트엔드 개발 환경](references/frontend/development.md) | 실행·빌드·테스트 |
| 브라우저 | [프론트엔드 코드 스타일](references/frontend/code-style.md) | 파일·컴포넌트·상태 규칙 |
| 브라우저 | [프론트엔드 디자인 시스템](references/frontend/design-system.md) | Astryx 사용 규칙 |
| 기록 | [기능 설계 문서](references/design-documents.md) | design.md의 식별자·작성·개정 규약 |

공통 개념: 요구사항·설계·위키 페이지는 파일 안의 ID로 식별하고 경로·제목과 독립적이다. 변경 이유는 커밋 시점에 ID에 연결해 남기며 커밋된 이유는 고치지 않는다. 사용자에게 보이는 문구는 패키지마다 `src/shared/i18n/<lang>/`에 둔다.

## 9. 아키텍처 결정

- [0001. 위키 통합과 frontmatter](adr/0001-wiki-and-frontmatter.md): product·guides를 위키 하나로, 파일 ID를 frontmatter로
- [0002. 지침 재정의](adr/0002-docs-overrides.md): `docs <topic>`의 운영 지침을 프로젝트가 대체하는 방식

## 10. 품질 기준과 검증

통합 검증은 `pnpm check`(타입 검사, 전체 빌드, core·contracts·intro·CLI·브라우저 테스트, 패키지 오프라인 설치 검사)다. 파서·상태 전이·부분 staging·형식 호환·복구는 예상 결과가 고정된 자료로 검증하고, 실패·복구 시험은 임시 저장소에서만 한다. gitifact 자신의 check 결과만으로 구현이 맞다고 판단하지 않는다.

## 자체 적용

이 저장소 자체의 기록에도 같은 CLI를 쓴다. 루트 AGENTS.md의 GITIFACT 블록은 `pnpm cli init`이 쓰고 갱신하며 마커 사이를 직접 편집하지 않는다. CLAUDE.md는 `@AGENTS.md` 한 줄로 같은 파일을 가져온다. 대체 절차는 루트 AGENTS.md를 따른다.
