---
id: D-r4umcdt4c6
title: 프로젝트 위키 설계
description: 위키 저장과 검증, 운영 방침, 에셋과 상대 링크, 브라우저 위키 화면
order: 10
requirements:
  - R-y5tidh72gk
  - R-hjteu77gki
  - R-dzowfm436d
  - R-rir7dn3eez
  - R-rtualqkge6
  - R-oh4oevufr3
---

## 개요

제품 소개·구조·규칙을 기능 명세와 같은 저장소 안에서 하나의 위키로 관리한다. 기능 명세(spec)가 "무엇을 만드는가"라면 위키는 "누구를 위해 왜, 어떻게 만드는가"를 담는다. 0.4.x의 product·guides 두 폴더와 `P-`·`G-` ID를 위키와 `W-` ID로 대체했다.

## 구조와 데이터

`.gitifact/wiki/**/*.md`를 읽는다. 페이지는 frontmatter(`id: W-…`, `title`, `description`)와 본문이며 core의 `parseDocumentFile`이 검증한다. 본문에는 `#` 제목을 쓰지 않는다. 파일·폴더 이름은 소문자·숫자·하이픈이고 폴더 깊이는 7단계까지다. 대문자 이름(`README.md`, `ARCHITECTURE.md` 등)은 위키 루트에서만 허용하며, 진입 페이지는 `README.md`다. Markdown이 아닌 파일은 무시한다. 변경 이유는 명세와 같은 `.gitifact/history.jsonl`에 `docs: [W-…]`로 기록한다.

에셋은 `.gitifact/assets/**`이며 core의 `isAssetPath`가 경로를 판정한다. 파싱하지 않고 `changes commit`의 선택 검사와 서버 제공이 같은 판정을 쓴다. 권장 확장자·크기 한도는 core 상수다.

## 작성 흐름

`docs list --kind wiki`와 `docs show <W-ID>`로 읽는다. 새 페이지는 `docs new wiki <경로>`로 만들고(경로는 위키 폴더 안 상대 경로, `.md`는 생략 가능), 그 밖의 수정·이동·삭제는 파일을 직접 고친 뒤 `docs check`로 확인한다.

지침 블록이 요구사항·설계·코드를 바꾸기 전에 `gitifact guide show wiki`를 확인하도록 안내하고, `guide show wiki`는 형식 뒤에 `README.md` 본문을 운영 방침으로 싣는다(에이전트 작업 흐름 설계의 위키 운영 방침 절). README가 없으면 기본 방침을 싣는다. `init`은 처음 도입할 때 기본 방침 README 한 페이지만 만든다. 기본 방침은 결정 기록을 쌓는 것 하나로 두었다. 목적별 페이지 세트를 미리 만드는 안은 프로젝트마다 구성이 달라 대부분 고치게 되므로 기각했다.

## 링크와 경고

본문 링크는 그 파일 기준 상대 경로이며 브라우저가 그릴 때 대상을 해석한다. 문서 사이의 관계는 링크가 아니라 frontmatter로 나타내므로 CLI는 링크를 참조로 읽지 않는다.

0.7에서는 `spec working`이 core `extractLinks`·`resolveLink`로 링크 대상을 찾아 `MISSING_LINK_TARGET`을, 에셋 폴더를 훑어 `ASSET_SIZE`·`ASSET_EXTENSION`·`ASSETS_TOTAL_SIZE`·`UNREFERENCED_ASSET`을 경고로 냈다(`working-warnings.ts`). 0.8.0 명령에는 이 경고가 아직 없다. `docs check`는 링크와 에셋을 검사하지 않으며, 경고 코드는 옛 store 코드에만 남아 있다. 경고를 되살릴 때도 저장·커밋은 막지 않는다.

## 이력과 비교

커밋 전후 비교는 페이지 ID 단위다. 경로가 바뀌면 이동, 파일 내용이 바뀌면 변경이다. `changes commit`의 reasons에 `{docs: [W-…], reason}`을 받고 `.gitifact/history.jsonl`에 H-ID를 붙여 줄을 더한다. 커밋 메시지 트레일러는 `Gitifact-Doc: <ID>`다. 문서 이력은 `docs history <W-ID>`와 브라우저 활동으로 본다.

## 화면

왼쪽 메뉴의 첫 항목은 제품 개요(`/product`)이며 위키와 연결하지 않는다. README가 위키 운영 방침이 되면서 대시보드의 "제품 문서 보기" 링크는 사용자 결정으로 없앴다(2026-09-18). 위키 메뉴는 `/wiki`(폴더는 `folder` 검색 매개변수)와 `/wiki/$documentId`이며 트리와 본문으로 된 탐색기 하나가 둘을 함께 그린다. 위키에 README 하나만 있으면 `/wiki`가 목록 대신 README를 바로 연다. 첫 구현은 Finder식 열 보기와 미리보기였으나, 폴더가 깊어지면 열이 본문 자리를 밀어내고 읽기까지 미리보기·상세 두 단계를 거쳐야 해 사용자 요청으로 바꿨다(2026-09-18). 브라우저 서버는 `/api/v1/assets/<경로>`로 에셋을 제공한다. 이미지는 inline, 그 밖은 attachment이며 응답에 sandbox CSP를 붙여 직접 연 SVG의 스크립트가 실행되지 않게 한다. 링크 해석은 브라우저 명세의 설계를 따른다.

## 주요 설계 결정

- 경로가 아니라 파일 안의 ID로 식별한다. 이름 변경과 폴더 이동에도 이력이 이어진다.
- product·guides를 위키 하나로 합쳤다. 사용자마다 필요한 문서 구성이 달라 고정된 두 폴더가 맞지 않았고, 브라우저 메뉴와 지침도 하나로 단순해진다. 기존 `P-`·`G-` ID를 이어 받는 안은 접두어 세 종류가 남아 기각했고, 정식 버전 전이라 전환 도구도 두지 않는다(2026-09-18 사용자 결정).
- 에셋에 ID를 두지 않는다. ID 참조는 에디터·GitHub에서 이미지로 보이지 않아 상대 링크 방식과 충돌한다. 대신 깨진 링크를 경고한다(0.8.0 명령에는 아직 없다. 링크와 경고 절).
- 제한은 경고로만 한다. Git 저장소에 큰 파일을 두는 것은 사용자의 선택이며 커밋을 막으면 우회하게 된다.

## 자체 적용

이 저장소는 PRODUCT.md를 `wiki/README.md`로, guides 7건을 같은 상대 경로의 위키 페이지로 옮기고 새 `W-` ID를 받았다. 로고는 `assets/gitifact-logo.svg`로 옮겼다. 옛 폴더와 history.jsonl은 삭제했고 그 이력은 Git에 남아 있다.
