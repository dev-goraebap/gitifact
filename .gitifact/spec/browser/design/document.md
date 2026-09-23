---
id: D-znxpyu33sr
title: 문서 표시
description: 문서 본문 렌더링, 코드·다이어그램·알림 표시, 문서 링크 해석
order: 50
requirements:
  - R-xqf3xsumye
  - R-oh4oevufr3
  - R-wa3wnknrlt
  - R-wgi4sahmou
---

## 문서 읽기

위키 페이지·요구사항 본문·설계·활동 전후 본문·소개는 shared/ui/document의 DocumentBody로 렌더링한다. Astryx Markdown은 문단을 680px로 제한하면서 표·코드·구분선은 전체 폭으로 그려 오른쪽 끝이 어긋나므로, 읽기 영역을 48rem 한 폭으로 묶고 contentWidth를 100%로 둔다. 크기는 Astryx 글자 토큰을 읽기 영역에서 재정의해 맞춘다. 본문 16px·줄 간격 1.8, 코드 14px, 목록은 한 단계 작은 15px·줄 간격 1.65다. 목록은 Astryx List라 항목마다 위아래 4px 여백과 항목 사이 2px 간격이 붙어, 줄 간격만 줄이면 여전히 벌어져 보였다. 읽기 영역 안에서만 항목 여백을 2px, 간격을 0으로 덮는다(Astryx 원자 클래스가 ID 두 개 무게라 같은 무게로 쓴다. List 테마를 바꾸면 문서 이력·위키 목록도 바뀐다). 항목 간 거리는 약 44px에서 31px이 됐다(2026-09-23 사용자 요청). 제목은 어느 단계에서도 본문보다 크게 잡고 위 간격을 아래보다 넓게 준다. 표는 테두리·둥근 모서리·옅은 머리글 행과 내부 가로 스크롤, 인용은 옅은 바탕과 왼쪽 선, 인라인 코드는 테두리 있는 칩, 링크는 테마상 글자색과 같으므로 밑줄로 구분한다. `density`로 compact 표시를 고를 수 있지만 지금 compact를 넘기는 화면은 없다.

코드 펜스는 `components.code`를 우리 렌더러로 바꿔 받는다. 언어가 `mermaid`면 다이어그램으로 그리고 나머지는 Astryx CodeBlock 그대로다. Astryx는 이 슬롯을 바꾸면 자기 감싸개까지 내주므로 블록 사이 간격은 document.module.css의 클래스가 대신 준다. stone 테마의 구문 색은 모두 회색 계열이라 하이라이팅이 보이지 않으므로, GitHub 라이트·다크 값을 한 쌍으로 묶은 구문 테마(shared/ui/document/syntax.ts)를 앱 전체에 SyntaxTheme으로 적용한다. 일반 식별자·구두점·주석·배경은 테마 토큰을 써서 모든 색 조합과 어울린다. Astryx 토크나이저가 모르는 언어(markdown·text 등)는 색 없이 나온다. Tailwind 기반인 fumadocs 스타일을 들여오는 안은 디자인 체계가 둘이 되어 기각했다.

다이어그램은 mermaid 11이며 `import('mermaid')`로만 불러 자기 청크에 남는다. 다이어그램이 없는 문서는 그 청크를 내려받지 않고, 파일은 패키지에 함께 담겨 있어 네트워크를 쓰지 않는다. mermaid는 색을 SVG 안에 써 넣어 `var(--color-*)`를 스스로 읽지 못하므로, 그리기 직전에 그 자리에서 토큰으로 칠한 탐침 요소의 계산된 색(`rgb(…)`)을 읽어 themeVariables로 넘기고 화면 모드·색 조합이 바뀌면 다시 그린다. `securityLevel: 'strict'`로 원문의 click 지시를 거부한다. 라벨은 `htmlLabels: false`로 SVG 텍스트로 그린다. 종류별 설정만으로는 꺼지지 않아 최상위 설정도 함께 준다. 폭이 열보다 넓은 그림은 열에 맞춰 축소되는데, foreignObject 안의 HTML 라벨은 축소를 따르지 않아 상자 밖으로 삐져나오기 때문이다. mermaid는 그림을 문서에 넣어 크기를 재므로, 그 자리를 화면 밖 고정 위치의 요소 하나로 지정한다. 기본값인 `<body>`에 재면 문서가 잠깐 뷰포트보다 커져 스크롤바가 생겼다 사라지고 화면이 좌우로 흔들린다. 재는 요소를 숨기면(visibility:hidden) 폭이 0으로 측정되므로 화면 밖에 두되 숨기지 않는다. 글꼴이 도착하기 전에 재면 상자가 작게 잡히므로 `document.fonts.ready`를 기다린다. 문법이 잘못된 펜스는 문서 전체를 잃지 않도록 그 자리에만 원문 CodeBlock과 파서 메시지를 보여 준다. 렌더러가 만든 SVG는 문자열이라 그 자리에만 innerHTML로 넣으며, 이는 원문 Markdown의 HTML을 실행하지 않는다는 규칙과 별개다. CDN 로딩은 오프라인 동작과 어긋나 기각했고, 그림을 이미지로 미리 굽는 안은 원문이 저장소에서 바로 읽혀야 해 기각했다.

