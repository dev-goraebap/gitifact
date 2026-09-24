---
id: D-vozyvnajhy
title: 지침 형식과 이력
description: 지침 폴더와 파일, 검사, 이력, 관계
order: 20
requirements:
  - R-y5tidh72gk
  - R-rtualqkge6
  - R-nbcb2fosay
---

## 폴더와 파일

| 경로 | 판정(core `classifyDocPath`) |
| :--- | :--- |
| `.gitifact/instructions/<이름>/index.md` | 지침 문서(`kind: instruction`, `I-`) |
| `.gitifact/instructions/<이름>/**` 그 밖 | 그 지침의 파일(`instruction-file`). 문서로 파싱하지 않는다. 폴더가 있다는 표시, `docs show`의 파일 목록, 커밋 선택에 쓴다 |
| `.gitifact/instructions/<파일>`(폴더 밖) | 문제 `PATH_UNSUPPORTED` |

폴더 이름은 소문자·숫자·하이픈 80자까지다. `index.md`는 다른 문서와 같은 프론트매터(`id`·`title`·`description`, `docs new`가 붙이는 `draft: true`)와 본문 규칙(`#` 제목과 gitifact 주석 금지)을 따른다. 폴더의 파일은 500개, 파일 하나 1MB까지 읽고 링크는 따라가지 않는다.

## 검사

`docs check`는 다른 문서와 같은 흐름에서 지침을 검사한다.

| 코드 | 조건 | 종류 |
| :--- | :--- | :--- |
| `INSTRUCTION_INDEX_REQUIRED` | 지침 폴더에 `index.md`가 없음 | 문제 |
| `INSTRUCTION_SPEC_LINK` | `index.md`나 폴더의 `.md` 파일이 `.gitifact/spec` 아래를 링크함(코드 블록 안은 제외) | 문제 |
| `MISSING_LINK_TARGET` | 지침 본문의 상대 링크가 가리키는 파일이 없음(폴더 안 파일은 있는 것으로 셈) | 경고 |
| `WIKI_REMOVED` | 작업 트리의 `.gitifact/wiki/` 아래에 Markdown 파일이 있음. 문서로 읽지 않으므로 목록·검색·`docs show`에 나오지 않고, 그 W-를 가리키는 설계는 `MISSING_REFERENCE`도 받는다 | 문제 |

## 이력

지침의 변경은 `index.md`의 변경이다. 커밋 전후 비교(core `compareDocumentSets`)는 ID로 짝을 짓고, 경로가 바뀌면 이동, 내용이 바뀌면 변경이다. 캐시는 `.gitifact/instructions/*/index.md`를 기록 경로로 읽는다. 지침을 설명하는 결정기록은 `docs`에 I- ID를 적고, 트레일러는 `Gitifact-Doc`이다. 폴더 안 다른 파일은 커밋에서 선택할 수 있지만 결정기록을 요구하지 않는다. 폴더 안 파일만 바뀐 커밋을 지침의 변경으로 읽는 것은 계획이다.

## 관계

| 관계 | 어디에 적나 | gitifact가 읽는 방법 |
| :--- | :--- | :--- |
| 설계 → 지침 | 설계 `sources`의 `{id: I-…}` | 기존 참조 검사(`MISSING_REFERENCE`)와 역조회 |
| 지침 → 지침 | 본문의 상대 링크 | 브라우저가 링크로 잇는다. 관계 표로 읽는 것은 계획 |
| 지침 → 명세 | 두지 않는다 | 문제 `INSTRUCTION_SPEC_LINK` |

저장 형식을 설명하는 경로 패턴(`.gitifact/spec/<기능>/…`)은 명세를 가리키는 링크가 아니다.
