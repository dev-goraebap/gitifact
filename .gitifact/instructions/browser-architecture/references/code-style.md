---
title: 프론트엔드 코드 스타일
description: 파일·컴포넌트·상태 작성 규칙과 FSD 계층. 브라우저 코드를 새로 만들거나 옮길 때 읽는다.
---

apps/browser/src가 대상이다.

- React 컴포넌트는 한 파일에 하나를 정의하고 컴포넌트와 파일은 같은 PascalCase를 쓴다. Provider·보조 컴포넌트도 분리한다. TanStack 생성 규약의 route 파일명은 예외이며 화면 컴포넌트는 분리한다.
- 페이지 컴포넌트에만 Page 접미사를 쓴다. 폴더에는 -page를 붙이지 않는다. Hook은 use로 시작하는 camelCase, 나머지 모듈은 kebab-case다.
- FSD의 페이지 우선 배치를 따른다. 단일 화면의 api/model/ui는 해당 page에 둔다. 여러 화면에서 실제로 공유하는 조회·도메인 표현만 entities, 사용자 행동은 features, 공통 화면 블록은 widgets에 둔다.
- 의존성은 app → pages → widgets → features → entities → shared 방향이다. 같은 계층의 다른 슬라이스를 참조하지 않는다. 외부에서는 index.ts 공개 API를 쓴다. 슬라이스 그룹 폴더에 공유 코드나 index.ts를 만들지 않는다.
- 렌더는 순수하게 유지한다. 파생값을 state·Effect로 복제하지 않는다. Effect는 외부 구독·브라우저 API 동기화에만 쓰고 정리한다. Query 결과를 수정하지 않는다.
- useMemo·useCallback은 측정된 계산 비용이나 참조 안정성이 필요할 때만 쓴다. React Compiler를 가정하지 않는다.
- 레이아웃과 간격은 Astryx 컴포넌트(VStack·HStack·Grid 등)와 토큰으로 만든다. raw div/span 레이아웃, 하드코딩한 px·hex, StyleX 컴파일러나 Tailwind를 추가하지 않는다. 컴포넌트 props로 안 되는 스타일만 CSS Modules에 토큰으로 쓴다.
- CSS Modules의 클래스 이름은 같은 파일 안에서 겹치지 않게 짓는다. 한 파일에서 같은 이름을 두 번 선언하면 뒤의 규칙이 앞을 덮어쓴다.

자동 검사는 타입·빌드·실제 화면 테스트가 담당한다. 준수 여부는 변경 파일 리뷰로 확인한다.