GitHub 알림(`> [!NOTE]` 등 다섯 종류)은 `components.blockquote`에서 가른다. Astryx는 인용 안의 내용을 이미 React 요소로 만들어 넘기므로, 첫 글자 뭉치에서 표지를 떼어 내고 남은 내용을 그대로 쓴다. 표지가 없으면 Astryx Blockquote 그대로다. Astryx는 Blockquote를 인용에만 쓰라고 하므로 알림 상자는 VStack·HStack·Text와 색 토큰(blue·green·purple·yellow·red)으로 짰다. 종류 이름은 다른 화면 문구와 같이 shared/i18n에 둔다. 원문을 미리 고쳐 넣는 안은 Markdown 인스턴스가 쪼개져 제목 id와 목차가 어긋나므로 기각했다.

## 문서 링크

문서 링크는 원문을 두고 렌더링 때 번역한다. `resolveDocumentLink.ts`가 문서의 저장소 경로(`from`)와 링크로 대상을 계산한다. 스킴이 있거나 `//`로 시작하면 외부(새 탭, noopener), `#`만 있으면 페이지 안 앵커, `/`로 시작하면 앱 경로다. 그 밖은 `from`의 폴더 기준으로 `.`·`..`를 풀어 저장소 상대 경로를 만들고, 위키 페이지 경로와 같으면 `/wiki/$documentId`, `spec/<기능>/index.md`면 `/features/$featureId`의 요구사항 탭(기능 소개가 그 맨 위에 있다), `spec/<기능>/requirements/<slug>.md`·`design/<slug>.md`면 같은 기능의 해당 탭으로 보내고 링크에 프래그먼트가 없으면 그 문서의 ID를 프래그먼트로 붙인다. 기능이나 그 경로의 문서가 없으면 대상이 없는 상태다. `.gitifact/assets/` 아래면 `/api/v1/assets/<인코딩한 경로>`로 바꾼다. 저장소 루트 위로 올라가거나 그 밖의 저장소 파일이면 "브라우저 밖" 상태다. href 없는 Astryx Link를 흐린 색과 점선 밑줄로 그리고 Tooltip을 붙이며, 클릭하면 clipboard에 저장소 경로를 복사하고 toast로 알린다. 대상이 없는 페이지·기능은 취소선 Text와 툴팁이다(비활성 button은 hover가 없어 툴팁이 뜨지 않아 링크 모양을 쓰지 않았다). 이미지는 같은 규칙으로 src를 바꾸고 해석되지 않으면 대체 텍스트만 보인다. 문서 경로는 `DocumentBody`의 `path`로 받아 context에 두고, `DocumentIndexProvider`가 첫 명세 응답의 페이지·기능 목록을 제공한다. 서버는 `.gitifact` 밖 파일을 제공하지 않는다.

설계 탭은 설계 파일마다 `sources`가 있으면 본문 위에 "참고 문서" 목록을 compact List로 그린다. 제목이 링크(ID로 가리킨 문서는 서버가 알려 준 경로를 같은 해석 규칙으로, url은 새 탭)이고 설명에 note와 호스트 또는 상대 경로를 둔다. 카드 대신 행으로 둔 것은 디자인 시스템 지침의 조밀한 자료 규칙을 따른 것이다.
