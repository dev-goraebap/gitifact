---
id: W-dmcvdbs53b
---

# CLI와 공통 코드

CLI는 사용자 입력과 실행 환경을 받아 제품 규칙을 실행하는 진입점이다. 터미널 명령과 브라우저 API가 같은 규칙을 사용한다.

## 코드 책임

```text
apps/cli/src/
  main.ts            프로세스 시작과 명령 연결 (Commander)
  commands/          인자 해석, 유스케이스 호출
  adapters/git/      Git 실행과 스냅샷 읽기
  adapters/filesystem/  파일·잠금·보존·복구 (설정·지침 파일 어댑터)
  output/            core 결과를 버전 있는 DTO·텍스트로 변환
  server/            브라우저 서버: browser-server(수명), http/(검사·라우터·응답·앱 파일),
                     routes/(경로 표), checkout/(작업 폴더 체크아웃), history/(이력 색인)
  shared/i18n/       사용자에게 보이는 문구와 언어별 Markdown
packages/core/src/
  domain/            상태·사건·진단
  formats/           공개 형식별 파싱·검증 (명세·문서·이유)
  use-cases/         조회·검사·기록의 작업 흐름
  ports/             저장소·파일·시계 등 외부 입력 계약
  shared/i18n/       검증 메시지
packages/contracts/src/
  versions/          외부 JSON 계약과 런타임 검증
```

명령은 인자와 환경을 확인해 core를 호출하고 결과를 출력한다. Git 실행·전역 시간·파일 시스템을 core 안에서 직접 호출하지 않는다. 필요한 경계를 작은 port로 정의하고 CLI에서 구현체를 연결하되, 모든 함수에 인터페이스나 클래스를 만들지는 않는다. Git·파일 어댑터는 CLI만 쓰는 동안 앱 안에 둔다.

## 계약과 오류

내부 domain 모델과 외부 JSON DTO를 구분한다. `contracts`는 브라우저에서도 실행 가능한 타입·검증·오류 코드를 제공하고 Node.js 전용 코드를 포함하지 않는다. CLI 출력과 HTTP 응답은 같은 버전별 DTO를 쓴다.

stdout에는 선택한 출력 형식만 내보내고 로그·진행 상황은 stderr로 보낸다. 검사 실패·진단 발견·미실행을 하나의 boolean으로 합치지 않는다. 형식 해석은 공개 버전별로 분리하고 과거 의미를 보존하며 알 수 없는 형식으로 쓰지 않는다. Git 명령에는 shell 문자열 대신 인자 배열을 쓰고 경로·참조·종료 코드를 확인한다. Git과 파일 접근은 호출된 현재 checkout 기준이다.

## 사용자에게 보이는 문구

언어 하나는 폴더 하나다. CLI·core·브라우저는 각자 `src/shared/i18n/<lang>/`에 문구를 두고 배치를 똑같이 맞춘다. 한국어(`ko`)와 영어(`en`)를 지원한다.

| 문구 | 위치 |
| :--- | :--- |
| 명령·옵션 설명, 텍스트 출력, 오류 메시지, 화면 문구 | `<lang>/messages.json` |
| 에이전트 지침, GITIFACT 블록, 패치노트 (CLI) | `<lang>/docs/*.md`, `<lang>/block.md`, `<lang>/changelog.md` |
| 제품 소개 글 (브라우저 소개 페이지·README·랜딩 사이트 공용) | `packages/intro/<lang>/intro.md` |

