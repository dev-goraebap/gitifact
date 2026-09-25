---
id: D-j5ixcrj4g2
title: 문서 명령
description: 리소스별 명령 체계, 목록의 공통 옵션, specs 명령의 필터와 출력
order: 20
requirements:
  - R-qrny2tacwz
  - R-errzmn5edh
  - R-uvehohexvw
sources:
  - id: I-zdpwuta64o
    note: 명령과 출력 계약, 오류 코드
---

## 명령 체계

문서를 다루는 명령은 리소스마다 `list`·`show`·`new`를 둔다. 리소스는 명세(`specs`), 지침(`instructions`), 결정기록(`records`)이고, 커밋 전 변경은 `changes`가 맡는다. 문서 전체 검사는 명세와 지침 사이의 참조까지 함께 보아야 해서 최상위 `check` 하나다. 최상위에는 이 밖에 시스템 명령(`init`·`update`·`browser`·`guide`)만 둔다.

| 명령 | 하는 일 | 설계 |
| :--- | :--- | :--- |
| `specs list`·`show <ID…>`·`new <종류> <경로>` | 기능·요구사항·설계의 목록, 원문과 참조, ID 발급과 뼈대 | 이 문서 |
| `instructions list`·`show <이름\|ID…>`·`new <이름>` | 지침의 목록, 원문과 폴더 파일, ID 발급과 뼈대 | [지침 명령과 API](../../instructions/design/interface.md) |
| `records list`·`show <DR-ID…>`·`new` | 결정기록의 목록과 문서별 흐름, 원문, 초안 | [결정기록 명령과 화면](../../records/design/interface.md) |
| `changes list`·`commit` | 바뀐 문서와 커밋 | [Git 기록 연결 설계](../../git-history/design/overview.md) |
| `check` | 문서·결정기록 전체 검사 | [개요](overview.md)의 검사 |

명령은 `apps/cli/src/commands/`에 리소스별 파일(`specs.ts`·`instructions.ts`·`records.ts`·`changes.ts`·`check.ts`)로 두고, 목록 옵션의 해석과 출력은 `list-options.ts`가 함께 쓴다. 출력의 `contract`는 명령의 리소스 이름(`specs`·`instructions`·`records`·`changes`·`check`)이고 버전은 1이다.

## 목록의 공통 옵션

세 리소스의 `list`는 같은 옵션을 같은 뜻으로 받는다. 조회는 모두 캐시(`.gitifact/cache/index.db`)를 거친다. 이력이 필요한 옵션을 쓸 때만 HEAD 이력을 캐시에 채우므로, 이력 옵션이 없는 목록은 처음 실행에도 Git 이력을 읽지 않는다. 브라우저 서버와 CLI가 함께 쓰는 조회는 `apps/cli/src/queries/`에 한 함수씩 둔다(문서 상태, 커밋 전 변경).

| 옵션 | 뜻 |
| :--- | :--- |
| `--q <말>` | 제목·경로·설명·본문(결정기록은 제목과 섹션, 커밋 메시지)에 그 말이 있는 것만. 대소문자를 가리지 않는다. 명세·지침은 찾은 줄을 함께 보인다 |
| `--author <이름\|이메일>` | 그 작성자가 HEAD 이력에서 바꾼 것만. Git 작성자 이름이나 이메일과 대소문자 없이 같아야 한다 |
| `--sort <기준>` | 정렬. 리소스마다 받는 값이 다르다 |
| `--limit <n>` | 한 페이지의 개수. 기본 20 |
| `--after <값>` | 앞 페이지 끝에 나온 값(커서) 다음부터. 목록에 없는 값은 `INVALID_VALUE` |
| `--all` | 페이지로 나누지 않고 전부. `--limit`과 함께 쓸 수 없다 |
| `--fields <열,…>` | 고른 열만. 텍스트는 한 줄에 한 항목을 탭으로 나눠 보이고, JSON은 항목마다 그 열만 싣는다. 모르는 열은 `INVALID_VALUE` |
| `--format text\|json` | 기본은 텍스트. JSON은 `{contract, version, ok}` 봉투에 같은 결과를 싣는다 |

목록은 한 번에 20개씩 보인다. 커서는 그 페이지 마지막 항목의 키다(명세 기능 순서는 기능의 S-ID, 그 밖의 명세·지침은 문서 ID, 결정기록은 기록 ID, `records list --doc`은 커밋). 그래서 앞의 항목이 늘거나 줄어도 다음 페이지는 그 항목 다음에서 시작한다. 더 있으면 텍스트 끝에 `<단위> 20/121개. 다음 페이지: 같은 명령에 --after <값>`을 적고, JSON은 `page`(`{total, next, unit}`, 끝이면 `next`가 null)를 싣는다. `--fields`의 텍스트는 행만 stdout에 두고 이 줄은 stderr로 보낸다.

