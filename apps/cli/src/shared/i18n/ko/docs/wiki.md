# 프로젝트 위키 형식

기능에 묶이지 않는 내용은 `.gitifact/wiki/`에 둔다. 제품이 무엇이고 누구를 위한 것인지, 어떻게 만드는지, 지킬 규칙이 여기에 들어간다. 기능별 동작은 명세에 두고 위키에 반복하지 않는다. 이 출력의 앞부분은 CLI가 검증하는 형식이고, 뒷부분 "운영 방침"은 프로젝트의 `.gitifact/wiki/README.md` 본문이다. README가 없으면 내장 기본 방침이 실린다.

## 파일 구조

페이지는 `.gitifact/wiki/` 아래 Markdown 파일이며 하위 폴더를 자유롭게 둔다. 폴더·파일 이름은 소문자·숫자·하이픈이다. 루트의 페이지만 `README.md`·`ARCHITECTURE.md`처럼 대문자 이름을 쓸 수 있다. `README.md`는 위키의 운영 방침이자 진입 페이지다. `init`이 기본 방침으로 만들어 두고, 사용자가 고치면 그대로 에이전트의 방침이 된다. 브라우저와 GitHub는 폴더를 열면 이 페이지를 보여 준다.

각 파일은 CLI가 발급한 `W-<난수>` ID를 담은 frontmatter, 최상위 제목, 본문 순서다. 본문에는 다른 gitifact 주석을 쓰지 않는다. 손으로 파일을 만들지 말고 `spec save`로 저장한다. 변경 이유는 `.gitifact/wiki/history.jsonl` 하나에 쌓인다.

```markdown
---
id: W-CLI가발급한값
---

# 아키텍처

계층 구조와 의존 방향.
```

다른 페이지·명세·에셋으로 가는 링크는 이 파일 기준 상대 경로로 쓴다. 예: `conventions/code-style.md`, `../spec/posts/requirements.md`, `../assets/diagrams/flow.png`. 에디터와 GitHub에서는 파일 링크로 동작하고, 브라우저는 해당 페이지·기능·에셋으로 연결한다. gitifact 문서가 아닌 저장소 파일로 가는 링크는 브라우저에서 열리지 않고 경로만 복사할 수 있다. 대상이 없는 링크는 `spec working`이 `MISSING_LINK_TARGET`으로 알린다.

페이지 본문의 문체는 `gitifact docs writing`을 따른다.

## 에셋

이미지·PDF 등 Markdown이 아닌 파일은 `.gitifact/assets/` 아래에 둔다. 하위 폴더는 자유롭고 ID는 없다. 파일을 직접 복사해 넣고 문서에서 상대 경로로 참조한다. 권장 확장자는 png·jpg·gif·webp·svg·pdf, 권장 크기는 파일당 1MB·전체 50MB 이하다. 넘어도 저장·커밋은 되며 `spec working`이 `ASSET_SIZE`·`ASSET_EXTENSION`·`ASSETS_TOTAL_SIZE`로 알린다. 어떤 문서도 참조하지 않는 에셋은 `UNREFERENCED_ASSET`으로 알린다. 브라우저는 이미지를 본문에 표시하고 그 밖의 파일은 다운로드로 제공한다. 에셋 파일 이름을 바꾸면 참조하는 문서도 함께 고친다.

## 저장 명령

`spec save`의 operations를 쓴다. 생성은 `create-doc`(type·path·title·body), 수정은 `update-doc`(type·id·title·body), 이동·이름 변경은 `move-doc`(type·id·path), 삭제는 `delete-doc`(type·id)다. path는 `.gitifact/wiki/` 안 상대 경로이며 `.md`로 끝난다.

```json
{
  "expected": "working의 실제 stamp",
  "operations": [
    { "type": "create-doc", "path": "README.md", "title": "제품 이름", "body": "한 문단 정의, 대상 사용자, 원칙, 범위 밖. 나머지 페이지로 가는 링크." },
    { "type": "create-doc", "path": "conventions/code-style.md", "title": "코드 스타일", "body": "규칙과 이유." }
  ]
}
```

커밋할 때 위키 변경 이유는 `{requirements: [], documents: [실제 W-ID], reason: 실제 이유}`로 전달한다(`gitifact docs commit`).
