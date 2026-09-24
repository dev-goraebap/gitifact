---
title: 프로젝트 지침 형식
description: 작업별 지침 폴더의 형식, AGENTS.md 색인, 명세와의 관계, 에셋과 커밋
---

프로젝트 지침은 이 프로젝트에서 어떻게 일하는지를 담는다. 아키텍처 규칙, 여러 기능에 걸친 결정, 문체, 검증 절차가 여기에 들어간다. 요구사항은 무엇을 만들지, 설계는 한 기능을 어떻게 만들지를 말하고, 지침은 기능과 무관하게 일하는 방식을 말한다. 기능별 동작은 명세에 두고 지침에 반복하지 않는다.

## 폴더와 파일

지침 하나는 `.gitifact/instructions/<이름>/` 폴더다. 이름은 소문자·숫자·하이픈 80자까지다. 폴더의 `index.md`가 지침 문서이고, 긴 내용은 같은 폴더의 `references/` 아래 파일로 나눈다. `index.md`는 필요한 references를 상대 링크로 가리킨다.

```text
.gitifact/instructions/
  cli-architecture/
    index.md                 지침 문서 (I-)
    references/
      decisions.md           결정 표
  verification/
    index.md
```

새 지침은 CLI로 만든다. CLI가 `I-` ID를 발급하고 프론트매터를 채우며 `draft: true`를 붙인다. 본문을 채운 뒤 이 줄을 지우고 `gitifact docs check`로 확인한다.

```text
gitifact docs new instruction code-review --title "코드 리뷰" --description "리뷰에서 확인할 것과 보고 형식. 변경을 리뷰할 때 쓴다."
```

```markdown
---
id: I-CLI가발급한값
title: 코드 리뷰
description: 리뷰에서 확인할 것과 보고 형식. 변경을 리뷰할 때 쓴다.
---

규칙과 이유. 긴 목록은 [references/checklist.md](references/checklist.md)에 둔다.
```

위 ID와 문장은 구조 설명이다. `index.md`의 프론트매터는 `id`·`title`·`description`만 두고 모두 필수다. `description`에는 무엇을 담는지와 어떤 작업 때 읽는지를 함께 쓴다. 제목은 본문에 `#`로 다시 쓰지 않으며, 본문 절은 `##`부터 쓰고 gitifact 주석을 넣지 않는다. references 파일은 문서로 파싱하지 않으므로 프론트매터와 ID가 없고 형식이 자유롭다. 본문의 문체는 `gitifact guide show writing`을 따른다.

이미 있는 지침은 파일을 직접 고친다. 이름을 바꿀 때는 폴더를 옮기고 ID를 유지하며, 지울 때는 폴더를 지운다. 지운 지침을 설계의 `sources`가 가리키고 있으면 그 설계도 고쳐야 `docs check`가 통과한다. `index.md`가 없는 지침 폴더는 `INSTRUCTION_INDEX_REQUIRED` 문제다.

## AGENTS.md 색인

에이전트는 모든 세션에서 AGENTS.md를 읽는다. 어떤 작업 때 어느 지침을 읽을지는 AGENTS.md의 GITIFACT 블록 밖에 짧게 적는다. 블록은 CLI가 갱신하므로 색인을 블록 안에 쓰지 않는다.

```markdown
## 작업별 지침

- CLI 코드를 바꿀 때: `.gitifact/instructions/cli-architecture/index.md`
- 변경을 검증하거나 커밋하기 전: `.gitifact/instructions/verification/index.md`
```

지침을 만들거나 이름을 바꾸거나 지우면 색인도 함께 고친다. 매 세션 필요한 짧은 사실은 AGENTS.md에 두고, 특정 작업 때만 필요한 내용은 지침에 둔다.

## 명세와의 관계

지침은 명세를 가리키지 않는다. 지침은 여러 기능에 걸친 지식이라, 한 기능의 명세에 묶이면 명세가 바뀔 때 함께 낡는다. 설계가 따른 지침을 `sources`에 `{id: I-…}`로 올리는 한 방향만 둔다. 지침 폴더의 Markdown이 `.gitifact/spec/` 아래를 링크하면 `INSTRUCTION_SPEC_LINK` 문제다. 저장 형식을 설명하는 경로 패턴을 코드 블록 안에 쓰는 것은 링크가 아니다.

지침 사이의 링크와 에셋으로 가는 링크는 이 파일 기준 상대 경로로 쓴다. 예: `../verification/index.md`, `../../assets/diagrams/flow.png`. 대상이 없는 링크는 `docs check`와 `changes list`가 `MISSING_LINK_TARGET` 경고로 알린다.

## 결정

여러 기능에 걸친 구조·기술 선택은 그 영역 지침의 `references/decisions.md`에 표로 한 줄씩 둔다. 한 기능 안에서만 유효한 선택은 그 기능 설계의 결정 표에 둔다(`gitifact guide show design`).

```markdown
| 결정 | 이유 | 기각한 안 |
| :--- | :--- | :--- |
| 저장소 접근은 어댑터 계층에만 둔다 | 명령이 파일 형식을 몰라도 된다 | 명령에서 직접 읽기(형식이 바뀌면 명령 전부를 고침) |
```

결정이 바뀌면 그 줄을 고친다. 옛 결정과 바뀐 경위는 커밋의 변경 이유에 쓴다.

## 에셋

이미지·PDF 등 Markdown이 아닌 파일은 지침 폴더 안이나 `.gitifact/assets/` 아래에 둔다. 한 지침만 쓰는 파일은 그 폴더에, 여러 문서가 함께 쓰는 파일은 assets에 둔다. assets의 권장 확장자는 png·jpg·gif·webp·svg·pdf, 권장 크기는 파일당 1MB·전체 50MB 이하다. 넘어도 커밋은 되며 `docs check`와 `changes list`가 `ASSET_SIZE`·`ASSET_EXTENSION`·`ASSETS_TOTAL_SIZE` 경고로 알린다. 어떤 문서도 참조하지 않는 assets 파일은 `UNREFERENCED_ASSET`으로 알린다.

## 커밋

지침의 변경은 `index.md`의 변경이다. 변경 이유는 다른 문서와 같은 방식으로 `{docs: [실제 I-ID], reason}`에 적는다. 폴더 안 다른 파일도 `paths`에 담아 함께 커밋할 수 있고, 그 파일에는 이유를 요구하지 않는다(`gitifact guide show commit`).

## 에이전트

- 요구사항·설계·코드를 바꾸기 전에 AGENTS.md 색인에서 작업 영역에 맞는 지침을 찾아 읽고 따른다. 맞는 지침이 없으면 없다고 보고 진행한다.
- 요청이 지침과 어긋나면 진행 전에 알린다. 지침을 바꿀지는 사용자와 정한다.
- 여러 기능에 걸친 규칙이나 결정을 새로 정하면 지침에 남길지 제안한다. 사용자가 동의하면 기존 지침을 고치거나 `gitifact docs new instruction`으로 만들고 AGENTS.md 색인을 함께 고친다.
- 0.7의 위키(`.gitifact/wiki/`)는 0.8.0에서 지침으로 바뀌었다. 위키 페이지가 남아 있으면 `docs check`가 `WIKI_REMOVED`로 알린다. 옮기는 절차는 `gitifact guide show migrate`를 따른다.
