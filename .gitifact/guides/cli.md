<!-- gitifact-guide: G-nnbppll2p5 -->

# CLI와 공통 코드

CLI는 사용자 입력과 실행 환경을 받아 제품 규칙을 실행하는 진입점이다. 터미널 명령과 브라우저 API가 같은 규칙을 사용한다.

## 코드 책임

```text
apps/cli/src/
  main.ts            프로세스 시작과 명령 연결 (Commander)
  commands/          인자 해석, 유스케이스 호출
  adapters/git/      Git 실행과 스냅샷 읽기
  adapters/filesystem/  파일·잠금·보존·복구
  adapters/skills/   스킬 탐색과 관리 대상 배포
  output/            core 결과를 버전 있는 DTO·텍스트로 변환
  server/            HTTP·정적 파일 제공과 실행 수명
packages/core/src/
  domain/            상태·사건·진단
  formats/           공개 형식별 파싱·검증 (명세·문서·이유)
  use-cases/         조회·검사·기록의 작업 흐름
  ports/             저장소·파일·시계 등 외부 입력 계약
packages/contracts/src/
  versions/          외부 JSON 계약과 런타임 검증
```

명령은 인자와 환경을 확인해 core를 호출하고 결과를 출력한다. Git 실행·전역 시간·파일 시스템을 core 안에서 직접 호출하지 않는다. 필요한 경계를 작은 port로 정의하고 CLI에서 구현체를 연결하되, 모든 함수에 인터페이스나 클래스를 만들지는 않는다. Git·파일 어댑터는 CLI만 쓰는 동안 앱 안에 둔다.

## 계약과 오류

내부 domain 모델과 외부 JSON DTO를 구분한다. `contracts`는 브라우저에서도 실행 가능한 타입·검증·오류 코드를 제공하고 Node.js 전용 코드를 포함하지 않는다. CLI 출력과 HTTP 응답은 같은 버전별 DTO를 쓴다.

stdout에는 선택한 출력 형식만 내보내고 로그·진행 상황은 stderr로 보낸다. 검사 실패·진단 발견·미실행을 하나의 boolean으로 합치지 않는다. 형식 해석은 공개 버전별로 분리하고 과거 의미를 보존하며 알 수 없는 형식으로 쓰지 않는다. Git 명령에는 shell 문자열 대신 인자 배열을 쓰고 경로·참조·종료 코드를 확인한다. Git과 파일 접근은 호출된 현재 checkout 기준이다.

## 저장 규약

`.gitifact/config.json`은 `schemaVersion: 1`과 `baseline`만 쓴다. baseline은 최초 도입 기준점이며 규약 버전 변경으로 갱신하지 않는다.

기록 집합은 다음 파일이다. 모두 UTF-8이며 1 MiB, 전체 16 MiB 한도가 있다.

- `.gitifact/spec/<기능>/requirements.md`, 선택적인 `design.md`, 변경 이유가 생겼을 때 `history.jsonl`
- `.gitifact/product/PRODUCT.md` 하나와 `.gitifact/product/history.jsonl`. 같은 폴더의 이미지는 파싱하는 기록은 아니지만 제품 설명과 함께 커밋한다. 커밋 선택과 서버 제공 모두 제품 폴더 바로 아래의 이미지 파일(png·jpg·gif·svg·webp)만 허용하며 규칙은 core가 한 곳에서 정의한다. 그 밖의 `.gitifact` 파일은 여전히 삭제만 선택할 수 있다.
- `.gitifact/guides/**/*.md`(깊이 8, 소문자·숫자·하이픈 이름)와 `.gitifact/guides/history.jsonl`

ID는 CLI가 발급하는 소문자 base32 10자다. 명세 S-, 요구사항 R-, 제품 P-, 지침 G-, 이유 H-. 파일 첫 줄의 HTML 주석 마커로 식별하며 경로·제목과 독립적이다. 이유 기록은 `{id, requirements, designs?, documents?, reason}`이고 커밋된 기록은 수정·삭제하지 않는다. 원문·작성자·시각은 JSONL에 복제하지 않고 Git에서 읽는다.

과거 커밋의 `.tryce` 경로와 `tryce-*` 마커는 읽기만 지원한다. 구형 JSON 형식은 `gitifact migrate`로 전환하며 자동 전환하지 않는다. 신구 명세가 혼합된 커밋은 거부한다.

## 저장과 커밋 흐름

`spec working` → `spec save --file`(expected stamp와 operations) → `spec commit --file`(reasons·paths·message·authorization)이다. save는 잠금 아래 stamp를 대조하고 실제로 바뀐 파일만 반영하며 실패 시 원복하고 복구 자료를 남긴다. commit은 격리 index로 선택 파일만 staging하고, 훅·필터가 원문을 바꾸면 거부하며, HEAD가 바뀐 불확실한 실행은 복구 자료를 보존한다. 커밋 메시지 트레일러는 `Gitifact-Req`·`Gitifact-Design`·`Gitifact-Doc`이다. deprecated인 `prepare·verify·commit-plan·commit-apply`에는 기능을 확대하지 않는다.

## 로컬 서버

`node:http`로 제공하며 별도 프레임워크를 두지 않는다. loopback에 바인딩하고 Host·Origin·세션 헤더를 검증한다. 클라이언트의 임의 경로로 로컬 파일이나 명령을 실행하지 않는다. GET은 정의한 조회만 수행하고 재검사는 별도 POST로 받아 중복 실행을 제어한다. 제품 이미지는 `/api/v1/product/assets/<파일명>`으로 제품 폴더 바로 아래의 이미지 파일(5 MiB 이하)만 제공한다. 편집 endpoint는 두지 않는다.

## 빌드·배포·테스트

core·contracts를 먼저 빌드하고 browser, cli 순으로 빌드한다. CLI 패키징은 필요한 내부 코드를 번들하고 브라우저 정적 파일과 스킬 자산을 수집한다. 배포 검증은 packed artifact를 새 임시 폴더에 설치해 수행한다(`pnpm test:package`).

- core는 고정 입력으로 형식·상태 전이·진단을 시험한다.
- Git·파일 어댑터는 임시 저장소에서 index·작업 트리·이력·worktree를 구분해 시험한다.
- CLI는 인자, stdout/stderr, 종료 코드, 잘못된 형식과 실패 후 복구를 확인한다.
- 서버는 조회 범위·재검사·정적 파일·잘못된 입력을 시험한다.

Gitifact 자신의 check 결과만으로 구현이 맞다고 판단하지 않는다. 실제 프로젝트의 기록을 실패 사례의 실험 대상으로 쓰지 않는다.
