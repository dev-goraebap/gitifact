---
id: D-lapfibde2z
title: 지침 명령과 API
description: instructions 명령, 체크아웃의 지침과 AGENTS.md, 지침 파일 API
order: 30
requirements:
  - R-y5tidh72gk
  - R-hjteu77gki
  - R-qrny2tacwz
---

## 명령

지침은 `instructions` 명령으로 다룬다. 목록의 공통 옵션(`--q`·`--sort`·`--limit`·`--fields`·`--format`)은 [문서 명령](../../specification/design/interface.md)과 같은 뜻이다.

| 명령 | 동작 |
| :--- | :--- |
| `instructions new <이름> --title … --description …` | 폴더와 `index.md` 뼈대를 만들고 `I-` ID를 발급한다. 초안 표시는 `draft: true` |
| `instructions list` | 맨 앞에 루트 AGENTS.md가 있는지와 그 역할(어떤 작업에 어느 지침을 읽을지 알리는 색인), 이어서 지침마다 ID·제목·폴더 이름·설명 한 줄과, 그 아래 들여 쓴 딸린 파일 한 줄씩(`경로 제목 — 설명`, 제목이 없으면 경로만). `--sort`는 `name`(기본)·`updated` |
| `instructions show <이름\|I-ID…>` | `index.md` 원문, 그 지침을 `sources`로 가리키는 설계, 폴더의 다른 파일 목록(작업 트리에서만, 목록과 같은 `경로 제목 — 설명`). 이름은 폴더 이름이다. `--ref <커밋>`은 그 커밋의 원문 |
| `instructions show <이름\|I-ID> --file <경로>` | 지침 폴더 안의 파일 하나(예: `references/code-style.md`)의 원문. 링크는 따라가지 않고, 512KB를 넘거나 텍스트가 아니면 원문 없이 크기만 알린다 |

목록의 열은 `id`·`name`·`path`·`title`·`description`·`draft`·`files`·`updated`·`line`이다. `files`는 `index.md` 밖 파일마다 `{path, size, title?, description?}`이고 경로순이다. `title`·`description`은 프론트매터를 읽은 참고 파일에만 있다. 500개를 넘으면 행에 `filesLimited: true`를 더한다. `--fields`로 `files`를 빼면 파일 줄 없이 지침만 보이고, 텍스트의 `files` 칸은 경로를 쉼표로 잇는다. `--q`는 지침을 고르며 고른 지침의 파일은 모두 보인다. `instructions show`의 JSON `files`도 같은 모양이다. JSON은 `agents`(`{path, exists}`)와 `instructions`(행 목록), `problems`(읽지 못한 지침 파일)를 싣는다. 검사는 최상위 `check`, 결정 흐름은 `records list --doc <I-ID>`가 맡는다.

AGENTS.md는 gitifact 문서가 아니다. 프로젝트가 블록 밖에 지침 색인을 쓰고, gitifact는 블록만 관리한다. 지침 형식과 색인 쓰는 법은 `guide show instructions`가 안내하며, 블록은 작업 전에 색인의 지침을 읽고 지침을 고치기 전에 이 안내를 읽으라고 알린다.

## 브라우저 API

체크아웃(browser-specs v6)은 `instructions`(지침마다 ID·폴더 이름·경로·제목·설명·본문·폴더 파일 목록·최근 변경. 파일마다 경로·크기와, 참고 파일이면 프론트매터의 선택 필드 `title`·`description`)와 `agents`(루트 AGENTS.md의 본문과 최근 변경, 없거나 1MB를 넘거나 UTF-8이 아니면 `null`)를 싣는다.

| 경로 | 내용 |
| :--- | :--- |
| `GET /api/v1/specs` | 체크아웃. 지침과 AGENTS.md 포함 |
| `GET /api/v1/instructions/file?id&path` | 지침 폴더의 파일 하나(browser-instruction-file v1). 링크는 따라가지 않고, 512KB 넘거나 이진이면 원문 없이 표시만 |

이력·요약·커밋·검색 계약은 문서 종류 `instruction`을 싣는다.
