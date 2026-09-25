---
id: D-762ay22bcn
title: 결정기록 명령과 화면
description: records·changes·check 명령의 기록 동작, 브라우저 계약과 결정기록 화면
order: 30
requirements:
  - R-o2d2lmrxaw
  - R-ecmf4ddygu
  - R-3ngq5qsdl6
  - R-qrny2tacwz
sources:
  - id: I-zdpwuta64o
    note: 명령과 계약
  - id: I-5x5yhjlk4u
    note: 화면 구성
---

## 명령

| 명령 | 동작 |
| :--- | :--- |
| `records new --title <제목> --docs <ID…>` | `DR-` ID를 발급해 오늘 날짜 폴더(`yyyymmdd`, 그날 첫 기록 때 생긴다)에 맥락·결정 섹션이 있는 초안을 쓴다. `--docs`는 쉼표나 여러 값을 받는다 |
| `records list` | HEAD 이력의 기록을 최신순으로 보인다. 맨 앞은 아직 커밋하지 않은 기록("커밋 전")이다. 기록마다 ID·제목·커밋·날짜·작성자와 그 커밋에서 기록이 설명한 문서. 필터는 `--since <날짜\|커밋>`·`--author`·`--q`(제목·섹션·커밋 메시지)이고 공통 옵션은 [문서 명령](../../specification/design/interface.md)을 따른다. 열은 `id`·`title`·`commit`·`date`·`author`·`docs`·`sections` |
| `records list --doc <ID>` | 한 문서의 결정 흐름. 그 문서가 바뀐 커밋마다 기록의 ID·제목과 섹션(CLI 언어의 이름)을 최신순으로 보이고, 기록이 필요한데 없으면 "결정기록 없음"을 적는다. `--since`·`--author`·`--q`·`--limit`은 커밋을 거른다. 열은 `commit`·`date`·`author`·`types`·`path`·`records`·`message`이고, JSON은 `doc`(`{id, title}`)과 `events` |
| `records show <DR-ID…>` | 날짜 폴더에서 찾은 원문과 그 파일을 더한 커밋(`git log --diff-filter=A`). 없으면 `UNKNOWN_RECORD` |
| `changes list` | 커밋 전 기록(`pendingRecords`), 기록 없는 수정·이동·삭제(`withoutRecord`), 두 기록이 함께 설명하는 바뀐 문서(`sharedDocuments`), 커밋된 기록의 변경(`alteredRecords`). 텍스트에서는 이번에 바뀌지 않은 문서에 `*`를 붙인다 |
| `changes commit` | 입력은 `paths`·`message`·`authorization`·`migration`. 고른 기록과 문서만 담고, 옮긴 문서의 한쪽만 고르면 `INVALID_COMMIT`. 커밋된 기록이 바뀌었으면 거부한다. 트레일러에 `Gitifact-Record: DR-…`를 더한다 |
| `check` | 커밋 전 기록을 문서와 함께 검사하고, 커밋된 기록의 변경을 `RECORD_ALTERED`로 알린다 |
| `guide show records` | 쓰는 때, 파일과 섹션, 분량, 커밋, 읽기 |

## 브라우저 계약

이벤트는 그 문서를 설명하는 기록을 `records`로 싣는다. 이를 싣는 계약은 browser-history v5, browser-history-summary v4, browser-commit v3이다. 기록 상세는 browser-record v1(`GET /api/v1/record?head&id`)로 현재 HEAD 이력에서 그 기록을 더한 커밋을 찾은 뒤 그 커밋을 browser-commit v3으로 읽는다. 기록 ID는 `DR-`이고, 기록 도입 전 이유를 읽은 기록은 `H-`다. 섹션은 `key`로 오고 화면이 그 언어의 이름을 붙인다. 검색 계약(v2)은 그대로이며 이력 결과의 줄은 기록의 제목이다.

## 결정기록 화면

메뉴 이름은 "결정기록"(영어 "Decision records"), 목록 경로는 `/records`, 기록 상세는 `/records/<기록 ID>`, 커밋 페이지는 `/records/commits/<커밋>`이다.

목록의 페이지 제목 옆 설명 `?`는 마우스를 올리거나 누르면 결정기록과 변경 이력을 읽는 화면임을 알린다. 상세와 커밋 페이지에는 두지 않는다.

| 화면 | 표시 |
| :--- | :--- |
| 목록 | 커밋마다 작성자·시각·커밋 머리 아래에 그 커밋의 기록을 3개까지 하나씩: 제목(기록 상세로 이동), 결정 섹션의 첫 줄(한 줄 글), 설명하는 문서 3개까지. 섹션 전체는 적지 않는다. 기록 없는 변경은 마지막에 모으고, 수정·이동·삭제가 있으면 "결정기록 없이 바뀐 문서"로 표시 |
| 기록 상세 | 기록 제목과 커밋 메타, 섹션마다 화면 언어의 제목과 Markdown 본문, 설명하는 문서의 목록과 고른 문서의 변경 비교, 머리의 커밋 링크. 같은 커밋의 다른 기록과 코드는 머리의 링크로 커밋 페이지에서 본다 |
| 커밋 페이지 | 결정기록·문서·코드 탭(`?tab=records\|documents\|code`). 결정기록 탭은 기록마다 제목(기록 상세로 이동)·문서 수·결정의 첫 줄, 문서 탭과 코드 탭은 파일 목록과 고른 파일의 변경 비교 |
| 개요 | 최신 커밋을 목록과 같은 모양으로 보인다 |

한 문서를 두 기록이 설명하면 그 문서는 두 기록 아래에 모두 나온다.
