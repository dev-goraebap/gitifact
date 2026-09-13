# 저장소 상태 조회

첫 조회 기능은 현재 checkout의 Git 상태를 읽는 `tryce status`다. 저장소 식별, HEAD, index와 작업 폴더의 변경을 공통 모델로 전달해 이후 brief와 브라우저 조회의 기반을 만든다.

상태: 개발용 구현 완료. 2026-09-13 작성·검증. 현재 빌드는 `repository-status` 출력 버전 1을 지원하며 공개 배포판은 아직 없다. 제품의 영속 형식, 도입 기준선, 요구사항 상태 전이와 보류 사항은 [제품 기준](../bref.md)을 그대로 따른다. 실행 방법과 검증 환경은 [개발 환경](../development.md)에 기록한다.

## 범위

현재 실행 위치가 속한 저장소와 worktree를 찾고 브랜치, HEAD 커밋, 변경 경로를 읽는다. `.tryce`가 없는 저장소에서도 사용할 수 있다. 초기화 여부나 지원 형식 여부를 추측하지 않는다.

이 기능은 Git 변경 상태 조회다. 요구사항·트레일러·승인·추적 누락을 검사하지 않으며 `clean`, 검사 통과, 구현 완료 같은 제품 판정을 만들지 않는다. 변경이 없으면 “Git 변경 경로 0개, tryce 검사 미실행”으로 표시한다.

파일 본문, diff, 이력 탐색, 원격 최신 상태, 스킬 탐색, 재검사 API는 후속 범위다. `.tryce`, Git 객체, index, 설정, 훅, 에이전트 파일을 생성·갱신하지 않는다.

## 명령

```sh
tryce status
tryce status --format json
tryce status --format text
```

기본 출력은 JSON이다. `--format`은 `json`, `text`만 받으며 위치 인자를 받지 않는다. 현재 작업 디렉터리를 입력으로 사용한다. 임의 경로, 과거 ref, `--staged` 선택은 아직 제공하지 않는다.

루트와 하위 폴더에서 실행한 결과는 같은 worktree를 가리킨다. linked worktree에서 실행하면 그 checkout만 읽고, submodule 내부에서 실행하면 해당 submodule 저장소를 읽는다. bare 저장소와 Git 내부 관리 디렉터리에서의 실행은 지원 범위 밖으로 거부한다.

저장소 선택을 바꾸는 `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR`, `GIT_INDEX_FILE`이 설정돼 있으면 `GIT_CONTEXT_OVERRIDE`로 거부한다. 값을 조용히 무시하거나 다른 checkout을 읽지 않는다. 별도 index를 쓰는 미래 훅 검사는 명시적 입력을 받는 별도 계약으로 연결한다.

## 관측과 스냅샷

HEAD 커밋은 전체 object ID로 고정할 수 있지만 작업 폴더는 조회 중에도 바뀔 수 있다. 이번 결과는 **관측 구간의 Git 상태**이며, 파일 내용을 보관한 재현 가능한 스냅샷이 아니다.

| 출처 | 이번에 읽는 사실 | 이후 본문 조회의 기준 |
| :--- | :--- | :--- |
| HEAD | 브랜치 상태와 전체 커밋 ID | 같은 커밋의 tree/blob |
| index | HEAD와 다른 staged 경로·상태 | 별도로 확보한 index의 stage·mode·object ID |
| 작업 폴더 | index와 다른 경로·상태, untracked 경로 | 읽은 바이트와 읽기 중 변경 여부를 별도 확인 |

부분 staging은 두 상태를 보존한다. HEAD의 A를 B로 수정해 stage한 뒤 C로 다시 수정했다면 같은 경로가 staged와 unstaged에 모두 포함된다. 나중에 index 본문을 요청했을 때 작업 폴더의 C를 대신 반환해서는 안 된다.

수집은 다음 순서로 진행한다.

1. 저장소·worktree 위치와 관측 시작 시각을 확보한다.
2. porcelain 상태를 읽고 HEAD·브랜치·변경 레코드를 파싱한다.
3. 동일한 상태 조회와 저장소 위치 확인을 반복한다.
4. 경로 순서를 정규화한 두 결과와 저장소 위치가 같으면 반환한다. 다르면 전체 수집을 한 번 재시도하고, 다시 다르면 `REPOSITORY_CHANGED`로 종료한다.

비교 대상은 HEAD·브랜치와 지원하는 변경 레코드의 전체 필드다. 파일 수만 비교하지 않는다. 이 절차도 원자적 잠금은 아니다. 같은 상태 코드로 유지되는 본문 변경이나 중간 변경 후 복귀를 모두 감지하지 못하므로 성공 응답에도 `consistency: "best-effort"`를 표시한다. 이 결과를 커밋 승인이나 쓰기의 검증 토큰으로 사용하지 않는다.

