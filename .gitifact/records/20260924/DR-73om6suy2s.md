---
id: DR-73om6suy2s
title: 문서 안 결정 표 폐지
docs:
  - D-37iokwacmm
  - R-3ngq5qsdl6
  - D-5u7ezf3zgt
  - D-crtw43mrkq
  - D-fvrbgkkonk
  - D-m7r675lhb3
  - D-r4umcdt4c6
  - D-rqtjehka7u
  - D-tofdg5dot6
  - D-v6phrzooji
  - D-vmhb7xlhjb
  - I-5x5yhjlk4u
  - I-zdpwuta64o
---

## 맥락

설계는 `## 결정` 표를, 지침은 `references/decisions.md`를 따로 가져 결정의 이유와 기각한 안이 문서마다 흩어져 있었다. 문서가 스스로 결정 기록을 만들면 제품이 남기는 기록과 어긋나고 어느 쪽이 맞는지 알 수 없다(사용자 결정). 표를 지우기만 하면 에이전트가 `docs history`로 기각한 안을 볼 수 없어 같은 안을 다시 제안하게 된다.

## 결정

설계의 결정 표와 지침의 `references/decisions.md`를 없애고, 표 한 줄을 결정기록 하나로 옮긴다(99개, 이유 열은 맥락으로, 기각한 안 열은 검토한 대안으로). 설계와 지침 본문에는 지금 지킬 규칙만 둔다. 에이전트는 설계나 지침을 고치기 전에 `docs history`로 그 문서의 결정 흐름을 읽는다.

## 검토한 대안

- 본문에 기각한 안을 한 줄씩 남기기(이름만 바꾼 결정 표)
- 표를 지우고 Git 이력에만 맡기기(기각한 안이 `docs history`에 보이지 않는다)
