---
id: S-7ymbd7bqzf
---

# 프로젝트 위키 설계

## 개요

제품 소개·구조·규칙을 기능 명세와 같은 저장소 안에서 하나의 위키로 관리한다. 기능 명세(spec)가 "무엇을 만드는가"라면 위키는 "누구를 위해 왜, 어떻게 만드는가"를 담는다. 0.4.x의 product·guides 두 폴더와 `P-`·`G-` ID를 위키와 `W-` ID로 대체했다.

## 구조와 데이터
<!-- gitifact-ref: R-y5tidh72gk -->

`.gitifact/wiki/**/*.md`를 읽는다. 페이지는 frontmatter(`id: W-…`), 제목, 본문이며 core의 `parseDocument`가 검증한다. 진입 페이지 `README.md`는 대문자 이름을 허용하는 유일한 예외로, 루트에만 둘 수 있다. Markdown이 아닌 파일은 무시한다. 변경 이유는 `.gitifact/wiki/history.jsonl` 하나에 `documents: [W-…]`로 기록한다.

에셋은 `.gitifact/assets/**`이며 core의 `isAssetPath`가 경로를 판정한다. 파싱하지 않고 커밋 선택 검사와 서버 제공이 같은 판정을 쓴다. 권장 확장자·크기 한도는 core 상수다.

## 저장 흐름
<!-- gitifact-ref: R-y5tidh72gk, R-hjteu77gki -->

spec working이 `wiki.documents`·`wiki.history`와 함께 `warnings`, 재정의된 지침 `overrides`를 반환한다. spec save의 operations는 `create-doc`(path·title·body), `update-doc`(id·title·body), `move-doc`(id·path), `delete-doc`(id)다. `set-product`·`delete-product`는 제거했다. path는 위키 폴더 안 상대 경로다.

지침 블록과 `gitifact docs wiki`가 요구사항·설계를 정리하기 전에 README.md와 작업 영역의 페이지를 읽도록 안내한다. 무엇을 어떤 페이지로 나눌지는 `wiki.default.md`(운영 지침)에 있으며 프로젝트가 `.gitifact/overrides/wiki.md`로 대체한다. `init`은 위키를 만들지 않는다. 빈 뼈대나 페이지 세트를 만드는 안은 프로젝트마다 구성이 달라 대부분 고치게 되므로 기각했다.

## 링크와 경고
<!-- gitifact-ref: R-dzowfm436d, R-rir7dn3eez -->

core의 `extractLinks`는 코드 블록 밖의 Markdown 링크·이미지를 모으고 `resolveLink`가 문서 폴더 기준으로 저장소 상대 경로를 계산한다. 외부 URL·앵커·절대 경로·저장소 밖으로 나가는 경로는 대상이 아니다. CLI의 `working-warnings.ts`가 대상을 기록·에셋·저장소 파일 순으로 찾고 없으면 `MISSING_LINK_TARGET`을 낸다. 에셋 폴더를 훑어 `ASSET_SIZE`·`ASSET_EXTENSION`·`ASSETS_TOTAL_SIZE`·`UNREFERENCED_ASSET`을 내고, 비어 있는 재정의 파일은 `EMPTY_OVERRIDE`다. 어떤 경고도 저장·커밋을 막지 않는다.

## 이력과 비교
<!-- gitifact-ref: R-rtualqkge6 -->

커밋 전후 비교는 페이지 ID 단위다. 경로가 바뀌면 이동, 제목·본문이 바뀌면 변경이다. spec commit의 reasons에 `{requirements: [], documents: [W-…], reason}`을 받고 history.jsonl에 H-ID로 추가한다. 커밋 메시지 트레일러는 `Gitifact-Doc: <ID>`다. 커밋된 이유의 수정·삭제는 거부한다. 0.4.x의 product·guides 경로는 삭제로만 커밋 선택할 수 있다.

## 화면
<!-- gitifact-ref: R-oh4oevufr3, R-rir7dn3eez -->

왼쪽 메뉴의 첫 항목은 제품 개요(`/product`)이며 제품 문서 보기가 진입 페이지의 상세(`/wiki/<id>`)로 연결한다. 위키 메뉴는 `/wiki`(폴더는 `folder` 검색 매개변수)와 `/wiki/$documentId`이며 트리와 본문으로 된 탐색기 하나가 둘을 함께 그린다. 첫 구현은 Finder식 열 보기와 미리보기였으나, 폴더가 깊어지면 열이 본문 자리를 밀어내고 읽기까지 미리보기·상세 두 단계를 거쳐야 해 사용자 요청으로 바꿨다(2026-09-18). 브라우저 서버는 `/api/v1/assets/<경로>`로 에셋을 제공한다. 이미지는 inline, 그 밖은 attachment이며 응답에 sandbox CSP를 붙여 직접 연 SVG의 스크립트가 실행되지 않게 한다. 링크 해석은 브라우저 명세의 설계를 따른다.

## 주요 설계 결정

- 경로가 아니라 파일 안의 ID로 식별한다. 이름 변경과 폴더 이동에도 이력이 이어진다.
- product·guides를 위키 하나로 합쳤다. 사용자마다 필요한 문서 구성이 달라 고정된 두 폴더가 맞지 않았고, 브라우저 메뉴와 지침도 하나로 단순해진다. 기존 `P-`·`G-` ID를 이어 받는 안은 접두어 세 종류가 남아 기각했고, 정식 버전 전이라 전환 도구도 두지 않는다(2026-09-18 사용자 결정).
- 에셋에 ID를 두지 않는다. ID 참조는 에디터·GitHub에서 이미지로 보이지 않아 상대 링크 방식과 충돌한다. 대신 깨진 링크를 경고한다.
- 제한은 경고로만 한다. Git 저장소에 큰 파일을 두는 것은 사용자의 선택이며 커밋을 막으면 우회하게 된다.

## 자체 적용

이 저장소는 PRODUCT.md를 `wiki/README.md`로, guides 7건을 같은 상대 경로의 위키 페이지로 옮기고 새 `W-` ID를 받았다. 로고는 `assets/gitifact-logo.svg`로 옮겼다. 옛 폴더와 history.jsonl은 삭제했고 그 이력은 Git에 남아 있다.