`observation.id`는 성공한 조회마다 발급하는 UUID다. 내용 해시나 Git snapshot ID가 아니다. 브라우저는 같은 조회의 화면을 연결하는 데 사용할 수 있지만, 이것만으로 별도 응답들의 파일 내용이 같다고 판단하지 않는다.

## 성공 출력 계약

계약 이름은 `repository-status`, 지원 버전은 `1`이다. CLI 배포 버전과 `Tryce-Format` 영속 형식 버전과는 별개다. 필드는 생략 대신 아래의 명시적인 null·배열·상태를 사용한다.

| 필드 | 형식과 의미 |
| :--- | :--- |
| `contract`, `version`, `ok` | `"repository-status"`, `1`, `true` |
| `observation.id` | 조회별 UUID |
| `observation.startedAt`, `completedAt` | UTC ISO 8601 시각. 주입된 시계로 시험 |
| `observation.consistency` | `"best-effort"` |
| `repository.key` | 로컬 저장소 식별용 불투명 문자열 |
| `repository.rootPath` | 현재 checkout 루트의 절대 경로 |
| `repository.worktreeKey` | 로컬 worktree 식별용 불투명 문자열 |
| `repository.objectFormat` | `"sha1"` 또는 `"sha256"` |
| `head.state` | `"branch"`, `"detached"`, `"unborn"` |
| `head.branch` | branch·unborn은 브랜치 이름, detached는 null |
| `head.commit` | branch·detached는 전체 object ID, unborn은 null |
| `changes` | 아래 변경 레코드 배열 |
| `summary` | `staged`, `unstaged`, `untracked`, `conflicted`의 0 이상 정수 |
| `checks` | `{ "state": "not-run", "reason": "git-status-only" }` |

