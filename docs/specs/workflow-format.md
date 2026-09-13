# 요구사항과 기록 정책의 실행 형식

`workflow-1`은 자동모드와 승인모드에서 요구사항을 수집하고 확정·확인하는 형식이다. CLI `0.2.0`부터 지원하며 기존 `0.1.0`과 구분한다. 사람이 CLI를 일일이 실행하는 대신 프로젝트의 tryce-workflow 스킬을 읽은 에이전트가 사용한다.

## 설정과 전환

`.tryce/config.json`의 필드는 `kind`, `format`, `mode`, `baseline`이다. kind는 `tryce-project`, format은 `workflow-1`, mode는 `auto` 또는 `approval`이다. baseline은 기존 init-1의 empty 또는 전체 커밋 ID 구조를 유지한다. 신규 `init`은 auto이며 `init --mode approval`로 선택할 수 있다. 기존 설정에서 init을 다시 실행해도 모드·기준선을 바꾸지 않는다.

`mode show`로 조회하고 `mode set auto|approval --reason "사용자 선택 근거"`로 명시적으로 전환한다. `--dry-run`은 쓰지 않는다. 이전 설정의 정확한 바이트를 `.tryce/config.<이전형식>.<SHA-256>.json`에 보존하고 `.tryce/mode-<UUID>.json`에 시각·이전 형식·이전/새 모드·백업·이유를 기록한 뒤 설정을 교체한다. 이 파일의 kind는 `mode-transition-intent`다. 전환 도중 실패하면 의도 기록과 백업이 남을 수 있으므로 그 파일만으로 전환 완료를 판정하지 않는다. 현재 config와 Git 차이를 확인한다.

init-1·prototype-1 읽기와 기존 명령은 유지한다. 기존 값을 새 모드에 자동 매핑하지 않는다. note-1 원문과 도입 기준선은 전환하지 않으며 workflow-1의 두 모드에서 note를 쓸 수 있다. 이 저장소 자체와 `.tmp/demo`는 새 CLI를 빌드했다는 이유로 전환하지 않는다.

## 요구사항 파일

CLI `0.2.1`부터 신규 spec의 저장 위치를 `.tryce/spec/`로 바로잡는다. 0.2.0이 만든 `specs/<spec>/tryce.json`은 호환 경로로 읽고 기존 위치에서 갱신한다. 새 spec은 항상 새 경로에 생성한다. 같은 spec이 양쪽에 있으면 병합하거나 하나를 선택하지 않고 `REQUIREMENT_PATH_CONFLICT`로 중단한다. 기존 파일의 자동 이동은 포함하지 않는다. 새 경로는 0.2.0에서 인식하지 못하므로 이 프로젝트를 다루는 에이전트들은 모두 0.2.1 이상을 사용해야 한다.

spec마다 `.tryce/spec/<spec>/tryce.json` 하나에 요구사항 원문·수정본·확인 묶음·결정을 함께 보존한다. 파일은 UTF-8 JSON, 2칸 들여쓰기와 마지막 LF다. 해당 경로의 일반 문서는 건드리지 않는다. spec은 소문자 알파벳으로 시작하는 영문 소문자·숫자·하이픈 1~40자다.

| 필드 | 내용 |
| :--- | :--- |
| kind / format | `tryce-requirements` / `requirements-1` |
| spec | 디렉터리와 같은 spec 이름 |
| requirements | `{id, revisions}` 배열. ID는 `R-<spec>-<base32 소문자 10자>` |
| revisions | `{id, title, text, at, author, reason}` 배열. ID는 UUID v4, at은 UTC ISO 시각 |
| reviews | `{id, at, items}` 배열. 묶음 ID는 UUID v4 |
| items | `{id, revision, document, blob}`. 요구사항 ID, 수정본 ID, 정확한 문서, Git blob 해시 |
| decisions | `{review, kind, actor, evidence, at, mode}`. kind는 `auto` 또는 `approval`, mode는 당시 정책 |

