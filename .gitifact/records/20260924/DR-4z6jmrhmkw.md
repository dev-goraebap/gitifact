---
id: DR-4z6jmrhmkw
title: fastdom·strictdom 라이선스 전문 보관
docs:
  - I-5x5yhjlk4u
---

## 맥락

mermaid를 번들에 담으면서 mermaid가 의존하는 fastdom·strictdom도 배포물에 들어갔다. 두 패키지는 라이선스 파일 없이 README에 MIT 전문을 둔다.

## 결정

fastdom·strictdom의 MIT 전문은 README 절을 `apps/cli/licenses/`에 보관하고, notices 생성기가 그 파일을 두 패키지에 연결해 쓴다.

## 검토한 대안

- 고지 누락
