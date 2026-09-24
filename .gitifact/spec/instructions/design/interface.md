---
id: D-lapfibde2z
title: 지침 명령과 API
description: docs 명령의 지침, 체크아웃의 지침과 AGENTS.md, 지침 파일 API
order: 30
requirements:
  - R-y5tidh72gk
  - R-hjteu77gki
---

## 명령

지침은 다른 문서와 같은 `docs` 명령으로 다룬다. 지침만을 위한 명령은 없다.

| 명령 | 지침에 대한 동작 |
| :--- | :--- |
| `docs new instruction <이름> --title … --description …` | 폴더와 `index.md` 뼈대를 만들고 `I-` ID를 발급한다. 초안 표시는 `draft: true` |
| `docs list [--kind instruction]` | 지침마다 ID·제목·폴더 이름·설명 |
| `docs show <I-ID>` | `index.md` 원문, 가리키는 설계, 폴더의 다른 파일 목록(작업 트리에서만) |
| `docs search` | 지침도 다른 문서와 함께 찾는다 |
| `docs check`·`docs history <I-ID>` | data 설계의 검사와 이력 |

AGENTS.md는 gitifact 문서가 아니다. 프로젝트가 블록 밖에 지침 색인을 쓰고, gitifact는 블록만 관리한다.

## 브라우저 API

체크아웃(browser-specs v6)은 `instructions`(지침마다 ID·폴더 이름·경로·제목·설명·본문·폴더 파일 목록·최근 변경)와 `agents`(루트 AGENTS.md의 본문과 최근 변경, 없거나 1MB를 넘거나 UTF-8이 아니면 `null`)를 싣는다.

| 경로 | 내용 |
| :--- | :--- |
| `GET /api/v1/specs` | 체크아웃. 지침과 AGENTS.md 포함 |
| `GET /api/v1/instructions/file?id&path` | 지침 폴더의 파일 하나(browser-instruction-file v1). 링크는 따라가지 않고, 512KB 넘거나 이진이면 원문 없이 표시만 |

이력·요약·커밋·검색 계약은 문서 종류 `instruction`을 싣는다.
