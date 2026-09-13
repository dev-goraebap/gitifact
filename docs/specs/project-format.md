# 프로젝트 형식 init-1

이 문서는 기존 형식을 설명한다. auto/approval 신규 도입과 명시적 전환은 [workflow-1](workflow-format.md)을 따른다.

`init-1`은 설정·초기 모드·도입 기준선만 지원하는 첫 개발용 영속 형식이다. CLI 배포 버전 `0.0.0`, 출력 계약 `project-init` 버전 1과 구분한다. 공개된 전체 요구사항 기록 형식은 아직 없다.

2026-09-13 사용자 승인으로 [초기화 명세](project-init.md)의 설정 위치, 기준선, 명시적 모드, 설정만 생성하는 범위를 채택했다. 이 문서는 그 범위의 정확한 저장 형식이다. Tryce 개발 프로젝트의 초기 모드는 사용자 지정 `prototype`이다.

## 설정 파일

경로는 checkout 루트의 `.tryce/config.json`이다. UTF-8 JSON으로 저장하고 Git 추적 대상으로 둔다. 신규 생성은 들여쓰기 2칸과 마지막 LF를 사용한다. 읽을 때는 JSON 공백·필드 순서에 의존하지 않으며 재실행은 기존 바이트를 바꾸지 않는다. BOM·잘못된 UTF-8·64 KiB 초과 파일·알 수 없는 필드와 값은 거부한다.

첫 커밋이 없는 저장소의 설정은 다음과 같다.

```json
{
  "kind": "tryce-project",
  "format": "init-1",
  "mode": "prototype",
  "baseline": {
    "kind": "empty"
  }
}
```

커밋이 있으면 `baseline`만 아래 구조를 사용한다. `commit`은 실제 HEAD의 전체 object ID다. 아래 문구는 구조 설명이며 저장할 해시가 아니다.

```text
baseline: {
  kind: "commit",
  objectFormat: "sha1" | "sha256",
  commit: <실제 커밋의 전체 소문자 16진수 object ID>
}
```

| 필드 | 허용 값과 의미 |
| :--- | :--- |
| `kind` | `tryce-project` |
| `format` | `init-1` |
| `mode` | `normal` 또는 `prototype` |
| `baseline.kind` | `empty` 또는 `commit` |
| `baseline.objectFormat` | commit 기준선에서만 `sha1` 또는 `sha256` |
| `baseline.commit` | commit 기준선에서만 SHA-1 40자 또는 SHA-256 64자. 전부 0인 값은 금지 |

모든 필드는 해당 변형에서 필수다. `empty`에는 commit이나 objectFormat을 넣지 않는다. `empty`는 초기화 전에 커밋이 없었다는 영속 사실이며, 첫 커밋이 생긴 뒤에도 유지한다. commit 기준선은 해당 커밋과 조상을 추적 누락 검사에서 제외하는 경계다. 스키마 검증과 별도로 실제 객체 종류·저장소 object format·현재 HEAD의 조상 관계를 확인한다.

모드는 앞으로 적용할 검사 정책을 지정한다. `prototype`으로 저장됐다는 사실만으로 현재 CLI가 모드별 검사를 실행했다고 표시하지 않는다. `status`·`browser`는 계속 Git 관측만 제공한다. 모드 변경과 과거 시점 해석은 후속 명령에서 구현한다.

## 지원 조합과 전환

| 구성 | init-1의 지원 |
| :--- | :--- |
| 프로젝트 설정 | 위 스키마 읽기, 최초 생성, 기존 바이트 보존 |
| 요구사항 문서·spec 메타 | 아직 정의·쓰기 지원하지 않음 |
| 승인·사건·커밋 트레일러 | 아직 쓰기·검사 지원하지 않음 |
| 스킬 생성 규약·훅 | 아직 설치·갱신 지원하지 않음 |
| 캐시 | 생성하지 않음 |

따라서 `init-1`을 `Tryce-Format` 트레일러에 넣거나 정식 요구사항 형식 1로 해석하지 않는다. 초기화는 자동 커밋을 만들지 않는다. 전체 기록 형식이 정해지면 별도의 형식 식별자를 부여하고 init-1에서 넘어가는 명시적 전환을 구현한다. CLI 업데이트나 단순 재실행으로 전환하지 않는다.

