---
id: D-pk2piyjyx3
title: 기록 파일과 이력 읽기
description: 기록 파일 형식과 검사, 커밋 전 기록 찾기, 이력 캐시가 기록을 읽는 방식
order: 20
requirements:
  - R-hqekjinjpa
  - R-ecmf4ddygu
  - R-srbpytoxpj
sources:
  - id: I-zdpwuta64o
    note: 저장 규약과 캐시
---

## 기록 파일

| 항목 | 규칙 |
| :--- | :--- |
| 경로 | `.gitifact/records/<yyyymmdd>/<DR-ID>.md`. 폴더는 기록을 쓴 날(쓴 사람의 시간대)이며 커밋한 날과 다를 수 있다. 파일 이름이 ID와 같아야 한다(`RECORD_PATH`). 그 밖의 파일은 `PATH_UNSUPPORTED` |
| 프론트매터 | `id`(`DR-` + 소문자 base32 10자), `title`(한 줄 80자, 명사형 짧은 구는 지침이 안내하고 CLI는 길이만 검사), `docs`(S·R·D·W·I ID 목록, 비지 않고 중복 없음), 선택 `draft: true`. 그 밖의 키(옛 `type` 포함)는 `FRONTMATTER_UNKNOWN_KEY` |
| 본문 | `##` 섹션만. 첫 섹션 앞의 글, 정해진 목록에 없는 섹션, 두 번 나온 섹션은 `RECORD_SECTION_UNKNOWN`. 코드 블록 안의 제목은 글이다. `#` 제목과 gitifact 주석은 문서와 같이 금지 |
| 섹션 | 맥락(`context`, 필수), 결정(`decision`, 필수), 검토한 대안(`alternatives`, 선택). 기록에 종류가 없어 모두 같은 목록이다. 제목은 한국어·영어 이름을 모두 받아 키로 읽는다. 빈 필수 섹션은 `RECORD_SECTION_MISSING` |
| 길이 | 섹션 하나 500자(코드 포인트)까지, 넘으면 `RECORD_SECTION_TOO_LONG` |

렌더링은 프론트매터를 정해진 순서(`id`·`title`·`docs`·`draft`)로 쓰고 섹션을 원래 제목대로 잇는다. `records new`는 CLI 언어의 제목으로 필수 섹션(맥락·결정)만 쓴다.

## 커밋 전 기록

기록 파일은 모두 읽지 않는다. `git status --porcelain -z --untracked-files=all -- .gitifact/records`에서 추적되지 않거나 추가된 파일만 읽어 검사에 넘기고, 수정·삭제된 파일은 커밋된 기록이 바뀐 것으로 본다(`RECORD_ALTERED`). ID 중복은 새 기록의 ID가 다른 날짜 폴더에 있는지만 본다. 1MB를 넘는 기록, 링크, UTF-8이 아닌 파일은 문제로 알린다.

`check`와 `changes list`는 커밋 전 기록을 모두 검사해 초안도 보인다. `changes commit`은 고른 기록만 검사하므로 다음 커밋을 기다리는 초안이 커밋을 막지 않는다. 작업 폴더에 `.gitifact/history.jsonl`이 있으면 `REASONS_FILE_REMOVED`다.

## 이력 캐시

커밋의 변경은 이벤트(문서 하나의 변경)로 저장하고, 이벤트마다 그 문서를 가리키는 기록을 싣는다(`records: {id, title, sections: [{key: 'context'|'decision'|'alternatives', body}]}`).

| 커밋 | 기록을 찾는 방법 |
| :--- | :--- |
| 일반 커밋 | `git log --raw`에서 상태가 `A`인 기록 경로를 모아, 같은 `cat-file --batch`로 그 커밋의 blob을 읽는다 |
| 병합 커밋 | 부모마다 `git diff --diff-filter=A <부모> <병합>`으로 더한 기록을 구해, 모든 부모에 대해 새로운 것만 병합에 붙인다 |
| 결정기록 이전 커밋 | 이유 파일에 더한 줄을 맥락 섹션만 있는 기록으로 읽는다. ID는 그 이유의 `H-` ID, 제목은 첫 문장(80자에서 자름), 본문은 맥락 섹션 |
| 0.7 커밋 | 0.7 파서가 읽은 이유를 같은 방식으로 기록으로 바꾼다 |

기록을 싣는 형식이 바뀌어 캐시 형식 번호를 올렸다. 검색 색인의 이력 행은 기록의 제목과 섹션 본문으로 찾는다. 기록 상세가 묻는 기록의 커밋(`history.commitOfRecord`)은 그 HEAD 계보의 이력 행 중 그 ID의 기록을 싣는 커밋이다. 커밋 전체 트리를 읽는 경로(`filesAt`, `specs show --ref`)는 기록 폴더를 읽지 않는다.