- 문구는 `t(key, values)`로 가져온다. 키는 `init.inputChanged`처럼 점으로 구분한 평평한 문자열이고, 값은 `{name}` 자리에 넣으며 문장을 코드에서 이어 붙이지 않는다. 브라우저에서 `<time>`·`<Link>` 같은 요소가 문장 안에 들어가면 `tNodes()`를 쓴다.
- 키 타입은 JSON에서 파생하므로 없는 키는 컴파일 오류다. 새 언어는 `Record<MessageKey, string>`으로 선언해 누락을 잡는다. 패키지마다 테스트가 호출별 자리 이름과 쓰지 않는 키를 검사한다.
- 같은 내용을 두 곳에 두지 않는다. 블록은 지침의 요약이므로 요청 분류 예시가 workflow 원문에 있는지 테스트로 대조한다. 버전 번호는 package.json과 패치노트에만 두고 README·소개 글에 적지 않는다. README.md는 영어 소개, README.ko.md는 한국어 소개, apps/cli/README.md는 영어 시작하기 원문의 사본이며 테스트로 일치를 확인한다. 로고 파일도 `packages/intro/assets/`에 둔다. 소개 글의 링크는 GitHub·사이트·브라우저에서 같게 읽히도록 절대 URL만 쓰고, 브라우저 소개 페이지는 원시 HTML을 렌더링하지 않으므로 맨 앞 로고 블록을 번들한 로고 이미지로 바꾸고, 요구사항 링크만 앱 안 경로로 바꾼다.
- 오류는 반드시 `code`를 갖고, 코드는 언어와 무관하다. 호출 코드와 에이전트는 코드나 오류 타입으로 분기하며 메시지 본문을 비교하지 않는다.
- 명령·옵션 설명은 `main.ts`에만 둔다. 요구사항 본문 문법(`조건:`·`기대 동작:`)은 화면 문구가 아니므로 카탈로그로 옮기지 않는다. Astryx 컴포넌트 자체 문구는 Astryx의 `InternationalizationProvider` 카탈로그를 따른다.
- 표시 언어는 프로젝트 설정에 저장하지 않는다. CLI는 --lang, GITIFACT_LANG, LC_ALL, LC_MESSAGES, LANG, 운영체제 언어 순으로 결정하며 미지원 언어는 영어다. 브라우저는 자체 설정을 사용한다. HTTP 요청 언어는 AsyncLocalStorage로 분리하고 core에는 resolver만 주입한다. 기존 블록은 --lang을 명시하지 않으면 기록된 언어를 유지하고, 토큰 없는 과거 블록은 한국어로 읽는다. 이전 config.language 구상은 사용자별 설정 요구에 따라 채택하지 않는다. 문서·JSON 키·오류 코드·ID·저장 규약은 표시 언어와 무관하다.
- 공용 locales 패키지는 core에 의존성이 생기고 문구가 코드에서 멀어져 기각했다. 패키지마다 `t()`를 두는 중복을 감수한다.
- 패치노트는 Keep a Changelog 형식에 절 제목을 `Added`·`Changed`·`Removed`·`Fixed`로 고정하고, core 파서가 그 밖의 형식을 거부한다. 버전을 올릴 때 맨 앞에 항목을 쓴다.

## 저장 규약

`.gitifact/config.json`은 `schemaVersion: 1`과 `baseline`만 쓴다. baseline은 최초 도입 기준점이며 규약 버전 변경으로 갱신하지 않는다.

기록 집합은 다음 파일이다. 모두 UTF-8이며 1 MiB, 전체 16 MiB 한도가 있다.

- `.gitifact/spec/<기능>/requirements.md`, 선택적인 `design.md`, 변경 이유가 생겼을 때 `history.jsonl`
- `.gitifact/product/PRODUCT.md` 하나와 `.gitifact/product/history.jsonl`. 같은 폴더의 이미지는 파싱하는 기록은 아니지만 제품 설명과 함께 커밋한다. 커밋 선택과 서버 제공 모두 제품 폴더 바로 아래의 이미지 파일(png·jpg·gif·svg·webp)만 허용하며 규칙은 core가 한 곳에서 정의한다. 그 밖의 `.gitifact` 파일은 커밋에 선택할 수 없다.
- `.gitifact/guides/**/*.md`(깊이 8, 소문자·숫자·하이픈 이름)와 `.gitifact/guides/history.jsonl`

ID는 CLI가 발급하는 소문자 base32 10자다. 명세 S-, 요구사항 R-, 제품 P-, 지침 G-, 이유 H-. 파일 첫 줄의 HTML 주석 마커로 식별하며 경로·제목과 독립적이다. 이유 기록은 `{id, requirements, designs?, documents?, reason}`이고 커밋된 기록은 수정·삭제하지 않는다. 원문·작성자·시각은 JSONL에 복제하지 않고 Git에서 읽는다.

