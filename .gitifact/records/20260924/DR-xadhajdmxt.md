---
id: DR-xadhajdmxt
title: 이유 파일 하나와 merge=union 병합
docs:
  - D-m7r675lhb3
---

## 맥락

0.7까지 이유는 기능 폴더·위키마다 `history.jsonl`에 흩어져 있었다. 요구사항을 다른 기능으로 옮기거나 여러 폴더에 걸친 이유를 남길 때 어느 파일에 둘지가 모호했다. 두 브랜치가 각자 이유 줄을 더해도 병합에서 둘 다 남아야 한다.

## 결정

이유는 `.gitifact/history.jsonl` 한 파일에 한 줄씩 두고 `merge=union`으로 병합한다. `init`이 `.gitattributes`에 이 규칙을 더한다. 파일이 10MB(약 25,000줄)를 넘으면 나누기를 다시 검토한다.

## 검토한 대안

- 기능 폴더·위키마다 `history.jsonl`(옮기거나 여러 폴더에 걸친 이유를 둘 곳이 모호하다)
