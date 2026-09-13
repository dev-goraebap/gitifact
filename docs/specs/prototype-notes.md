# 프로토타입 기록

`tryce note`는 개발 중 발견한 동작, 유지할 제약, 제외한 접근과 이유를 기록한다. 기록을 파일로 추가하고 Git으로 보관하며, 다음 `brief`와 향후 `promote`가 원래 판단을 참조할 기반을 만든다.

상태: 첫 개발용 구현 명세. 2026-09-13 사용자가 형식·구현·프로젝트 적용을 함께 진행하도록 요청했다. [제품 기준](../bref.md)의 discovery·constraint·rejected 구분과 원문 보존 원칙을 따른다. 요구사항 ID, 승인, 구현 완료, 검사 통과를 자동으로 만들지 않는다.

## 사용 흐름

```sh
tryce note enable --dry-run
tryce note enable
tryce note add --type discovery --message "확인한 동작과 근거" --author Codex
tryce note add --type constraint --file ./constraint.txt
tryce note list --format text
tryce note show N-<UUID> --format text
```

`--message`와 `--file` 중 하나로 본문을 전달한다. 본문 파일은 읽기만 하고 이동·수정하지 않는다. 첫 쓰기는 prototype 모드에서 지원하며 명령이 모드를 바꾸지는 않는다. 조회는 지원하는 프로젝트 형식에서 현재 작업 폴더의 기록을 읽는다.

`--author`는 선택한 표시 이름이며 인증·승인자가 아니다. 생략하면 null이고 Git 사용자 이름이나 현재 에이전트를 추측하지 않는다. `recordedAt`은 CLI가 실제 저장 시각으로 만든 UTC 값이다. 과거 사건을 나중에 적어도 기록 시각을 소급하지 않고 사건 시점과 근거는 본문에 적는다.

## 형식 도입

`init-1` 설정은 설정과 기준선만 지원하므로 note add가 몰래 형식을 확장하지 않는다. `note enable`이 명시적 도입 명령이며 설정의 `format`만 `prototype-1`로 바꾼다. 모드·기준선은 보존한다. 새 init의 기본 형식도 init-1로 유지한다.

전환 전에 기존 설정의 정확한 UTF-8 바이트를 `.tryce/config.init-1.<SHA-256>.json`에 보존한다. 해시는 원본 바이트에서 계산한다. 이 파일은 전환 원본이며 Git 추적 대상이다. 같은 경로에 다른 내용이나 링크가 있으면 거부한다. 전환 파일과 원본이 ignore되면 사용자 규칙을 바꾸지 않고 중단한다.

계획 → 원본 보존 → 입력 재확인 → 완성된 설정의 교체 → 결과 확인 순서로 진행한다. 기존 prototype-1에는 `already-enabled`를 반환하고 바이트를 바꾸지 않는다. 원본만 보존된 채 중단됐다면 재실행이 같은 원본을 검증하고 전환을 마친다. 설정까지 확정된 뒤 중단됐다면 이미 활성화된 상태로 확인할 수 있다.

자동 rollback으로 사용자 파일을 덮어쓰지 않는다. 수동 복구가 필요하면 Git 상태·현재 설정·보존 원본을 함께 검토한다. 기록이 생긴 뒤 init-1로 되돌리면 이 CLI도 note 작업을 거부하므로, 설정만 되돌리는 것을 기록 형식 역변환으로 취급하지 않는다. 전환·복구는 호출된 checkout에 한정한다.

## 저장 배치와 버전

```text
.tryce/
  config.json                         format: prototype-1
  config.init-1.<sha256>.json           전환 전 원본
  notes/
    N-<UUID>.json                      기록 하나
```

설정 구조는 [init-1](project-format.md)과 같고 format만 prototype-1이다. prototype-1은 설정과 note-1 기록의 호환 조합이다. 요구사항 문서·메타·승인·트레일러·스킬 생성 규약은 여전히 미지원이다. 이 식별자를 `Tryce-Format`에 넣는 커밋 기능도 구현하지 않는다.

구형 init 전용 CLI는 prototype-1 설정을 미지원 형식으로 거부한다. 새 CLI는 init-1의 생성·조회와 prototype-1의 재실행을 지원한다. CLI 업데이트만으로 전환하지 않으며 향후 공개 형식으로의 전환도 별도로 제공한다. note-1의 의미와 읽기는 후속 형식이 생겨도 보존한다.

기록은 UTF-8 JSON, 들여쓰기 2칸, 마지막 LF로 생성한다. 캐시가 아니며 config·전환 원본·기록 파일을 함께 Git으로 보관한다. 명령은 stage·commit을 수행하지 않는다. 아직 미커밋인 기록도 list에 나오므로 Git에 보존됐다고 표시하지 않는다.

| 필드 | 값과 의미 |
| :--- | :--- |
| `kind`, `format` | `tryce-note`, `note-1` |
| `id` | `N-`과 소문자 UUID v4. 요구사항의 R- ID와 구분 |
| `type` | `discovery`, `constraint`, `rejected` |
| `recordedAt` | UTC ISO 시각, 밀리초 포함 |
| `text` | 비어 있지 않은 본문. 최대 16,000 UTF-16 코드 단위 |
| `author` | 명시한 표시 이름, 최대 120 코드 단위. 생략 시 null |
| `references` | 기존 기록 ID 배열. 최대 32개, 중복·자기 참조 금지 |
| `supersedes` | 정정할 기존 기록 ID 하나 또는 null |