명세·지침 목록은 작업 폴더의 문서와, 마지막 커밋에만 있는 문서(지워서 커밋하면 사라질 문서)를 함께 보인다. 상태는 `git status` 한 번(`.gitifact/spec`·`instructions`·`wiki`)으로 정한다. 새 경로는 추가, 고친 파일은 변경, 지운 경로는 HEAD의 blob을 읽어 그 문서를 삭제 예정으로 둔다. 지운 경로와 새 경로가 같은 ID를 가지면 옮긴 것이라 한 줄의 변경이고 `previousPath`에 옛 경로를 싣는다. 파싱되지 않는 파일은 삭제로 보지 않는다. staging 여부는 가리지 않는다. 텍스트는 커밋되지 않은 문서의 줄 끝에 `(커밋 전: 추가)`·`(커밋 전: 변경)`·`(커밋 전: 삭제 예정)`을 붙이고, JSON은 모든 행에 `state`(`committed`·`added`·`modified`·`deleted`)를 싣는다.

날짜나 커밋을 받는 옵션(`--changed-since`, `--since`)은 `YYYY-MM-DD`로 시작하는 값을 날짜로, 그 밖의 값은 커밋으로 읽는다. 날짜는 그날 0시(UTC)부터의 커밋, 커밋은 `<커밋>..HEAD`에 든 커밋이다. 커밋을 찾지 못하면 `INVALID_VALUE`다.

## specs list

목록은 본문 없이 프론트매터를 보인다. 행 하나가 문서 하나이며, 필터는 행을 고른다.

| 옵션 | 고르는 행 |
| :--- | :--- |
| `--type feature\|requirement\|design` | 그 종류만 |
| `--feature <폴더>` | 그 기능 폴더의 문서만. 없는 폴더면 `UNKNOWN_FEATURE` |
| `--without-design` | 설계 파일이 하나도 없는 기능의 기능 소개와 요구사항 |
| `--uncovered` | 어떤 설계의 `requirements`에도 없는 요구사항 |
| `--draft` | `draft: true`가 남은 문서 |
| `--changed-since <날짜\|커밋>` | 그 뒤 HEAD 이력에서 바뀐 문서 |
| `--author`·`--q` | 공통 옵션 |

`--sort`는 `order`(기본)·`title`·`updated`를 받는다. `order`는 한 페이지가 기능 20개이고 그 기능의 문서는 개수와 관계없이 모두 같은 페이지에 둔다. 기능 폴더 이름순으로 기능을 묶고, 기능 안에서 기능 소개, 요구사항, 설계를 각자의 `order` 순으로 보인다. 행이 하나라도 남은 기능은 기능 소개가 걸러졌어도 머리 줄을 보여 어느 기능인지 알린다. `title`과 `updated`는 묶지 않고 한 줄에 문서 하나를 보이며 문서 20개씩 나누고, `updated`는 HEAD 이력의 마지막 변경이 최근인 순이고 이력이 없는 문서가 맨 뒤다.

| 열 | 내용 |
| :--- | :--- |
| `id`·`kind`·`feature`·`path`·`title`·`description` | 프론트매터와 위치. `kind`는 `feature`·`requirement`·`design` |
| `order`·`draft` | 요구사항·설계의 순서, 초안 여부 |
| `state`·`previousPath` | 마지막 커밋 대비 상태, 옮긴 문서의 옛 경로 |
| `requirements`·`sources` | 설계가 가리키는 문서(제목과 함께)와 외부 자료 |
| `designs` | 요구사항을 가리키는 설계 |
| `updated` | HEAD 이력의 마지막 변경(커밋·날짜·작성자). 이력을 읽는 옵션이나 이 열을 고를 때만 채운다 |
| `line` | `--q`로 찾은 줄 |

JSON은 `documents`(행 목록), `orphans`(`index.md`가 없는 기능 폴더), `problems`(읽지 못한 파일), `page`를 싣는다. 텍스트는 목록 뒤에 `index.md`가 없는 기능 폴더와 읽지 못한 파일 수를 알려 손상을 빈 결과로 보이지 않게 한다.

## specs show·new

`specs show <ID…>`는 파일 원문을 그대로 보이고, 이어서 그 문서가 가리키는 문서와 그 문서를 가리키는 설계를 제목과 함께 보인다. `--ref <커밋>`은 그 커밋의 원문과 관계를 읽는다. 지침 ID를 받으면 `UNKNOWN_DOCUMENT`로 거부하며 `instructions show`를 쓰라고 알린다.

`specs new <종류> <경로> --title … --description …`의 종류는 `feature`·`requirement`·`design`이다. ID 발급, 프론트매터와 본문 뼈대, `order`, `draft: true`는 [개요](overview.md)의 작성 흐름을 따른다.
