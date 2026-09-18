# Markdown 명세 형식

기능 명세는 `.gitifact/spec/<기능>/requirements.md` 하나에 그 기능의 요구사항을 담는다. 설계는 같은 폴더의 `design.md`(`gitifact docs design`), 변경 이유는 `history.jsonl`이다. 앞부분은 CLI가 검증하는 형식이고, 뒷부분 "운영 지침"은 `.gitifact/overrides/spec.md`로 대체할 수 있다.

## 파일 구조와 ID

S-ID와 R-ID는 CLI가 발급한 값을 그대로 사용한다. 형식은 `S-<난수>`와 `R-<난수>`이며 난수는 소문자 base32 10자다. R-ID에 기능 이름을 넣거나 직접 예시 ID를 만들어 저장하지 않는다. 파일은 frontmatter로 시작하고, 요구사항 제목 바로 아래 줄에 ID 주석을 둔다.

```markdown
---
id: S-CLI가발급한값
---

# 게시물 관리

## 게시물 등록
<!-- gitifact-req: R-CLI가발급한값 -->

게시물 작성자로서, 작성한 글을 나중에 다시 확인하기 위해 제목과 내용을 저장하고 싶다.

### 수용 조건

1. 조건: 사용자가 제목을 비운 채 저장을 요청합니다.
   기대 동작: 시스템은 제목 입력 안내를 표시하고 저장을 중단합니다.
```

위 ID는 구조 설명용이며 유효한 입력이 아니다. frontmatter에는 `id`만 둔다. 제목(`#`)은 한 번, 요구사항은 `##`이며 본문에 다른 gitifact 주석을 쓰지 않는다. 다른 문서로 가는 링크는 이 파일 기준 상대 경로로 쓴다(예: `../../wiki/architecture.md`, `../../assets/flow.png`). 브라우저가 그 링크를 해당 페이지로 연결하고, 대상이 없으면 `spec working`이 `MISSING_LINK_TARGET`으로 알린다.

## 저장 명령

실제 저장은 `spec working`의 stamp로 다음 JSON을 구성해 working 결과의 `inputs.save` 경로에 쓰고 `spec save --file <그 경로>`를 호출한다. 성공하면 CLI가 입력 파일을 지운다. 실패하면 파일이 남으므로 고쳐서 다시 실행한다.

```json
{
  "expected": "working의 실제 stamp",
  "operations": [
    { "type": "create", "feature": "posts", "title": "게시물 관리" },
    { "type": "add", "feature": "posts", "title": "게시물 등록", "body": "게시물 작성자로서, 작성한 글을 나중에 다시 확인하기 위해 제목과 내용을 저장하고 싶다.\n\n### 수용 조건\n\n1. 조건: 사용자가 제목을 비운 채 저장을 요청합니다.\n   기대 동작: 시스템은 제목 입력 안내를 표시하고 저장을 중단합니다." },
    { "type": "set-design", "feature": "posts", "title": "게시물 관리 설계", "body": "## 개요\n\n합의한 구현 방향과 범위.\n\n## 구조와 데이터\n\n실제 구현에 필요한 구성 요소와 저장 방식." }
  ]
}
```

명령 그룹은 `gitifact spec`이다. 기존 요구사항은 `update`의 id·title·body, 이동은 `move`의 id·feature, 명세 제목 변경은 `rename-spec`의 id·title을 사용한다. id에는 조회한 실제 R-ID 또는 S-ID를 전달한다. 전용 삭제·폴더 이름 변경 명령은 아직 없다. 미지원 작업에 존재하지 않는 명령이나 임의 전환 절차를 안내하지 않는다.

설계는 `set-design`(type·feature·title·body·선택적 sources)으로 같은 요청에 담을 수 있다. 자세한 작성 규칙은 `gitifact docs design`, 위키와 에셋은 `gitifact docs wiki`를 읽는다.