확인 문서는 `# <요구사항 ID>\n\n<제목>\n\n<본문>\n`이다. 이를 수정본과 함께 보존하고 현재 저장소의 SHA-1/SHA-256 Git blob 방식으로 해시한다. 해시 대상 바이트는 JSON의 document 문자열에 담긴 UTF-8 문서다. 독립 파일이나 loose Git 객체를 만들었다는 뜻은 아니다. 읽을 때 원문·수정본·해시가 일치하는지 검사한다.

CLI는 기존 배열을 지우거나 수정하지 않고 추가한다. HEAD와 index에 있는 기존 수정본·묶음·결정이 작업 폴더에서 변경·삭제됐으면 쓰기와 조회를 거부한다. 아직 Git에 보존하지 않은 과거 바이트를 인증하거나 모든 Git 이력을 검사하지는 않는다. 알 수 없는 필드, 중복 ID, 없는 참조, 잘못된 UTF-8, 링크, 손상·삭제·잠금은 오류다.

현재 상한은 spec 파일당 64 KiB, 전체 요구사항 16 MiB, 각 배열 1,000개, 묶음 1~32개, 제목 200자, 본문 16,000자, 작성자 120자, 근거 2,000자다. 보존한 묶음 원문도 파일 상한에 포함된다. 한도 초과는 저장 전에 거부한다. 장기 사용을 위한 파일 분할·압축은 후속 작업이다.

## 상태와 명령

`req draft`는 제목·본문·작성자·근거를 받아 draft를 만든다. `req revise ID --expected 수정본ID`는 같은 ID의 수정본을 추가한다. 확정된 요구사항에는 의미를 유지하는 수정임을 나타내는 `--amend`도 필요하다. 새 의미는 새 ID로 만든다. superseded·cut 관계의 영속 상태 전이는 이번 구현에 포함하지 않는다.

`req review ID...`는 같은 spec의 관련 항목을 묶는다. 일부만 확인하면 수락한 항목만으로 새 묶음을 만든다. 여러 spec은 각각 준비한 묶음을 함께 보여줄 수 있다. `req activate 묶음ID --by 에이전트 --evidence 근거`는 auto에서만 허용하고 실제 사용자 승인은 만들지 않는다. `req approve 묶음ID --by 확인자 --evidence 실제답변근거`는 실제 확인을 기록한다. 승인자의 신원이나 대화의 진위를 CLI가 인증하지는 않는다. 에이전트가 실제 답변에 근거해 실행해야 한다.

묶음 이후 최신 수정본이 바뀌면 확정을 거부한다. 같은 묶음의 같은 결정을 재실행하면 기존 결과를 반환하고 다른 결정으로 덮어쓰지 않는다. 자동 확정 후 실제 승인을 기록하려면 새 묶음을 만들어 approve한다. 수정본에 결정이 있으면 active, 없으면 draft다. 사용자 승인 표시와 활성 상태는 별개이며, mode 변경으로 과거 상태를 재작성하지 않는다.

`req list/show`와 `brief`가 현재 상태를 보여준다. 구현·검증 완료는 자동 추정하지 않고 `not-assessed` / `not-run`으로 반환한다. workflow-1의 init·brief는 각각 출력 계약 버전 2, mode·req·commit은 `workflow` 버전 1이다. legacy init·brief와 note 출력은 버전 1을 유지한다. 초기화 실패 시에는 기존 project-init 오류 계약 버전 1을 사용한다.

## Git 계획과 실행

커밋 정책의 자연어 해석, 현재 권한, 파일의 관련성과 작성 주체는 에이전트가 판단한다. 정책이 없음을 확인했으면 작업 단위에서 자동 커밋하고, 정책이 있으면 그 시점·메시지·브랜치·서명·리뷰 규칙을 따른다. 커밋 권한이 없거나 불명확하면 기록 파일만 보존한다.

