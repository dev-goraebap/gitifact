# 기능 설계 형식

설계는 기능 폴더의 `design.md` 하나이며 여러 요구사항을 구현하는 공통 구조와 처리 방식을 설명한다. 앞부분은 CLI가 검증하는 형식이고, 뒷부분 "운영 지침"은 `.gitifact/overrides/design.md`로 대체할 수 있다.

## 파일 구조

frontmatter의 `id`는 소유 명세의 S-ID이며 CLI가 쓴다. 설계가 참고한 문서는 frontmatter의 `sources` 목록에 둔다. 항목마다 `title`과 `path`(위키 페이지로 가는 이 파일 기준 상대 경로, `.md`) 또는 `url`(http/https) 중 하나, 선택적 `note`를 쓴다. 본문 곳곳에 흩어진 링크 대신 이 목록으로 참고 문서를 관리하고, 브라우저는 이 목록을 설계 탭에 카드로 보여 준다. 외부 페이지의 제목이나 미리보기는 가져오지 않는다.

```markdown
---
id: S-소유명세의실제값
sources:
  - title: 아키텍처
    path: ../../wiki/architecture.md
    note: 계층 구조와 의존 방향
  - title: 라이브러리 문서
    url: https://example.test/docs
---

# 게시물 관리 설계

## 개요
구현할 범위와 접근 방식.

## 처리 흐름
<!-- gitifact-ref: R-관련요구사항의실제값 -->
입력부터 결과까지의 핵심 흐름.
```

위 문장은 구조 설명이다. 실제 저장할 때는 파악한 내용으로 채우고 예시 ID와 안내 문장을 그대로 저장하지 않는다. 절 단위 참조는 실제 ID로 `<!-- gitifact-ref: R-ID, R-ID -->`를 쓴다. 코드 블록의 예시는 참조가 아니다. 본문의 상대 링크(`../../assets/flow.png` 등)는 브라우저가 해당 대상으로 연결한다.

## 저장과 참조

`spec save`의 operations에 `set-design`(type·feature·title·body·선택적 sources 배열)을 사용한다. create·add·set-design을 같은 요청에 담아 두 파일을 저장할 수 있다. CLI가 frontmatter를 작성하며 빈 설계를 자동 생성하지 않는다. 신규 R-ID는 반환된 결과에서 얻은 뒤 참조가 필요한 설계 절을 후속 save로 보완한다. ID를 미리 만들어 넣지 않는다. 설계 삭제는 `delete-design`(type·feature)이다.

working/save의 `MISSING_DESIGN_REFERENCE` 경고는 삭제·이동 여부와 원문을 확인하고 필요하면 수정한다. `MISSING_LINK_TARGET`은 sources의 path나 본문 링크 대상이 없을 때 나온다. 경고를 무시한 채 연결이 유효하다고 주장하지 않는다.