저장소 key는 Git이 반환한 canonical common Git 디렉터리 경로를, worktree key는 canonical 개별 Git 디렉터리 경로를 각각 접두어와 함께 SHA-256으로 해시한다. 브랜치 이름을 식별자로 사용하지 않는다. 경로 이동·새 clone 뒤에도 유지되는 영속 프로젝트 ID라는 약속은 하지 않는다. 같은 common 디렉터리를 가진 linked worktree는 저장소 key가 같고 worktree key는 다르다. 경로 발견은 [git-rev-parse](https://git-scm.com/docs/git-rev-parse)를 따른다.

변경 레코드는 `{ kind, path, xy, submodule }`다.

- `kind`: `tracked`, `unmerged`, `untracked` 중 하나다.
- `path`: 저장소 루트 상대 경로다. Git의 `/` 구분자를 유지하며 공백·탭·줄바꿈을 trim하거나 바꾸지 않는다.
- `xy`: tracked·unmerged는 Git의 두 자리 상태 코드, untracked는 null이다. tracked에서 `.`은 해당 비교의 변경이 없다는 뜻이다.
- `submodule`: tracked·unmerged는 `{ commitChanged, trackedChanges, untrackedChanges }` 또는 일반 파일이면 null이다. untracked는 null이다. 내부 경로 목록을 재귀 확장하지 않는다.

Git이 별도 내부 저장소를 untracked 디렉터리 하나로 보고하면 `nested/`처럼 마지막 `/`도 보존한다. `--untracked-files=all`을 사용해도 내부 저장소 전체가 개별 파일로 확장된다는 뜻은 아니다.

변경 레코드는 path의 UTF-8 바이트 순서로 정렬한다. tracked에서 X가 `.`이 아니면 staged, Y가 `.`이 아니면 unstaged에 집계한다. unmerged는 conflicted에만, untracked는 untracked에만 집계한다. 부분 staging은 staged·unstaged 양쪽에 들어가므로 네 개 숫자의 합이 고유 경로 수와 같을 필요는 없다. submodule 플래그도 보존하고 일반 파일의 본문 변경으로 단정하지 않는다.

rename 추론은 끈다. 이동은 삭제와 추가로 표현하며 rename/copy 유사도나 원본 연결을 추측하지 않는다. ignored 파일과 변경 없는 tracked 파일은 목록에 포함하지 않는다. sparse checkout, assume-unchanged 등 Git의 가시성 제한을 넘어 전체 디스크가 검사됐다고 표시하지 않는다.

예를 들어 `tracked.txt`의 부분 staging과 `new.txt`의 새 파일이 있으면 다음 부분 결과를 갖는다.

```json
{
  "changes": [
    { "kind": "untracked", "path": "new.txt", "xy": null, "submodule": null },
    { "kind": "tracked", "path": "tracked.txt", "xy": "MM", "submodule": null }
  ],
  "summary": { "staged": 1, "unstaged": 1, "untracked": 1, "conflicted": 0 },
  "checks": { "state": "not-run", "reason": "git-status-only" }
}
```

이는 응답 일부의 예시다. 실제 성공 응답에는 위 표의 필드를 모두 포함한다. 충돌이 있어도 관측 자체가 성공했다면 `ok: true`다. `ok`는 저장소나 제품의 정상 판정이 아니다.

## 실패와 출력 규칙

성공은 stdout에 선택한 형식의 결과 하나와 마지막 줄바꿈을 쓰고 종료 코드 0을 반환한다. 실패는 stdout을 비우고 stderr에 오류를 쓰며 종료 코드 1을 반환한다. 부분 성공 결과를 먼저 내보내지 않는다.

JSON 모드의 수집 실패는 아래 모양의 객체 하나다. text 모드는 코드와 설명을 한 번 출력한다. JSON의 `error.message`는 사람이 읽는 설명이며 기계 분기는 `error.code`로 한다.

```json
{
  "contract": "repository-status",
  "version": 1,
  "ok": false,
  "error": { "code": "NOT_A_REPOSITORY", "message": "현재 위치가 Git 작업 폴더에 속하지 않습니다." }
}
```

`--help`와 명령 파서의 사용법 오류는 기존 CLI의 텍스트 출력 규칙을 따른다. 지원하지 않는 format·옵션·위치 인자는 Git을 실행하기 전에 거부한다.

| 오류 코드 | 의미 |
| :--- | :--- |
| `GIT_NOT_FOUND` | Git 실행 파일을 찾지 못함 |
| `GIT_CONTEXT_OVERRIDE` | 현재 checkout과 다른 Git 컨텍스트를 지정하는 환경변수가 있음 |
| `NOT_A_REPOSITORY` | Git 저장소 발견 실패 중 저장소가 아닌 것으로 확인됨 |
| `UNSUPPORTED_REPOSITORY` | bare·Git 관리 디렉터리 등 이번 범위 밖의 실행 위치 |
| `GIT_UNSUPPORTED` | 필요한 옵션 또는 object format을 지원하지 않음 |
| `GIT_FAILED` | 권한, dubious ownership, 손상 등 나머지 Git 실행 실패 |
| `INVALID_GIT_OUTPUT` | 필수 헤더·레코드가 잘못됐거나 모순됨 |
| `UNSUPPORTED_PATH_ENCODING` | 경로를 유효한 UTF-8로 손실 없이 표현할 수 없음 |
| `REPOSITORY_CHANGED` | 재시도 후에도 수집 전후의 관측이 일치하지 않음 |
| `READ_LIMIT_EXCEEDED` | Git 출력 또는 조회 시간 제한 초과 |

Git 비정상 종료를 모두 “저장소 없음”으로 바꾸지 않는다. 자동으로 safe.directory를 추가하거나 설정을 복구하지 않는다. 오류 메시지에 전체 환경변수나 Git 원본 출력을 그대로 포함하지 않는다. text 출력의 경로·브랜치에는 제어 문자를 escape하여 터미널 제어 시퀀스로 실행되지 않게 한다.

## Git 어댑터와 제한

Git은 shell 문자열 대신 인자 배열로 호출한다. porcelain v2의 NUL 구분 레코드를 Buffer로 파싱하며, 행 단위 split이나 전체 레코드의 공백 split으로 경로를 손상시키지 않는다. 알려지지 않은 선택적 헤더는 무시하고, 지원하지 않는 변경 레코드나 상태 값은 실패로 처리한다. UTF-8 디코딩은 손실을 허용하지 않는다. [porcelain 형식](https://git-scm.com/docs/git-status#_porcelain_format_version_2).

상태 조회의 옵션은 다음을 기준으로 한다.

```sh
git --no-optional-locks -c core.fsmonitor=false status --porcelain=v2 --branch --untracked-files=all --ignore-submodules=none --no-renames -z
```

index의 stat 캐시 갱신 쓰기를 막기 위해 모든 자식 Git 프로세스에 `GIT_OPTIONAL_LOCKS=0`을 설정한다. fsmonitor 실행은 이번 조회에서 끄며 저장소 설정 자체는 수정하지 않는다. fetch·submodule update를 호출하지 않고, upstream 헤더가 있어도 원격과의 동기화 여부는 출력하지 않는다. [Git 상태 조회의 index 갱신](https://git-scm.com/docs/git-status#_background_refresh), [Git 실행 옵션](https://git-scm.com/docs/git).

초기 구현은 시도당 15초, 단일 Git 프로세스의 stdout·stderr 합계 16 MiB를 상한으로 둔다. 경합 때문에 재시도하면 최대 두 시도다. 상한 초과 시 중단하고 결과를 생략한 정상 응답을 만들지 않는다. 이 값은 자원 사용을 제한하는 구현 기본값이며 brief의 보류 중인 출력 분량 정책과 관계없다. 변경 시 관련 테스트와 문서를 함께 수정한다.

## 코드 배치

- `apps/cli/commands`: status 인자 처리와 출력 형식 선택
- `apps/cli/adapters/git`: Git 발견·실행·porcelain 파싱·관측 전후 비교
- `packages/core`: Git 실행과 무관한 관측 모델, 집계, 조회 유스케이스와 port
- `packages/contracts`: 성공·실패 DTO와 런타임 검증. Node 전용 import 금지
- `apps/cli/output`: core 결과를 계약으로 변환하고 JSON·text로 표시

Git 원문·mode·blob ID 등 비교에 필요한 내부 정보는 어댑터가 보존하되 모두 외부 DTO로 내보내지는 않는다. core와 출력 계약을 같은 타입으로 묶지 않는다. 시계·ID 생성기는 주입해 테스트에서 고정한다. HTTP endpoint와 브라우저 Query key는 이 계약의 구현 검증 후 연결한다.

저장소 경로는 rev-parse의 옵션별로 따로 읽고 마지막 출력 구분자만 제거한다. 전체 문자열 trim이나 여러 경로를 줄바꿈으로 합쳐 파싱하지 않는다. 경로의 공백·줄바꿈도 실제 이름의 일부일 수 있다.

## 구현 완료 조건

| 사례 | 기대 결과 |
| :--- | :--- |
| 커밋 없는 저장소 | unborn, commit null. 초기화 오류로 처리하지 않음 |
| 변경 없는 저장소 | 빈 changes, 네 집계 0, checks는 not-run |
| 일반 branch·detached HEAD | 전체 commit ID, 올바른 branch/null |
| 하위 폴더 실행 | 루트 실행과 같은 저장소·worktree key와 상대 경로 |
| 부분 staging | `MM` 경로 하나, staged·unstaged에 각각 1 |
| 삭제·타입 변경·intent-to-add | Git 관측 코드 보존. 임의로 완료나 stage된 내용으로 바꾸지 않음 |
| rename 설정 켜진 저장소 | 이번 명령에서는 삭제·추가로 일관되게 표현 |
| merge 충돌 | unmerged와 conflicted 집계, 관측은 성공 |
| 공백·한글·탭·줄바꿈 경로 | 지원 OS에서 원문 유지, text에서 제어 문자 escape |
| 잘못된 UTF-8·깨진 NUL 레코드 | 계약 손실 없이 명시적 실패 |
| submodule 변경 | Gitlink·내부 변경 플래그 보존, 내부 파일 목록으로 확장하지 않음 |
| linked worktree 두 개 | 저장소 key 공유, worktree key와 변경 목록 분리 |
| SHA-1·SHA-256 저장소 | object format과 전체 ID 길이 일치 |
| 조회 중 checkout·staging 변경 | 전체 재시도, 반복 경합은 실패 |
| Git 부재·권한 실패·시간/출력 초과 | 코드로 구분, stdout에 성공 결과 없음 |
| JSON 성공·실패와 text | 계약 검증, 스트림·종료 코드·정렬 규칙 일치 |
| 조회 전후 파일 상태 | index·HEAD·refs·설정·작업 파일 불변, `.tryce`와 잠금 파일 신규 생성 없음 |
| 패키징한 CLI | workspace 밖의 임시 Git 저장소에서 status 실행 |

파서·집계는 고정 입력으로, Git 경계는 임시 저장소로 시험한다. 경합·timeout은 어댑터의 제어 가능한 입력으로 재현하고 우연한 타이밍에 의존하지 않는다. OS별로 생성할 수 없는 파일명은 파서 fixture로도 검증하고 실제 OS 시험과 구분한다.

## 이번 명세에서 확인한 근거

Git 2.53.0.windows.1의 임시 저장소에서 unborn 헤더, 부분 staging의 `MM`, 공백·한글 untracked 경로, optional locks를 끈 조회의 index 바이트 보존을 확인했다. linked worktree의 common 디렉터리 공유·개별 Git 디렉터리 분리, 변경 목록 분리, detached 헤더도 확인했다.

위 내용은 명세 작성 당시의 Git 동작 조사다. 이후 DTO·파서·집계와 CLI 연결을 구현하고 core·contracts의 고정 입력, 임시 Git 저장소, 패키징한 CLI로 검증했다. 실제 OS 시험과 제어한 입력의 구분은 [검증 기록](../development.md#검증-기록과-다음-작업)에 남긴다. DEV-01·02는 요구사항 기록·검사 기능이 아직 없으므로 유지한다. 다음 작업은 같은 조회 계약을 HTTP 서버와 브라우저에 연결하는 것이다.