`commit plan --path 상대파일 ... --message 메시지 --policy no-policy|permitted --evidence 근거`는 정확한 파일 내용, HEAD·index와 저장소 상태, 설정과 관련 경로의 AGENTS.md·CLAUDE.md·스킬 원본 해시를 담은 계획을 반환한다. 추가 지침은 `--policy-file`로 지정한다. 외부 지침과 채팅 권한은 apply 직전에도 에이전트가 확인한다. 반환한 `data.plan` 객체를 임시 JSON 파일로 저장한 뒤 `commit apply --file 파일`로 실행한다. 계획 파일에는 경로와 해시·근거가 담기므로 원격으로 보내지 않는다.

생성한 커밋은 `Tryce-Format: workflow-1`을 남긴다. `--req ID`로 관련 요구사항을 참조하며 기록 파일을 담는 일반 커밋은 그 파일의 요구사항을 참조한다. 실제 ID에 대응하는 `Tryce-Req`와 `Tryce-Spec`을 생성한다. 구현을 연결하려면 확정된 대상 ID들을 `--req`로 명시하고 `--implement`를 사용해 `Tryce-Change: implement`를 남긴다. 이 선언만으로 완료나 테스트 통과를 판정하지 않는다. Tryce 트레일러는 메시지 본문에 직접 입력하지 않고 계획에서 생성한다.

이 개발 형식은 전체 형식 1이 아니다. 나머지 사건 트레일러의 추론, 혼합 사건 검사, Tryce-Ack 억제 규약과 모든 과거 커밋 검사는 아직 지원하지 않는다. 승인·자동 확정·수정 사건의 정확한 정보는 requirements-1의 보존된 배열에서 읽는다. 커밋 계획은 파일 128개·각 16 MiB·계획 JSON 64 KiB 이하로 제한한다.

기존 staging, 링크·중첩 저장소·서브모듈·16 MiB 초과 파일, 계획 이후 파일·지침·HEAD·index 변경은 거부한다. 첫 구현은 미커밋 tryce 기록이 계획에서 빠져도 거부한다. 무관한 기록을 억지로 포함하지 말고 관련성을 확인해 기록 단위를 먼저 정리한다. 한 파일의 일부 변경만 선택하는 기능은 없다.

apply는 실제 index 잠금을 획득하고 별도 index에서 계획한 파일만 준비한다. Git clean 필터가 기록 JSON의 의미를 바꾸면 중단한다. 원래 index를 보존한 채 기존 Git 훅과 서명 설정으로 커밋한 뒤 실제 커밋 tree·부모·트레일러를 검증하고 index를 게시한다. 자동 푸시는 하지 않는다. 훅이 계획 내용을 바꾸거나 동시 작업이 감지되면 성공으로 보고하지 않으며, 이미 생성된 커밋은 되돌리지 않는다.

Git 실행 전 실패는 자신이 만든 임시 index와 잠금을 정리한다. Git 실행 이후 실패는 커밋 여부가 불확실할 수 있어 복구 자료를 보존한다. 이때 `.git`의 실제 index 위치 옆 `index.lock`과 `tryce-index-*`, HEAD, 원래 index, 작업 파일을 확인한다. 다른 Git 작업 종료와 HEAD 이동 여부를 확인하기 전에 잠금을 지우지 않는다. linked worktree에서는 해당 worktree의 index 경로를 사용한다. 강제 잠금 해제·reset·훅 우회·자동 재시도는 제공하지 않는다.

이는 협조적인 Git 잠금과 조회 시점 재확인에 기반한다. 외부 프로세스의 지속적인 경로 교체나 임의의 Git 내부 파일 수정을 완전히 막지 않는다. 직접 Git 명령으로 만든 모든 커밋을 통제하는 훅·전체 이력 검사와 요구사항 GUI는 후속 범위다.
