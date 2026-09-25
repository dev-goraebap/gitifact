## Gitifact Guide

gitifact v{version} · {language} · 저장 규약 schemaVersion 3

제품 동작(요구사항·설계), 지침, 결정기록은 `.gitifact/`에 저장하고 CLI `gitifact`로 관리한다. 프로젝트가 별도 실행 방법을 정했다면 해당 방식을 `gitifact`로 적용한다.

### 세션을 시작할 때

1. `gitifact --version`이 {version}인지 확인한다. 없거나 다르면 `npm i -g gitifact@{version}` 설치를 제안하고, 그전까지는 `npx --yes gitifact@{version} <cmd>`로 실행한다. 실행이 막히면 승인을 요청한다.
2. `gitifact update --check`를 1회 실행한다. 새 버전이 있으면 업데이트 여부를 묻고, 동의할 때만 설치 후 `update`를 실행한 뒤 이 블록을 다시 읽는다.
3. `gitifact instructions list --all`로 지침을 모두 확인하고 git status와 기존 staging 상태를 점검한다.

### 무엇을 요구사항으로 남기는가

제품 동작과 유지할 제약만 남긴다.

| 요청 | 처리 |
| --- | --- |
| 게시물을 삭제할 수 있게 해주세요 | 요구사항으로 등록한다 |
| 이 내부 함수 이름을 바꿔주세요 | 일반 구현 변경이다 |
| 지금 푸시해주세요 | 작업 지시다. 등록하지 않는다 |
| 외부 서비스 없이 동작해야 합니다 | 제품 제약으로 명세에 반영한다 |

### 작업할 때

| 상황 | 선행 작업 |
| --- | --- |
| 제품 동작 관련 요구 | `specs list --type requirement`로 기존 명세와 충돌 여부를 확인한다 |
| 코드나 문서 수정 전 | 해당 기능의 요구사항·설계(`specs show <ID>`), 블록 밖 색인이 가리키는 지침, 대상 문서의 결정 흐름(`records list --doc <ID>`)을 확인한다 |
| 문서 신규 작성 | `guide show spec`(설계는 `design`, 지침은 `instructions`)과 `guide show writing`을 읽는다. ID는 `specs new`·`instructions new`로 발급받고, 수정 후 `gitifact check`로 확인한다 |
| 기존 문서 수정 또는 대안 결정 | `records new`로 결정기록을 작성한다(`guide show records`) |
| 커밋을 요청받았을 때 | `guide show commit`을 확인하고, `changes list`가 안내한 파일에 입력을 작성한 뒤 `changes commit`한다 |
| 기록 조회를 요청받았을 때 | `gitifact browser`를 백그라운드로 실행하고 URL을 안내한다 |
| Gitifact 버그·개선 제보 | 초안을 사용자에게 확인받고 `gitifact feedback`으로 전송한다 |

### 지킬 것

- 커밋은 사용자 요청이나 프로젝트 정책이 있을 때만 수행하고, 푸시는 별도로 요청받는다. 결정 단위마다 기록·문서·코드·테스트를 함께 커밋하며, 작업을 마치고 커밋하지 않았으면 1회 제안한다.
- CLI를 실행하지 않고 ID 발급·검사·커밋을 대신하거나 완료로 보고하지 않는다.
- 새 기능은 요구사항과 설계를 함께 작성하고 문서는 프로젝트 언어로 작성한다. 불명확한 제품 동작만 질문하고 나머지는 진행한다.
- SELF-CHECK: 이 블록은 요약이다. 문서나 커밋 입력을 만들기 전에 `gitifact guide show <topic>`으로 형식을 다시 확인하고 기억으로 채우지 않는다. 조회 결과는 파일로 저장하지 않는다.

### 명령

- `specs`·`instructions`·`records`: `list`·`show`·`new`. `check`: 전체 검사. `changes list`·`changes commit --file <json> [--dry-run]`
- `browser`, `feedback`, `update [--check | --commit]`, `init`, `guide list`·`guide show <topic>` ({topics}). 목록은 20개씩 출력되며 끝의 `--after <값>`으로 이어 조회한다(`--all`은 전체). `--fields`, `--format json`을 지원하며 옵션은 `--help`로 확인한다.

---