모든 필드는 필수이며 추가 필드·잘못된 Unicode·BOM·지원하지 않는 버전·맞지 않는 파일명과 ID는 거부한다. 본문에는 탭·줄바꿈을 허용하고 기타 ASCII 제어 문자는 받지 않는다. ID는 CLI가 발급하고 사용자 지정은 지원하지 않는다. 현재 기록에서 ID 충돌을 발견하면 재사용·덮어쓰기하지 않고 실패한다. 전체 Git 이력의 독립 발급 충돌 판정은 아직 지원하지 않는다.

## 수정과 참조

원문을 수정·삭제하는 명령은 제공하지 않는다. 근거를 보완하거나 판단을 바꾸려면 새 기록을 추가한다.

```sh
tryce note add --type discovery --message "추가 확인 내용" --ref N-<기존 UUID>
tryce note add --type constraint --message "바뀐 판단과 이유" --supersedes N-<기존 UUID>
```

`--ref`는 반복할 수 있다. 참조와 정정 대상은 현재 checkout에서 읽을 수 있어야 한다. 정정 대상도 목록에서 숨기지 않는다. 여러 브랜치에서 같은 기록을 정정한 경우 둘 다 보존하고 시간 순서로 하나를 진실로 선택하지 않는다. 정정 참조의 순환과 없는 대상은 오류로 보고한다.

note의 supersedes는 기록 정정 관계다. 요구사항의 superseded 상태 전이·새 R- ID 발급과 동일시하지 않는다. rejected 기록도 scope-cut 선언이 아니다. 향후 promote는 기록 ID와 실제 Git 시점을 함께 참조하고 원본을 보존해야 한다.

## 조회·실패·동시 실행

list와 show는 `source: working-tree`를 표시한다. 조회는 시각·ID 순으로 모든 기록을 반환하며 정정 전 원문도 포함한다. 과거 커밋·index 조회, 검색·페이지 분할은 후속 범위다. 첫 구현의 상한은 파일당 64 KiB, 총 16 MiB, 최대 1,000개다. 초과 시 일부만 정상 결과로 반환하지 않는다. 이 한도는 brief의 분량 정책을 확정한 것이 아니다.

손상·지원하지 않는 형식·알 수 없는 파일·깨진 참조가 있으면 빈 목록으로 대체하지 않는다. HEAD나 index에 있는 기록이 작업 폴더에서 사라지면 삭제 상태로 보고 추가 쓰기도 거부한다. 현재 기록을 Git 이력의 원문과 대조하는 전체 불변성 검사는 아직 없다. 기록 파일을 수동 편집했다는 사실을 스키마 검증만으로 모두 검출할 수는 없다.

쓰기에는 checkout의 `.tryce/.notes.lock`을 배타적으로 생성한다. 경쟁 실행은 `PROJECT_BUSY`로 실패하며 기존 작업이 끝난 뒤 재실행한다. 강제 종료 후 잠금이 남으면 경로와 수동 정리 안내를 출력한다. PID나 파일 나이만으로 자동 삭제하지 않는다. 본문 출력에 실패해 성공 여부를 모르면 list로 생성 여부를 확인하고 재시도한다. add는 같은 본문을 자동 중복 제거하지 않는다.

완성된 임시 파일을 hard link로 새 기록 경로에 확정하고 기존 파일은 덮어쓰지 않는다. 형식 전환은 원본을 보존한 뒤 rename으로 설정을 교체한다. 모든 쓰기 직전에 Git HEAD·index·프로젝트 설정·기록과 ignore 규칙을 재확인한다. 설정·기록 디렉터리와 관리 파일의 symlink·junction을 거부한다. 다른 에이전트의 지침이나 스킬을 변경하지 않는다.

Git과 여러 파일을 한 트랜잭션으로 잠그지는 않는다. 외부 편집기의 지속적인 경로 교체·전원 손실 내구성 한계는 init과 같다. 실패 후 생성된 원본·기록은 보존하며, 이번 실행이 소유한 잠금과 임시 파일만 정리한다. 다른 실행의 임시 파일은 이름만 보고 제거하지 않는다.

## 출력과 검증

`notes` 출력 버전 1은 성공 시 stdout·종료 코드 0, 실패 시 stderr·종료 코드 1이다. 옵션 오류는 Commander의 text 진단이다. 정상 DTO는 contract·version·ok, outcome, source, rootPath, notes, backupPath를 포함한다. outcome은 planned·enabled·already-enabled·added·listed·shown이다. 오류는 code·message를 제공한다. `--format text`는 사람이 읽을 표현이고 JSON이 기계 계약이다.

검증은 임시 저장소에서 형식·참조·원문 보존·전환 실패와 재개·동시 실행·경로 차단·부분 staging·worktree·pack한 CLI를 확인한다. 실제 적용 전에 실행한 범위와 미검증 한계를 [개발 환경](../development.md)에 남기고 빌드를 지정한다. 검증 후 이 프로젝트에 실제 발견·제약·기각 이유를 기록하며, 과거 승인을 새 승인 이력으로 꾸미지 않는다.
