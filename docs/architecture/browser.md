# 브라우저 아키텍처

> MVP의 목표 화면은 요구사항 이력·제품 기능·기여자다. [MVP 전환 계획](../mvp-transition.md)의 화면 합의를 따르며 React·Astryx·FSD·Router·Query 지침은 유지한다. 최신 구현은 문서 마지막의 새 MVP 화면 연결을 따른다. 아래 workspace·판단 기록 설명은 교체 전 설계 기록이다.


브라우저는 CLI가 제공하는 프로젝트 기록과 현재 환경을 살펴보는 React 앱이다. 요구사항과 스킬을 편집하는 기능은 현재 범위에 포함하지 않는다. 전체 코드 경계는 [아키텍처 기준](README.md)을 따르고, 실제 작성 규칙은 [프론트엔드 지침](frontend/README.md)을 적용한다.

## React와 Astryx

React 19, TypeScript, Vite 기반 SPA를 사용한다. 로컬 조회 도구에 서버 렌더링이나 별도 웹 백엔드가 필요하지 않으므로 첫 구현에 Next.js나 TanStack Start는 도입하지 않는다. React 공식 문서는 Vite 같은 빌드 도구로 앱을 구성할 때 라우팅과 데이터 조회를 함께 설계하도록 안내한다. [React 문서](https://react.dev/learn/build-a-react-app-from-scratch), [Vite 문서](https://vite.dev/guide/).

Astryx는 Meta의 React·StyleX 기반 디자인 시스템이다. 기본 컴포넌트와 테마를 활용하고, 레이아웃·간격·색상은 디자인 토큰을 우선한다. 문서상 배포 CSS를 사용하는 Vite 구성에는 StyleX 빌드 플러그인이 필요하지 않다. StyleX 런타임 peer dependency와 앱에서 StyleX 문법을 직접 빌드하는 것은 구분한다. [Astryx 저장소](https://github.com/facebook/astryx), [Vite 사용 안내](https://github.com/facebook/astryx/blob/main/packages/core/README.md#vite).

2026-09-13 npm 메타데이터 조회 결과는 다음과 같다. 설치·실행 검증 결과는 아니다.

| 패키지 | 조회 버전 | peer 조건 |
| :--- | :--- | :--- |
| `@astryxdesign/core` | 0.6.0 | React·React DOM >=19, `@stylexjs/stylex` ^0.19.0 |
| `@astryxdesign/theme-stone` | 0.6.0 | React >=19, core 0.6.0 |

근거는 `npm view <package> version peerDependencies --json`이다. 설치 시 core와 테마의 호환 조합을 다시 확인하고 정확한 버전과 lockfile을 기록한다. beta 단계이므로 업데이트는 별도 변경으로 검증한다.

초기에는 neutral 테마를 사용했고 현재는 stone 테마를 사용한다. 최종 색상과 밀도는 와이어프레임에 맞춘다. 전역 CSS는 reset → Astryx 컴포넌트 CSS → 테마 → 앱 스타일 순서로 구성한다. 앱의 보조 스타일은 CSS Modules를 기본으로 한다. Tailwind나 앱 자체의 StyleX 컴파일 환경은 필요가 확인되면 추가한다.

모든 Astryx 컴포넌트를 단순 재수출하는 래퍼는 만들지 않는다. 테마·provider·라우터 링크 연동, 반복되는 제품별 표시 규칙처럼 실제 차이가 있는 부분만 감싼다. 테이블·탭·오류 표시 등은 선택한 Astryx 버전의 실제 API를 확인한 뒤 사용한다.

## FSD 적용

사용자가 지정한 FSD 2.0의 계층·슬라이스·세그먼트와 공개 API 원칙을 기준으로 한다. 최신 공식 reference의 관련 원칙을 참고하되 특정 릴리스 문서를 그대로 고정 복제했다는 의미는 아니다. `processes`는 사용하지 않는다. 계층은 필요한 만큼만 추가한다. [FSD layers](https://feature-sliced.design/docs/reference/layers).

```text
apps/browser/src/
  app/
    entrypoint/          앱 시작
    providers/           Theme·QueryClient·Router 구성
    routes/              파일 기반 route 연결
    styles/              전역 스타일
    routeTree.gen.ts     라우터 생성물
  pages/
    workspace/           브리핑·요구사항·판단 기록
    git-status/          Git 관측 화면
    about/
  widgets/               여러 화면의 독립적인 UI 블록이 생기면 추가
  features/              재검사 등 재사용되는 사용자 동작이 생기면 추가
  entities/              여러 화면이 공유하는 도메인 표시·조회가 생기면 추가
  shared/
    api/                 HTTP 전송·계약 검증·공통 오류
    ui/                  공통 UI와 Astryx 연동
    config/              환경 설정
    lib/                 목적이 명확한 작은 라이브러리
```

실제 시작은 `app`, 필요한 `pages`, `shared`다. 한 화면에서만 사용하는 조회·표시 코드는 그 page에 둔다. 재사용과 책임 분리가 필요해지면 `entities`, `features`, `widgets`로 옮긴다. 각 슬라이스 안에서는 `ui`, `api`, `model`, `lib` 등의 역할별 세그먼트를 사용한다. [Slices and segments](https://feature-sliced.design/docs/reference/slices-segments).

import는 `app → pages → widgets → features → entities → shared` 방향으로만 내려간다. 같은 계층의 다른 슬라이스를 직접 참조하지 않고 상위 계층에서 조합한다. App과 Shared는 도메인 슬라이스로 나누지 않는 예외다. 슬라이스 외부에서는 공개 API를 사용하며, 내부 파일로 깊게 접근하지 않는다. [Public API](https://feature-sliced.design/docs/reference/public-api).

`app/routes`는 URL·loader·page를 연결하는 얇은 구성 계층이다. 화면과 도메인 로직을 route 파일에 몰아넣지 않는다. pages나 features에서 `app/routes`를 역으로 import하지 않는다. 탐색에 필요한 값은 입력으로 받거나 하위 계층의 경로 계약을 사용한다.

## Router와 Query의 역할

TanStack Router의 파일 기반 라우팅을 사용한다. Vite 플러그인의 route 입력을 `src/app/routes`, 생성 파일을 `src/app/routeTree.gen.ts`로 지정한다. 생성 파일은 직접 편집하지 않으며 빌드·타입 검사 전에 생성하는 절차를 둔다. [Router Vite 설정](https://tanstack.com/router/latest/docs/framework/react/installation/with-vite).

Router는 경로 매칭, 요구사항 ID 같은 path parameter, 필터·정렬·페이지 같은 URL search 상태를 관리한다. URL 입력은 검증한다. 선택한 프로젝트를 임의의 파일 시스템 경로 파라미터로 바꾸어 서버에 전달하지 않는다.

TanStack Query도 채택한다. 읽기 전용 화면이라도 프로젝트·요구사항·스킬 화면이 같은 데이터를 사용하고, 재검사 이후 여러 화면의 조회 결과를 갱신해야 하기 때문이다. 컴포넌트별 fetch와 개별 캐시를 반복 구현하지 않도록 한다. Router의 loader는 같은 query options로 필요한 데이터를 준비하고, 화면은 Query 캐시를 구독한다. 같은 응답을 Router와 Query의 독립된 서버 상태로 이중 관리하지 않는다. [Router 외부 데이터 연동](https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading).

| 상태 | 소유 위치 |
| :--- | :--- |
| 경로·검색·정렬·페이지 | Router의 검증된 URL 상태 |
| API 응답·조회 오류·갱신 상태 | Query |
| 펼침·임시 선택·툴팁 | React의 지역 상태 |
| 테마·앱 구성 | app provider와 필요한 설정 |

첫 구현에 별도 전역 상태 라이브러리를 추가하지 않는다.

## 조회와 갱신 정책

Query key에는 프로젝트·worktree 식별자, 조회 범위, 검증된 필터, 출력 계약 버전을 반영한다. 과거 조회는 대상 커밋 또는 고정 스냅샷도 포함한다. 현재 상태 조회는 안정된 key를 두고 응답의 스냅샷 식별자·확인 시각을 표시한다. 여러 응답을 조합할 때 다른 스냅샷을 같은 시점으로 표시하지 않는다.

캐시된 결과가 있다는 것과 서버의 현재 상태라는 것은 다르다. 재조회 중에는 이전 결과와 갱신 중 표시를 함께 보여줄 수 있지만, 실패나 미실행을 clean으로 바꾸지 않는다. 페이지 조회 도중 스냅샷이 바뀌면 재조회 필요 상태를 처리한다.

재검사는 서버에 명시적으로 요청하고 성공 후 관련 조회를 무효화한다. 요구사항·승인·스킬 원본은 수정하지 않는다. 재검사 실패는 별도로 표시하고 기존 결과의 확인 시점을 유지한다. optimistic update로 진단을 먼저 clean으로 만들지 않는다.

Query의 기본 stale·재시도·포커스 재조회 정책은 그대로 두지 않고 endpoint 특성에 맞게 설정한다. 현재 상태 GET은 짧은 staleTime과 제한된 재시도를 적용하고, 형식 비호환·검증 실패는 자동 재시도하지 않는다. 과거 커밋의 고정 조회는 장기 캐시가 가능하다. 재검사 요청은 자동 재시도하지 않는 것을 기본으로 한다. GET으로 화면을 열 때마다 무거운 전체 검사가 재실행되도록 만들지 않는다. 구체적인 시간값은 통합 실행에서 정한다. [Query 기본 동작](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).

## 실제 구현에서 확인할 것

- Astryx 테마·CSS 순서·키보드 조작·포커스와 대비
- Router의 직접 URL 진입, 새로고침, 뒤로 가기, search 검증
- loading·빈 결과·오류·미실행·비활성·이전 결과·호환 불가 상태
- 재검사 후 목록과 상세의 일관된 갱신, 다른 worktree 캐시의 혼합 방지
- mock과 실제 API가 같은 계약을 사용하며 잘못된 응답을 거부하는지
- 정적 배포에서 client route fallback과 API 오류가 구분되는지
- 초기 번들에 Node.js 파일·프로세스 모듈이 들어오지 않는지

와이어프레임과 mock은 화면 구현을 돕는 자료다. 이를 실제 Git 검사나 에이전트 스킬 로딩의 성공 근거로 사용하지 않는다.

## 읽기 전용 화면 적용

2026-09-14 browser-design-v2의 사이드 메뉴·촘촘한 행·오른쪽 상세 구조를 실제 데이터에 연결했다. 브리핑, 요구사항, 판단 기록, Git 상태를 제공한다. 전체 추적 그래프·건강 검사·스킬 탐색은 실제 계약이 준비되기 전까지 메뉴와 가짜 결과를 만들지 않는다.

공유 session/status/project 조회는 entities/project, 전체 메뉴는 widgets/app-shell, 본문은 pages가 소유한다. workspace의 검색·영역·상태·상세 선택은 검증된 URL search에 둔다. 전체 데이터를 한 번 읽고 로컬에서 필터링하므로 필터마다 별도 Query 캐시를 만들지 않는다. API와 보안 경계는 [로컬 서버 계약](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/browser-server.md)을 따른다.

## 2026-09-14 새 MVP 화면 연결

기본 경로 /는 요구사항 이력, /features는 제품 기능, /contributors는 기여자다. 구형 브리핑·승인·note 페이지를 제거했고 /requirements는 제품 기능의 기존 URL 진입으로 유지한다. pages/product 슬라이스 안에서 화면을 조합하고 공통 세션·명세 Query는 entities/project가 소유한다.

/api/v1/specs는 현재 Markdown 명세, 최신 변경 커밋 10개와 그 요구사항 차이, Git 작성자 집계를 반환한다. cursor/head로 다음 범위를 요청하며 HEAD가 달라지면 이어 읽기를 거부한다. 필터는 불러온 이력 범위에 적용하고 이전 이력 더 보기로 확장한다. 모든 과거 자료가 필터에 포함됐다고 표시하지 않는다. first-parent 이력의 실제 부모와 비교하며 그래프는 표시 중인 같은 R-ID만 연결한다. 분리·통합의 영속 관계가 없으므로 임의의 분기나 병합을 만들지 않는다.

현재 기능 목록은 작업 폴더 기준이며 미커밋 명세를 표시한다. 이력은 Git 커밋 기준이다. 기여자는 현재 HEAD에서 도달 가능한 최근 최대 10,000개 커밋의 mailmap 적용 author 이름·이메일로 집계한다. 초과 시 제한을 표시한다. 기능 참여·최근 명세 활동은 불러온 이력 범위이며 커밋 수를 요구사항 기여 수나 승인으로 해석하지 않는다. 이메일 기반 대칭 아바타는 로컬에서 생성하며 외부 이미지 조회를 하지 않는다.

과거 명세는 고정 커밋 ID로 캐시하고 동시 요청을 공유한다. 현재 설정·명세 원문·HEAD는 재확인하며 오류 시 이전 성공을 현재로 가장하지 않는다. 조회는 best-effort이며 원자적 Git 전체 스냅샷이 아니다. 새 스키마 도입 이전 구형 JSON은 이력 경계로 표시하고 통합 해석하지 않는다. 장기 전체 이력 색인·검색, 임의 관계 편집, 자동 완료 판정은 아직 없다.

기존 Host/Origin·세션·메서드·요청 본문·정적 파일 경계를 유지한다. 새 조회 인자는 cursor와 head만 허용하며 사용자 파일 경로·Git 명령을 받지 않는다. Markdown은 Astryx의 안전한 렌더링을 사용하며 원시 HTML을 실행하지 않는다. 요구사항 상세는 조건과 기대 동작의 줄바꿈을 일반 텍스트로 표현한다.

## 요구사항 그래프 배치

연결선은 @visx/shape 4.0.0의 LinePath와 @visx/curve의 세로 단조 곡선으로 그린다. 목록의 최신순 행 위치는 바꾸지 않는다. 같은 R-ID의 첫 행부터 마지막 행까지 하나의 열을 예약하고, 구간이 끝나면 다른 요구사항이 그 열을 재사용한다. 관련 이력이 없는 점과 연결 구간의 시작·끝은 기준 열에 정렬한다. 선택한 요구사항의 선을 강조하며 서로 다른 R-ID나 Git 브랜치를 임의로 연결하지 않는다.

그래프 폭은 88px로 유지한다. 동시 구간이 많으면 열 간격을 줄이므로 매우 밀집한 기록은 필터로 좁혀 읽어야 한다. 모바일에서는 SVG 높이를 행 높이에 맞춰 유지하고 가로 폭만 줄인다. 필터·페이지 추가로 보이는 구간이 바뀌면 열과 색상도 다시 배정되며 색상은 고정된 요구사항 식별자가 아니다.

연결되지 않은 요구사항의 노드는 표시하지 않는다. 현재 필터 결과에 연결 구간이 없으면 그래프와 안내 문구를 숨기고 그래프 여백도 제거한다. 이력 행의 기본·선택·호버 배경은 둥근 모서리 없이 표시한다.

## 설계 문서와 명세 이력

[기능 설계 문서](design-documents.md)를 제품 기능의 설계 탭에 표시한다. 이력 항목의 kind로 요구사항/설계를 구분하고 같은 커밋의 항목을 연속 표시한다. 설계 S-ID와 요구사항 R-ID의 그래프는 각각 같은 대상을 연결한다. 참조 링크와 탭 선택은 URL에 반영한다. 저장소에 설계가 없어도 정상적인 미작성 상태로 안내한다.
