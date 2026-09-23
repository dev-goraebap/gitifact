---
title: 프로젝트 위키 형식
description: 프로젝트 위키의 형식, 에셋 규칙, 이 프로젝트의 위키 운영 방침(wiki/README.md)
---

기능에 묶이지 않는 내용은 `.gitifact/wiki/`에 둔다. 제품이 무엇이고 누구를 위한 것인지, 어떻게 만드는지, 지킬 규칙이 여기에 들어간다. 기능별 동작은 명세에 두고 위키에 반복하지 않는다. 이 출력의 앞부분은 CLI가 검사하는 형식이고, 뒷부분 "운영 방침"은 프로젝트의 `.gitifact/wiki/README.md` 본문이다. README가 없으면 내장 기본 방침이 실린다.

## 파일 구조

페이지는 `.gitifact/wiki/` 아래 Markdown 파일이며 하위 폴더를 자유롭게 둔다. 폴더·파일 이름은 소문자·숫자·하이픈이다. 루트의 페이지만 `README.md`·`ARCHITECTURE.md`처럼 대문자 이름을 쓸 수 있다. `README.md`는 위키의 운영 방침이자 진입 페이지다. `init`이 기본 방침으로 만들어 두고, 사용자가 고치면 그대로 에이전트의 방침이 된다. 브라우저와 GitHub는 폴더를 열면 이 페이지를 보여 준다.

새 페이지는 CLI로 만든다. CLI가 `W-` ID를 발급하고 프론트매터를 채우며 `draft: true`를 붙인다. 본문을 채운 뒤 이 줄을 지우고 `gitifact docs check`로 확인한다.

```text
gitifact docs new wiki conventions/code-style.md --title "코드 스타일" --description "이름 짓기와 파일 배치 규칙"
```

```markdown
---
id: W-CLI가발급한값
title: 코드 스타일
description: 이름 짓기와 파일 배치 규칙
---

규칙과 이유.
```

위 ID와 문장은 구조 설명이다. 프론트매터는 `id`·`title`·`description`만 두고 모두 필수다. 제목은 본문에 `#`로 다시 쓰지 않으며, 본문 절은 `##`부터 쓰고 gitifact 주석을 넣지 않는다. 이미 있는 페이지는 파일을 직접 고친다. 옮기거나 이름을 바꿀 때는 파일을 옮기고 ID를 유지하며, 지울 때는 파일을 지운다. 지운 페이지를 설계의 `sources`가 가리키고 있으면 그 설계도 고쳐야 `docs check`가 통과한다.

다른 페이지·명세·에셋으로 가는 링크는 이 파일 기준 상대 경로로 쓴다. 예: `conventions/code-style.md`, `../spec/posts/requirements/create.md`, `../assets/diagrams/flow.png`. 에디터와 GitHub에서는 파일 링크로 동작하고, 브라우저는 해당 페이지·기능·에셋으로 연결한다. gitifact 문서가 아닌 저장소 파일로 가는 링크는 브라우저에서 열리지 않고 경로만 복사할 수 있다. 대상이 없는 링크는 `docs check`와 `changes list`가 `MISSING_LINK_TARGET` 경고로 알린다.

페이지 본문의 문체는 `gitifact guide show writing`을 따른다.

## 에셋

이미지·PDF 등 Markdown이 아닌 파일은 `.gitifact/assets/` 아래에 둔다. 하위 폴더는 자유롭고 ID는 없다. 파일을 직접 복사해 넣고 문서에서 상대 경로로 참조한다. 권장 확장자는 png·jpg·gif·webp·svg·pdf, 권장 크기는 파일당 1MB·전체 50MB 이하다. 넘어도 커밋은 되며 `docs check`와 `changes list`가 `ASSET_SIZE`·`ASSET_EXTENSION`·`ASSETS_TOTAL_SIZE` 경고로 알린다. 어떤 문서도 참조하지 않는 에셋은 `UNREFERENCED_ASSET`으로 알린다. 브라우저는 이미지를 본문에 표시하고 그 밖의 파일은 다운로드로 제공한다. 에셋 파일 이름을 바꾸면 참조하는 문서도 함께 고친다.

## 커밋

위키 페이지의 변경 이유는 다른 문서와 같은 방식으로 `{docs: [실제 W-ID], reason}`에 적는다. 이유는 `.gitifact/history.jsonl`에 기록되므로 바뀐 페이지와 그 파일을 `paths`에 담는다(`gitifact guide show commit`).
