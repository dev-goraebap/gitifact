---
id: DR-ggxpnoalow
title: Lenis 휠 감속
docs:
  - I-5x5yhjlk4u
---

## 맥락

사용자가 마우스 휠 스크롤이 딱딱하지 않고 스르륵 움직이기를 원했다. 브라우저의 `scroll-behavior: smooth`는 앵커와 scrollTo에만 먹고 휠에는 효과가 없다.

## 결정

콘텐츠 카드의 휠 감속은 Lenis(MIT, 36KB)로 한다. 움직임 줄이기를 켠 사용자에게는 끄고, 카드 안에서 따로 스크롤되는 영역은 네이티브로 둔다.

## 검토한 대안

- `scroll-behavior: smooth`(휠에는 효과가 없음)