옛 형식은 읽지 않는다. `.tryce` 경로, `tryce-*` 마커, 구형 JSON 기록, Tryce 설정, schemaVersion 1은 지원하지 않고 `migrate` 명령도 없다(2026-09-22). 과거 커밋의 옛 기록은 이력에 기록으로 나타나지 않고 Git에만 남는다.

## 저장과 커밋 흐름

`spec working` → `spec save --file`(expected stamp와 operations) → `spec commit --file`(reasons·paths·message·authorization)이다. save는 잠금 아래 stamp를 대조하고 실제로 바뀐 파일만 반영하며 실패 시 원복하고 복구 자료를 남긴다. commit은 격리 index로 선택 파일만 staging하고, 훅·필터가 원문을 바꾸면 거부하며, HEAD가 바뀐 불확실한 실행은 복구 자료를 보존한다. 커밋 메시지 트레일러는 `Gitifact-Req`·`Gitifact-Design`·`Gitifact-Doc`이다. `prepare·verify·commit-plan·commit-apply`는 0.6.0에서 삭제했다. 이유 기록과 커밋은 `spec commit` 하나다.

## 로컬 서버

`node:http`로 제공하며 별도 프레임워크를 두지 않는다. loopback에 바인딩하고 Host·Origin·세션 헤더를 검증한다. 클라이언트의 임의 경로로 로컬 파일이나 명령을 실행하지 않는다. GET은 정의한 조회만 수행하고 재검사는 별도 POST로 받아 중복 실행을 제어한다. 제품 이미지는 `/api/v1/product/assets/<파일명>`으로 제품 폴더 바로 아래의 이미지 파일(5 MiB 이하)만 제공한다. 편집 endpoint와 명령 실행 endpoint는 두지 않는다.

CLI가 외부로 보내는 요청은 하나다. `init`·`update`·`update --check` 실행 시 `registry.npmjs.org/gitifact`의 최신 버전을 조회하며 프로젝트 정보는 보내지 않는다. 제한 시간 안에 답이 없으면 확인 불가로 처리하고 동작을 막지 않는다. `GITIFACT_NO_UPDATE_CHECK`로 끈다. 브라우저 서버는 새 버전을 조회하지 않는다. 이 요청은 `adapters/registry/`에만 두고 테스트는 조회 함수를 주입해 네트워크 없이 실행한다.

## 빌드·배포·테스트

core·contracts를 먼저 빌드하고 browser, cli 순으로 빌드한다. CLI 패키징은 필요한 내부 코드와 메시지 JSON을 번들하고, 브라우저 정적 파일과 `apps/cli/src/shared/i18n/<lang>/`의 Markdown(지침·블록·패치노트)을 `dist/i18n/<lang>/`으로 수집한다. 배포 검증은 packed artifact를 새 임시 폴더에 설치해 수행한다(`pnpm test:package`). 이때 설치본 패치노트의 첫 버전이 package.json 버전과 같은지, README·소개 페이지에 버전 번호가 없는지도 확인한다.

- core는 고정 입력으로 형식·상태 전이·진단을 시험한다.
- Git·파일 어댑터는 임시 저장소에서 index·작업 트리·이력·worktree를 구분해 시험한다.
- CLI는 인자, stdout/stderr, 종료 코드, 잘못된 형식과 실패 후 복구를 확인한다.
- 서버는 조회 범위·재검사·정적 파일·잘못된 입력을 시험한다.

Gitifact 자신의 check 결과만으로 구현이 맞다고 판단하지 않는다. 실제 프로젝트의 기록을 실패 사례의 실험 대상으로 쓰지 않는다.

## 배포 버전과 Git 태그

0.7.0부터 npm에 게시하는 CLI 버전 `X.Y.Z`와 Git 태그 `vX.Y.Z`를 맞춘다. `apps/cli/package.json`의 버전을 기준으로, 검증하고 실제 게시한 코드 커밋에 주석 태그(annotated tag)를 붙인다. npm 게시를 확인한 뒤 해당 태그만 origin에 푸시하고, 버전·커밋·태그와 확인 결과를 `docs/releases.md`에 기록한다.

게시한 태그는 이동하거나 덮어쓰지 않는다. 배포 후 수정은 새 버전으로 게시한다. 0.7.0 이전 버전의 태그는 소급해서 만들지 않는다.
