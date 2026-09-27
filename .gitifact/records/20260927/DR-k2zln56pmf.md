---
id: DR-k2zln56pmf
title: 설계 overview 7절 경고와 개정 전 기준 재대조
docs:
  - D-y2fgchwma5
  - R-hbz77tj5kc
---

## 맥락

dev-goraebap/gitifact#3: 에이전트가 가이드를 읽고도 절 7개인 `overview.md`에 글로만 된 절을 덧붙였다. 기존 문서의 모양이 가이드보다 앞섰고, 나누기 기준은 판단에 맡겨졌으며, `check`도 조용히 통과했다. 이 저장소에서는 specification·git-history·onboarding의 overview가 7절 이상이었다.

## 결정

설계 `overview.md`의 `##` 절이 7개 이상이면 `check`와 `changes list`가 `DESIGN_OVERVIEW_LARGE` 경고를 낸다. 커밋은 막지 않는다. design 가이드의 개정 절에, 덧붙이기 전에 나누기·그림·Alert 기준을 문서 전체에 다시 대조하고, 이미 기준을 넘었으면 옮기기만 하는 커밋으로 먼저 나눌지 사용자에게 묻는다고 적는다.

## 검토한 대안

- 모든 설계 파일을 글자 수로 경고(8,000자면 9개가 걸리고 interface·data가 늘 걸린다)
- 경고 없이 가이드만 고치기(놓친 것이 드러날 계기가 없다)
- 묻지 않고 먼저 나누기(사용자가 요청하지 않은 커밋이 생긴다)