초기화만 제공하던 빌드는 init-1만 읽고 최초 생성한다. note를 추가한 현재 빌드는 [prototype-1](prototype-notes.md)도 읽으며 명시적 `note enable` 전환을 지원한다. init의 기본 생성 형식은 init-1을 유지한다. 다른 `format`은 `UNSUPPORTED_FORMAT`으로 거부하며 파일을 보존한다. 알려진 형식의 손상·누락·추가 필드는 `INVALID_CONFIG`다. 오류가 나도 기본값을 채우거나 정상 설정으로 다시 생성하지 않는다. 앞으로 init-1 읽기를 유지하고, 쓰기 지원을 축소할 때는 제품 기준의 예고·전환·마지막 호환 CLI 정책을 따른다.

## 출력 계약 project-init / 1

JSON은 정상 결과를 stdout, 오류를 stderr에 한 줄로 출력한다. 정상 종료는 0, 실패는 1이다. 인자 오류는 Commander의 text 오류로 처리하므로 버전 있는 결과 DTO와 구분한다.

정상 결과에는 `contract: "project-init"`, `version: 1`, `ok: true`와 다음 필드가 있다.

| 필드 | 의미 |
| :--- | :--- |
| `outcome` | `created`, `already-initialized`, `planned` |
| `rootPath`, `configPath` | 관측한 checkout 절대 경로와 `.tryce/config.json` |
| `projectFormat`, `mode`, `baseline` | 실제 설정 또는 dry-run 생성 계획의 값. 현재 projectFormat은 init-1 또는 prototype-1 |
| `hasUncommittedChanges` | 명령 시작 시 Git 관측에서 변경 경로가 있었는지 |
| `configChanged` | 새 설정 생성·계획이거나 기존 설정 경로가 Git 변경에 포함되는지 |
| `integrations.skills`, `integrations.hooks` | `not-installed-by-init`. 외부에 이미 있는 연동의 설치 상태를 판정한 값이 아님 |

오류는 같은 contract·version에 `ok: false`, `error: { code, message }`를 사용한다. `--format text`는 사람이 읽을 요약이며 기계 계약은 JSON이다. `--dry-run`에서 기존 설정을 발견하면 계획을 새로 만들지 않고 `already-initialized`를 반환한다.

초기화 오류 코드는 `MODE_REQUIRED`, `MODE_CONFLICT`, `INVALID_CONFIG`, `UNSUPPORTED_FORMAT`, `PATH_CONFLICT`, `CONFIG_IGNORED`, `CONFIG_DELETED`, `BASELINE_UNAVAILABLE`, `GIT_OPERATION_IN_PROGRESS`, `INPUT_CHANGED`, `INPUT_CHANGED_AFTER_WRITE`, `INIT_FAILED`다. Git 관측 오류는 기존 repository-status의 오류 코드를 사용한다. code는 앞으로 추가될 수 있으므로 소비자는 모르는 오류도 성공으로 해석하지 않는다. message 전체 문자열에는 의존하지 않는다.

`INPUT_CHANGED_AFTER_WRITE`는 설정 확정 이후 변경을 발견한 상태다. 생성된 파일을 삭제하거나 다시 덮어쓰지 않고 확인을 요청한다. 나머지 오류에서도 강제 종료·파일시스템 실패로 임시 파일이나 빈 `.tryce/`가 남을 수 있다. config 존재와 실제 내용을 확인한 뒤 재실행한다.

## 파일 확정과 검증 한계

새 설정은 `.tryce/.init-<무작위 UUID>.tmp`에 배타적으로 생성하고 파일 내용을 flush한 뒤 hard link로 config.json 경로에 확정한다. 기존 대상에는 덮어쓰지 않는다. 지원하지 않는 파일시스템에서는 안전성이 다른 덮어쓰기·복사 방식으로 우회하지 않고 실패한다. 기본 API 근거는 [Node.js fs](https://nodejs.org/api/fs.html), ignore 판정은 [Git check-ignore](https://git-scm.com/docs/git-check-ignore)다.

임시 파일과 디렉터리의 inode·device 및 디렉터리 실제 경로를 확인하고 자신이 만든 임시 파일만 삭제한다. 빈 디렉터리는 실패 후에도 남겨 둔다. 강제 종료로 남은 다른 임시 파일은 재실행이 삭제하지 않는다. 설정에는 원본 쓰기를 이어갈 열린 파일 핸들을 남기지 않는다.

Git 루트·HEAD·index 내용, 진행 중 작업, ignore 규칙을 확정 직전에 다시 확인한다. 확정 후에도 루트·HEAD·index·설정을 확인한다. 모든 Git 파일과 파일시스템을 함께 잠그는 트랜잭션은 아니다. 외부 프로세스가 확인 사이에 경로를 바꿨다가 복구하는 경우까지 막는 보장은 없으며, 종료·실패 시 사용자 변경을 rollback하지 않는다. 전원 손실에 대한 디렉터리 항목의 내구성도 보장하지 않는다.
