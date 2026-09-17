## Gitifact Guide

gitifact v{version} · {language} · 저장 규약 schemaVersion 1

CLI: 모든 명령은 `gitifact <cmd>`로 실행한다. 프로젝트 지침이 다른 실행 방법을 지정하면 그것을 따른다.

### 시작할 때

- `gitifact` 명령이 없으면 이 프로젝트에 참여하는 데 필요한 CLI가 설치되지 않은 것이다. 사용자에게 알리고 동의를 받아 `npm install -g gitifact@{version}`으로 설치한 뒤 진행한다. 설치하지 못하면 명세 저장·커밋을 추측으로 대신하지 않는다.
- `gitifact spec working`으로 제품 설명·지침·기능 명세를 읽고 git status와 기존 staging을 확인한다.
- 이 블록은 요약이다. 상세 형식은 `gitifact docs <topic>`으로 읽고 기억으로 채우지 않는다.

### 무엇을 요구사항으로 남기는가

제품 동작과 유지할 제약만 남긴다.

| 요청 | 처리 |
| --- | --- |
| 게시물을 삭제할 수 있게 해주세요 | 요구사항으로 정리한다 |
| 이 내부 함수 이름을 바꿔주세요 | 일반 구현 변경이다 |
| 지금 푸시해주세요 | 작업 지시다. 등록하지 않는다 |
| 외부 서비스 없이 동작해야 합니다 | 제품 제약으로 명세에 반영한다 |

### 규칙

- 명세를 저장하기 전에 `gitifact docs spec`을 읽는다. ID는 CLI가 발급한 값만 쓴다.
- 새 기능은 requirements.md와 design.md를 함께 정리한다(`gitifact docs design`). 요구사항만 요청받으면 따른다.
- 커밋 요청을 받으면 `gitifact docs commit`을 읽고 명세·이유·코드·테스트를 함께 커밋한다.
- 자동 기록은 커밋 권한이 아니다. 사용자 요청이나 명시적 프로젝트 정책이 있을 때만 커밋하고 푸시는 별도 요청을 따른다.
- 불명확한 제품 동작만 질문하고 독립적인 작업은 진행한다. 기존 기능 전체 도출은 요청받았을 때 한다.
- SELF-CHECK: save·commit 입력을 만들기 전에 해당 docs를 다시 읽고 형식을 대조한다. 확실하지 않으면 추측하지 말고 `gitifact docs <topic>`을 실행한다.
- save·commit 입력 JSON은 `spec working`이 알려 준 inputs 경로에 쓴다. 성공하면 CLI가 지운다. 조회 결과와 docs 출력은 파일로 저장하지 않고 필요할 때 다시 실행한다.
- 사용자가 요구사항·프로젝트 현황·변경 이력을 보여 달라고 하면 `gitifact browser`를 백그라운드로 실행하고 출력된 URL을 알려 준다. 채팅 요약으로 대신하지 않는다.

### 명령

- `docs <topic>`: {topics}
- `spec working`: 현재 명세·제품·지침 전체, stamp, 입력 파일 경로 (`--stamp`, `--feature <이름>`, `--ids`)
- `spec save --file <json|->`: 요구사항·설계·문서 저장
- `spec commit --file <json|->`: 변경 이유 기록과 커밋을 한 번에
- `browser`: 읽기 전용 브라우저 서버 실행, URL 출력 후 계속 실행
- `update [--commit]`: 새 버전 확인과 설치 안내, 이 블록을 현재 버전으로 갱신. `--commit`은 블록만 바뀐 파일을 고정 메시지로 커밋한다
- `init`: 처음 도입할 때 설정과 이 블록을 만든다

---
