---
id: DR-5o6f4s5r2q
title: 요구사항 브라우저 요구사항의 유즈케이스 전환
docs:
  - R-tkl3lrrlpu
  - R-hsflueyc4b
  - R-xqf3xsumye
  - R-5eehizubwl
  - R-jsncmqoqjm
  - R-wgi4sahmou
  - R-wa3wnknrlt
  - R-fqlesmxflt
  - R-m7fyerzqti
  - R-aplhjskqow
  - S-jqxgddhsdf
---

## 맥락

요구사항을 유즈케이스로 바꾸는 선테스트(DR-fytbd2vu7y)의 마지막 기능이다. 활동 타임라인과 기능별 현재 명세는 수용 조건 뒤에 긴 문단이 떠 있었고, 그 문단과 수용 조건 하나에 설계(화면)에 이미 있는 표의 열·배지·링크 대상 같은 화면 세부가 섞여 있었다.

## 결정

열 요구사항을 기본 흐름과 대체 흐름으로 쓰고 수용 조건마다 경로를 단다. 떠 있던 문단은 규칙만 범위와 제약으로 올리고, 화면 세부는 설계에 맡겨 요구사항에서 뺀다. 섞인 동작은 대체 흐름과 수용 조건으로 나누고, 범위와 제약이 없던 시작하기와 GitHub 바로가기에는 수용 조건 속 규칙을 올려 절을 만든다.
