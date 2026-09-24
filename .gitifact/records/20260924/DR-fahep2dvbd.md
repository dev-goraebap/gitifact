---
id: DR-fahep2dvbd
title: 변경 이유를 결정기록으로 전환
docs:
  - D-37iokwacmm
  - R-hqekjinjpa
  - R-ecmf4ddygu
  - D-3nu5nrwhee
  - D-4kgfn4hrs6
  - D-jxe47zy5fq
  - D-kcgh3edw6q
  - D-vozyvnajhy
  - I-2kycwrstxe
  - R-fqlesmxflt
  - R-hbz77tj5kc
  - R-hsflueyc4b
  - R-l2cviw6kk7
  - R-r6sufs7aez
  - R-rtualqkge6
  - R-tkl3lrrlpu
  - R-wkp2oca6xx
  - R-wpeh3aib32
  - S-7ymbd7bqzf
  - S-zyro4g3e5f
---

## 맥락

변경 이유는 `.gitifact/history.jsonl`의 `{id, docs, reason}` 한 칸에 몰아 썼다. 이유 192개가 37개 커밋에 쌓였는데, 한 칸에 문제·고른 안·기각한 안이 섞여 활동 화면에서 읽기 어려웠다. 기각한 안 같은 결정은 문서마다 결정 표가 따로 가져 제품의 기록과 두 곳으로 갈라졌다(사용자 결정).

## 결정

변경 이유를 한 칸 대신 제목과 섹션(맥락·결정·검토한 대안)으로 나뉜 결정기록으로 남긴다. 요구사항 변경, 설계·지침 변경, 아키텍처 결정을 모두 이 한 구조로 받는다. `history.jsonl`은 없애고 커밋 입력의 `reasons` 필드도 지운다. 이 결정에 딸려 바뀐 명세·지침은 이 기록의 `docs`에 함께 둔다.

## 검토한 대안

- 이유 칸을 그대로 두고 화면만 다듬기(한 칸에 섞인 맥락·결정·기각안을 나눌 수 없다)
