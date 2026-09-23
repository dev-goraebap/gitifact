---
id: W-risprbk4wt
title: 프론트엔드 디자인 시스템
description: Astryx 설치 버전을 기준으로 한 브라우저 디자인 시스템 배치 규칙
---

Astryx의 설치 버전이 API 기준이며 제품별 배치 규칙은 이 문서를 따른다.

## 구성

`reset.css` → `astryx.css` → stone `theme.css` → 앱 전역 스타일 순으로 가져온다. Theme·LayerProvider·InternationalizationProvider·LinkProvider는 앱 진입에서 구성한다. Astryx의 href 링크는 LinkProvider에 등록한 RouterLink가 받아 전체 새로고침 없이 라우터로 이동한다. 브랜드 색상은 테마로 정의하며 `:root`에서 색상 토큰을 덮어쓰지 않는다.

## 컴포넌트 선택

- 고밀도 목록에는 Table 또는 List/ListItem을 쓰고 행마다 Card를 만들지 않는다. Card는 독립된 항목(참여자 카드처럼)에만 쓴다. 페이지 영역 구분은 Section이다.
- 상태는 Token/StatusDot, 개수는 Badge다. 모든 행에 같은 배지를 반복하지 않는다.
- 키·값 정보는 MetadataList, 보기 전환은 SegmentedControl, 페이지 전체 동작은 헤더의 ghost IconButton이다.
- 빈 화면은 shared/ui/page-state의 PageState와 일러스트(검색 없음·빈 목록·찾을 수 없음·오류)를 쓴다. 초기 조회는 Skeleton으로 표현하고 reduced-motion 환경에서 애니메이션을 끈다.
- shared/ui는 도메인 독립 UI에 한정하고 동일 props 재수출 래퍼는 만들지 않는다.
- Astryx가 제공하지 않는 표시와 상호작용(예: 활동 상세의 줄 단위 diff 표)만 직접 구현하고 그 이유를 설계에 남긴다.

## 글꼴·아이콘·색

큰 제목(h1·h2)의 영문은 Outfit 800이고 그 한글은 Pretendard로 넘어간다. Outfit은 public/fonts에 자체 호스팅하며 index.html에서 preload하고 `font-display: optional`로 선언한다. 외부 폰트 네트워크 로딩과 CDN 호출을 추가하지 않는다. OFL 원문은 public/licenses에 둔다.

그 밖의 글자는 두 글꼴로 통일한다. 본문·작은 제목·메뉴는 영문과 한글 모두 Pretendard다(영문 자형은 Inter 기반이라 따로 영문 글꼴을 두지 않는다). 코드와 diff는 영문 JetBrains Mono, 한글 Pretendard다. 테마의 `typography`(`themes.ts`)가 body·heading을 `"Pretendard Variable"`로, code를 `"JetBrains Mono Variable", "Pretendard Variable", Consolas, monospace`로 정하고, 글자마다 JetBrains Mono에 없는 한글이 Pretendard로 넘어간다. 두 글꼴은 npm 패키지(`@fontsource-variable/jetbrains-mono`, `pretendard`)의 CSS를 global.css가 가져와 Vite가 번들한다. stone 테마가 Figtree와 JetBrains Mono를 이름만 적고 불러오지 않아, Windows에서는 본문이 Segoe UI에 한글 맑은 고딕, 코드가 Consolas에 한글 굴림체로 섞여 그려졌다(2026-09-23 측정, 사용자 요청으로 통일). Pretendard는 한 파일(2.0MB)을 쓴다. 로컬 서버라 나눠 받는 판(92개 파일, 3.1MB)의 이득이 없고 패키지가 더 커진다. Pretendard의 OFL 원문은 패키지 루트에 없어 `apps/cli/licenses/pretendard-LICENSE`로 고지에 넣는다.

스크롤은 콘텐츠 카드가 맡고, 마우스 휠은 Lenis(`shared/lib/smooth-scroll`)로 감속하며 부드럽게 움직인다. 브라우저의 `scroll-behavior: smooth`는 앵커와 scrollTo에만 먹고 휠에는 효과가 없어서다. 운영체제에서 움직임 줄이기를 켜면 쓰지 않고, 카드 안에서 따로 스크롤되는 영역(위키 트리, 목차, 넓은 표)은 네이티브 스크롤을 둔다(`allowNestedScroll`). Lenis는 요소가 커질 때 스크롤 길이를 다시 재는데, 카드 자체는 크기가 그대로이고 안의 페이지만 바뀌므로 카드의 자식들을 ResizeObserver로 지켜 다시 재게 한다. 그러지 않으면 빈 카드일 때 잰 길이가 남아 휠이 움직이지 않았다(2026-09-23 사용자 요청). 화면을 옮길 때는 라우터가 카드의 스크롤을 맨 위로 올리고(주소에 `#절`이 있으면 그 절로), 뒤로 가면 전 위치를 되살린다. 라우터 기본값은 window만 다뤄서, 카드에 `data-scroll-restoration-id="content"`를 달고 `scrollToTopSelectors`에 그 선택자를 준다. 전에는 앞 화면의 스크롤 위치가 남아 새 화면이 중간에서 시작했다.

GITIFACT 워드마크는 public/gitifact-logo.svg를 CSS 마스크에 텍스트 색상 토큰으로 칠해 라이트·다크 모두에서 쓴다. 홈 링크에 접근 가능한 이름을 둔다.

메뉴 아이콘은 shared/ui/icons의 SvgIcon과 @hugeicons/core-free-icons를 쓰며 필요한 아이콘만 하위 경로에서 가져온다. 장식 아이콘은 접근성 트리에서 숨기고 텍스트 이름을 유지한다.

색은 테마 토큰만 쓴다. 다크 테마에서 값이 어떻게 풀리는지 확인한다. stone 테마의 `--color-warning-muted`는 다크에서 밝은 단색이라 배경에는 `--color-background-yellow`를 쓴다. 빨강은 오류·제거 의미로만 쓴다.

## 검증

아이콘 버튼과 손잡이에 접근 가능한 이름을 주고 한국어·긴 콘텐츠·라이트/다크·모바일·키보드에서 확인한다. Markdown은 Astryx의 안전한 렌더링만 쓰고 원문의 HTML 실행을 허용하지 않는다. 문서 다이어그램의 SVG는 mermaid가 strict 모드로 만든 결과만 그 자리에 넣는다. 편집기·업로더를 설치하지 않는다.
