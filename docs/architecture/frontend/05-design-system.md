# 프론트엔드 디자인 시스템

Gentask의 05-design-system.md를 Tryce에 적용한다. Astryx의 설치 버전이 API 기준이며 제품별 배치 규칙은 이 문서를 따른다.

apps/browser에서 pnpm exec astryx build "화면 설명", docs layout, template <이름>, component <이름> 순으로 실제 API와 골격을 확인한다. 템플릿은 참고 코드다. raw div/span으로 레이아웃을 재구현하지 않는다. 컴포넌트 props를 우선하고 추가 스타일은 CSS Modules와 디자인 토큰을 사용한다. StyleX 컴파일러나 Tailwind는 추가하지 않는다.

reset.css → astryx.css → neutral theme.css → 앱 전역 스타일 순으로 가져온다. Theme·LayerProvider·InternationalizationProvider는 앱 진입에서 구성한다. 브랜드 색상은 테마로 정의하며 :root에서 색상 토큰을 덮어쓰지 않는다. 첫 적용은 neutral 테마를 유지한다.

고밀도 목록에는 Table 또는 List/Item을 사용하고 행마다 Card를 만들지 않는다. 상태는 Token/StatusDot, Badge는 개수에 사용한다. shared/ui는 도메인 독립 UI에 한정하고 동일 props 재수출 래퍼는 만들지 않는다.

요구사항 본문은 Markdown으로 읽어 표시하되 현재 원본은 .tryce/spec/<영역>/tryce.json이다. Astryx Markdown의 안전한 렌더링을 사용하고 원시 HTML 실행을 허용하지 않는다. 이 화면에서는 편집기·업로더를 설치하지 않는다.

아이콘 버튼에 접근 가능한 이름을 주고 한국어·긴 콘텐츠·라이트/다크·모바일·키보드에서 검증한다. 외부 폰트 네트워크 로딩은 추가하지 않고 시스템 폰트를 사용한다. 새 폰트는 자산과 라이선스를 함께 관리해야 한다.
