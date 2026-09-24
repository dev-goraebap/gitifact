## Gitifact Guide

gitifact v{version} · {language} · 저장 규약 schemaVersion 3

CLI: 기본 실행은 `npx --yes gitifact@{version} <cmd>`다. 아래 `gitifact`는 이 실행 방법을 뜻한다. 프로젝트가 로컬 설치본이나 전역 명령 등 다른 실행 방법을 지정하면 그것을 우선한다.

### 시작할 때

- 전역 설치는 필수가 아니다. 지정 버전의 npx 실행은 같은 버전의 프로젝트 설치본을 사용하고, 없으면 npm 캐시에 받아 실행한다. 실행 권한이나 다운로드가 막히면 필요한 승인을 요청하고 원인을 알린다. CLI 실행 없이 문서 ID 발급·검사·커밋을 대신하거나 완료했다고 보고하지 않는다.
- 새 세션에서 한 번 `gitifact update --check`로 지정 버전보다 새 버전이 있는지 확인한다. `available`이면 사용자에게 업데이트할지 묻고, 동의한 경우에만 안내된 새 버전으로 `update`를 실행한다. 거절·확인 실패·조회 비활성화 시에는 지정 버전으로 계속하며 같은 세션에서 다시 묻지 않는다. 갱신 후에는 블록을 다시 읽고 새 버전을 사용한다. 커밋·푸시는 별도 권한을 따른다.
- `gitifact specs list`·`gitifact instructions list`로 명세와 지침 목록을 읽고 git status와 기존 staging을 확인한다. 필요한 문서는 `specs show <ID>`·`instructions show <이름>`으로 읽는다.
- 이 블록은 요약이다. 상세 형식은 `gitifact guide show <topic>`으로 읽고 기억으로 채우지 않는다.

### 무엇을 요구사항으로 남기는가

제품 동작과 유지할 제약만 남긴다.

| 요청 | 처리 |
| --- | --- |
| 게시물을 삭제할 수 있게 해주세요 | 요구사항으로 정리한다 |
| 이 내부 함수 이름을 바꿔주세요 | 일반 구현 변경이다 |
| 지금 푸시해주세요 | 작업 지시다. 등록하지 않는다 |
| 외부 서비스 없이 동작해야 합니다 | 제품 제약으로 명세에 반영한다 |

### 규칙

- 문서를 만들기 전에 `gitifact guide show spec`을 읽는다. 새 문서는 `gitifact specs new`·`instructions new`로 만들어 ID를 발급받고, 파일을 직접 고친 뒤 `gitifact check`로 확인한다.
- 새 기능은 요구사항과 설계를 함께 정리한다(`gitifact guide show design`). 요구사항만 요청받으면 따른다.
- 기존 요구사항·설계·지침을 바꾸거나 여러 안 중 하나를 고르면 그때 `gitifact records new`로 결정기록을 쓴다(`gitifact guide show records`). 문서를 바꾸기 전에 `gitifact records list --doc <ID>`로 그 문서의 결정 흐름을 읽는다.
- 요구사항·설계·코드를 바꾸기 전에 이 파일의 블록 밖 색인에서 작업에 맞는 프로젝트 지침(`.gitifact/instructions/`)을 찾아 읽고 따른다. 여러 기능에 걸친 규칙은 지침에 두며, 지침과 블록 밖 색인을 고치기 전에 `gitifact guide show instructions`를 읽는다.
- 지침·요구사항·설계 본문을 쓰기 전에 `gitifact guide show writing`의 문체를 따른다. 문서는 CLI 표시 언어와 무관하게 프로젝트의 언어로 쓴다.
- 커밋 요청을 받으면 `gitifact guide show commit`을 읽는다. 결정 하나를 그 결정기록·문서·코드·테스트와 함께 커밋하는 것이 기본이다.
- 자동 기록은 커밋 권한이 아니다. 사용자 요청이나 명시적 프로젝트 정책이 있을 때만 커밋하고 푸시는 별도 요청을 따른다. 작업 하나를 마치고 커밋하지 않은 채 다음 작업으로 넘어가면 커밋을 한 번 제안한다(같은 파일에 두 작업이 섞이면 결정별로 나눠 커밋하기 어렵다). 원하지 않으면 다시 묻지 않는다.
- 불명확한 제품 동작만 질문하고 독립적인 작업은 진행한다. 기존 기능 전체 도출은 요청받았을 때 한다.
- SELF-CHECK: 문서나 커밋 입력을 만들기 전에 해당 지침을 다시 읽고 형식을 대조한다. 확실하지 않으면 추측하지 말고 `gitifact guide show <topic>`을 실행한다.
- 커밋 입력 JSON은 `changes list`가 알려 준 입력 파일 경로에 쓴다. 성공하면 CLI가 지운다. 조회 결과와 지침 출력은 파일로 저장하지 않고 필요할 때 다시 실행한다.
- 사용자가 요구사항·프로젝트 현황·변경 이력을 보여 달라고 하면 `gitifact browser`를 백그라운드로 실행하고 출력된 URL을 알려 준다. 채팅 요약으로 대신하지 않는다.
### 명령

- `guide list`, `guide show <topic>`: 작성 지침 ({topics})
- `specs`·`instructions`·`records`의 `list`·`show`·`new`: 목록(관계·이력·상태 필터, `--fields`), 원문과 참조, ID 발급과 뼈대(`draft: true`). `records list --doc <ID>`는 한 문서의 결정 흐름, `check`는 전체 검사 (옵션은 `--help`)
- `changes list`: HEAD 대비 바뀐 문서, 커밋하지 않은 결정기록, 기록 없는 변경, 커밋 입력 파일 경로
- `changes commit --file <json|-> [--dry-run]`: 문서 검사 뒤 고른 파일과 결정기록을 커밋
- `browser`: 읽기 전용 브라우저 서버 실행, URL 출력 후 계속 실행
- `update [--check | --commit]`: `--check`는 읽기 전용 버전 확인. 옵션 없이는 이 블록을 실행 버전으로 갱신하며 `--commit`은 블록만 바뀐 파일을 고정 메시지로 커밋한다
- `init`: 처음 도입할 때 설정과 이 블록을 만든다

---
