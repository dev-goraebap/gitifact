# 프로젝트 스킬 배포

CLI에 포함한 `tryce-workflow` 원본을 프로젝트에 설치하고 선택한 에이전트의 로컬 복사본을 관리한다. 첫 범위는 스킬 하나와 Codex·Claude Code다. 프로젝트 설정·note 형식은 바꾸지 않는다.

## 명령

```sh
tryce skills install --agent codex
tryce skills install --agent claude --dry-run
tryce skills install --agent claude
tryce skills sync
tryce skills sync --agent claude
tryce skills remove --dry-run
tryce skills remove
```

실행 위치의 Git checkout에서 지원하는 설정(init-1·prototype-1·workflow-1)과 기준선을 확인한다. 초기화 전 상태, Git 작업·충돌·컨텍스트 덮어쓰기 환경변수는 거부한다. 자동 init·note enable, 전역 설치, AGENTS.md·CLAUDE.md·훅 변경, stage·commit은 수행하지 않는다.

공용 스킬은 기존 AGENTS.md·CLAUDE.md의 적용 가능한 지침을 읽고 따른다. 설치 명령은 이 파일들을 생성하거나 스킬 연결 문구를 삽입하지 않는다. 현재 세션은 설치한 스킬을 직접 읽고, 이후 세션은 에이전트의 스킬 인식에 의존한다. 기존 지침을 보존하는 연결 안내의 설치·갱신·제거는 후속 범위다. 이 저장소의 개발 예외는 AGENTS.md에 두며 공용 스킬에 배포하지 않는다.

install은 원본이 없으면 CLI 템플릿을 복사하고 기존 원본은 보존한다. sync는 원본이 있어야 하며 그 내용으로 로컬 복사본만 맞춘다. 새 clone에서도 `sync --agent claude`로 복사본을 만들 수 있다. 옵션이 없으면 저장한 로컬 에이전트 선택을 사용하고, 선택도 없으면 오류다.

remove는 관리 중이고 수정되지 않은 Claude 복사본만 제거한다. **원본은 남으므로 Codex의 원본 탐색까지 비활성화하는 명령이 아니다.** 원본 삭제는 사용자가 별도로 결정한다. 빈 디렉터리·ignore 규칙·로컬 관리 영수증도 남는다. 다음 install이나 명시적인 sync로 재연결할 수 있다.

CLI 업데이트로 맞춤 원본을 교체하지 않는다. 원본 템플릿 upgrade, 여러 스킬 관리, 전체 eject, 개발 스크립트의 매니페스트 전환은 지원 범위 밖이다. 현재 원본 편집 후 sync하는 갱신을 지원한다.

## 파일과 소유권

| 파일 | 책임 |
| :--- | :--- |
| `.agents/skills/tryce-workflow/SKILL.md` | 커밋할 편집 원본 |
| `.claude/skills/tryce-workflow/SKILL.md` | Claude용 로컬 복사본 |
| `.agents/tryce-skills.local.json` | 경로·선택 에이전트·복사본 지문과 복구 상태 |
| `.agents/tryce-skills.local.lock` | 동시 쓰기 방지 |

로컬 매니페스트 버전 1의 source·target은 고정 경로다. 매니페스트 없는 복사본은 내용이 같아도 소유 파일로 채택하지 않는다. 이전 지문과 다른 수정본·삭제된 복사본도 거부하며 원본과 비교해 보존하도록 안내한다.

로컬 파일이 HEAD·index에서 추적 중이면 거부한다. 추적 중인 원본이 작업 폴더에서 삭제됐다면 템플릿으로 복구하지 않는다. 다른 스킬은 변경하지 않는다. 원본·복사본·매니페스트는 64 KiB 이하 UTF-8 일반 파일만 받으며 경로의 symlink·junction은 거부한다.

루트 `.gitignore`의 기존 내용에 관리 대상 로컬 파일·임시 파일의 정확한 규칙을 덧붙인다. 동일한 줄은 중복하지 않는다. 하위 규칙 때문에 실제 제외되지 않으면 오류다. 이미 추가한 ignore 규칙은 남을 수 있다. 원본이 ignore돼 있으면 설치·동기화를 진행하지 않는다.

## 실패와 재실행

dry-run은 잠금·디렉터리·파일을 만들지 않고 현재 조건을 검증한다. 실제 실행은 잠금을 얻고 완성된 임시 파일을 게시한다. 새 파일은 기존 대상을 덮어쓰지 않는 hard link로 게시한다. 교체·제거 직전에는 내용·경로·Git index·HEAD·프로젝트 설정을 재확인한다.

복사 전 accepted에 이전·예정 복사본 SHA-256을 기록한다. 둘 중 하나인 상태만 중단된 쓰기의 재실행 대상으로 인정한다. null은 파일 없음이다. 완료 후에는 현재 지문 하나만 남긴다. 여러 파일 전체를 원자적으로 바꾸는 거래는 아니다. 오류 후 원본·복사본·매니페스트를 확인하고 같은 명령을 재실행한다. 임의 지문을 써서 충돌을 우회하지 않는다.

남은 잠금은 실행 중인 프로세스가 없는지 확인하고 중단된 작업의 잠금임을 확인한 뒤 해당 파일만 정리한다. `.tryce-skill-*.tmp`가 남으면 내용을 확인하고 보존할 자료를 구분한다. CLI는 잠금의 오래된 시각만으로 자동 삭제하지 않는다.

## 출력과 검증 경계

기본 JSON은 `contract: skills`, `version: 1`이다. 성공은 stdout·종료 코드 0, 실패는 stderr·종료 코드 1이다. `--format text`도 지원한다. 성공에는 outcome, rootPath, agent, source, target, sourcePreserved와 `sessionState: not-observed`를 담는다. planned는 실행 예정이며 설치 완료가 아니다. 실패는 code·message를 담고 이미 게시된 파일이 모두 되돌려졌다고 보장하지 않는다.

파일 검증과 에이전트의 실제 선택·실행은 구분한다. 공식 탐색 근거는 [에이전트 스킬 연결](agent-skills.md)을 참고한다. Windows의 임시 Git 저장소와 workspace 밖 설치물로 검증한다. 지속적인 외부 경로 교체·전원 손실·디스크 부족·실제 ACL 오류와 macOS·Linux 실행은 별도 검증이 필요하다.
