---
id: D-762ay22bcn
title: 결정기록 명령과 화면
description: records·changes·docs 명령의 기록 동작, 브라우저 계약과 결정기록 화면
order: 30
requirements:
  - R-o2d2lmrxaw
  - R-ecmf4ddygu
  - R-3ngq5qsdl6
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
| `records show <DR-ID…>` | 날짜 폴더에서 찾은 원문과 그 파일을 더한 커밋(`git log --diff-filter=A`). 없으면 `UNKNOWN_RECORD` |
| `changes list` | 커밋 전 기록(`pendingRecords`), 기록 없는 수정·이동·삭제(`withoutRecord`), 두 기록이 함께 설명하는 바뀐 문서(`sharedDocuments`), 커밋된 기록의 변경(`alteredRecords`). 텍스트에서는 이번에 바뀌지 않은 문서에 `*`를 붙인다 |
| `changes commit` | 입력은 `paths`·`message`·`authorization`·`migration`. 고른 기록과 문서만 담고, 옮긴 문서의 한쪽만 고르면 `INVALID_COMMIT`. 커밋된 기록이 바뀌었으면 거부한다. 트레일러에 `Gitifact-Record: DR-…`를 더한다 |
| `docs history <ID>` | 커밋마다 기록의 ID·제목과 섹션(CLI 언어의 이름)을 보이고, 기록이 필요한데 없으면 "결정기록 없음"을 적는다 |
| `docs check` | 커밋 전 기록을 문서와 함께 검사하고, 커밋된 기록의 변경을 `RECORD_ALTERED`로 알린다 |
| `guide show records` | 쓰는 때, 파일과 섹션, 분량, 커밋, 읽기 |

## 브라우저 계약

이벤트는 그 문서를 설명하는 기록을 `records`로 싣는다. 이를 싣는 계약은 browser-history v5, browser-history-summary v4, browser-commit v3이다. 기록 상세는 browser-record v1(`GET /api/v1/record?head&id`)로 현재 HEAD 이력에서 그 기록을 더한 커밋을 찾은 뒤 그 커밋을 browser-commit v3으로 읽는다. 기록 ID는 `DR-`이고, 기록 도입 전 이유를 읽은 기록은 `H-`다. 섹션은 `key`로 오고 화면이 그 언어의 이름을 붙인다. 검색 계약(v2)은 그대로이며 이력 결과의 줄은 기록의 제목이다.

## 결정기록 화면

메뉴 이름은 "결정기록"(영어 "Decision records"), 목록 경로는 `/records`, 기록 상세는 `/records/<기록 ID>`, 커밋 페이지는 `/records/commits/<커밋>`이다.

| 화면 | 표시 |
| :--- | :--- |
| 목록 | 커밋마다 작성자·시각·커밋 머리 아래에 그 커밋의 기록을 3개까지 하나씩: 제목(기록 상세로 이동), 결정 섹션의 첫 줄(한 줄 글), 설명하는 문서 3개까지. 섹션 전체는 적지 않는다. 기록 없는 변경은 마지막에 모으고, 수정·이동·삭제가 있으면 "결정기록 없이 바뀐 문서"로 표시 |
| 기록 상세 | 기록 제목과 커밋 메타, 섹션마다 화면 언어의 제목과 Markdown 본문, 설명하는 문서마다 접히는 변경 비교, 같은 커밋의 다른 기록, 커밋의 소스 파일 |
| 커밋 페이지 | "결정기록" 절에 기록의 제목(기록 상세로 이동)과 문서 수의 목록. 아래에 문서별 변경과 소스 파일 |
| 개요 | 최신 커밋을 목록과 같은 모양으로 보인다 |

한 문서를 두 기록이 설명하면 그 문서는 두 기록 아래에 모두 나온다.
