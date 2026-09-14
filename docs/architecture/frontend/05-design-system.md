# 프론트엔드 디자인 시스템

Gentask의 05-design-system.md를 Tryce에 적용한다. Astryx의 설치 버전이 API 기준이며 제품별 배치 규칙은 이 문서를 따른다.

apps/browser에서 pnpm exec astryx build "화면 설명", docs layout, template <이름>, component <이름> 순으로 실제 API와 골격을 확인한다. 템플릿은 참고 코드다. raw div/span으로 레이아웃을 재구현하지 않는다. 컴포넌트 props를 우선하고 추가 스타일은 CSS Modules와 디자인 토큰을 사용한다. StyleX 컴파일러나 Tailwind는 추가하지 않는다.

reset.css → astryx.css → neutral theme.css → 앱 전역 스타일 순으로 가져온다. Theme·LayerProvider·InternationalizationProvider는 앱 진입에서 구성한다. 브랜드 색상은 테마로 정의하며 :root에서 색상 토큰을 덮어쓰지 않는다. 첫 적용은 neutral 테마를 유지한다.

고밀도 목록에는 Table 또는 List/Item을 사용하고 행마다 Card를 만들지 않는다. 상태는 Token/StatusDot, Badge는 개수에 사용한다. shared/ui는 도메인 독립 UI에 한정하고 동일 props 재수출 래퍼는 만들지 않는다.

요구사항 본문은 Markdown으로 읽어 표시하되 현재 원본은 .tryce/spec/<기능>/requirements.md이다. Astryx Markdown의 안전한 렌더링을 사용하고 원시 HTML 실행을 허용하지 않는다. 이 화면에서는 편집기·업로더를 설치하지 않는다.

아이콘 버튼에 접근 가능한 이름을 주고 한국어·긴 콘텐츠·라이트/다크·모바일·키보드에서 검증한다. 외부 폰트 네트워크 로딩은 추가하지 않는다. 본문은 시스템 폰트를 사용하며 제목의 로컬 폰트는 아래 규약대로 자산과 라이선스를 함께 관리한다.

## 글꼴·아이콘·빈 화면

제목에는 Outfit 800, 한글 제목에는 Noto Sans KR 800을 사용한다. TRYCE 워드마크는 Gentask와 같은 Unbounded 800 및 자간 -0.02em을 사용한다. Gentask의 public/fonts/unbounded-latin.woff2를 복사했으며 Google Fonts의 OFL 원문을 public/licenses/unbounded.txt에 포함한다. 본문은 기존 읽기용 시스템 글꼴을 유지한다. Fontsource 패키지의 자산을 로컬 번들에 포함하고 font-display: swap을 사용한다. OFL 원문은 public/licenses에 포함한다. 외부 CDN은 호출하지 않는다.

메뉴 아이콘은 Gentask apps/desktop/src/renderer/shared/ui/icons의 SvgIcon·HgiHistory·HgiMembers·HgiRequirement 패턴과 @hugeicons/core-free-icons 4.3.0을 사용한다. 필요한 아이콘만 하위 경로에서 가져온다. 장식 아이콘은 접근성 트리에서 숨기고 메뉴의 텍스트 이름을 유지한다.

빈 화면은 Gentask apps/desktop/src/renderer/shared/ui/page-state의 PageState·StateIllustration과 SVG 네 개를 복사했다. 일러스트는 변경하지 않았으며 현재 앱의 import와 엄격한 optional 타입만 맞췄다. 원본 프로젝트에 런타임 의존하지 않는다. 검색 없음·빈 목록·미선택 명세·찾을 수 없는 페이지에 사용한다. 초기 조회는 Astryx Skeleton으로 표현하고 reduced-motion 환경에서 애니메이션을 끈다.
