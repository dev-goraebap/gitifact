# 프론트엔드 코드 스타일

Gentask의 02-code-style.md를 Gitifact에 맞게 적용한다. apps/browser/src가 대상이다.

- React 컴포넌트는 한 파일에 하나를 정의하고 컴포넌트·파일은 같은 PascalCase를 사용한다. Provider·보조 컴포넌트도 분리한다. TanStack 생성 규약의 route 파일명은 예외이며 화면 컴포넌트는 분리한다.
- 페이지 컴포넌트에만 Page 접미사를 사용한다. 폴더에는 -page를 붙이지 않는다. Hook은 use로 시작하는 camelCase, 나머지 모듈은 kebab-case다.
- FSD의 페이지 우선 배치를 따른다. 단일 화면의 api/model/ui는 해당 page에 둔다. 실제 여러 화면에서 공유하는 조회·도메인 표현만 entities, 사용자 행동은 features, 공통 화면 블록은 widgets에 둔다.
- 의존성은 app → pages → widgets → features → entities → shared 방향이다. 같은 계층의 다른 슬라이스를 참조하지 않는다. 외부에서는 index.ts 공개 API를 사용한다. 슬라이스 그룹 폴더에 공유 코드나 index.ts를 만들지 않는다.
- 렌더는 순수하게 유지한다. 파생값을 state·Effect로 복제하지 않는다. Effect는 외부 구독·브라우저 API 동기화에만 사용하고 정리한다. Query 결과를 수정하지 않는다.
- useMemo·useCallback은 측정된 계산 비용이나 참조 안정성이 필요할 때 사용한다. React Compiler를 가정하지 않는다.

자동 검사는 타입·빌드·실제 화면 테스트가 담당한다. Steiger와 전용 컴포넌트 검사기는 아직 설치하지 않았으며 준수 여부는 변경 파일 리뷰로 확인한다.
