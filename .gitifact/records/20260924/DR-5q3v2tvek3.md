---
id: DR-5q3v2tvek3
title: npm 패키지 하나로 배포
docs:
  - I-zdpwuta64o
---

## 맥락

설치된 CLI가 workspace 원본이나 개발 서버 없이 동작해야 한다. `gitifact browser`가 띄우는 화면과 에이전트 지침도 설치된 CLI만으로 제공되어야 한다.

## 결정

npm 패키지 `gitifact` 하나에 CLI 번들, 브라우저 정적 빌드, 언어별 지침·패치노트를 담는다. 자동 기록은 자동 커밋·푸시·설치 권한이 아니다.

## 검토한 대안

- 패키지를 나눠 배포
