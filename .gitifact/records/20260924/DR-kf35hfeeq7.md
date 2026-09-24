---
id: DR-kf35hfeeq7
title: update --check의 별도 계약
docs:
  - D-crtw43mrkq
---

## 맥락

세션 시작 확인은 지침을 바꾸지 않아야 하므로 확인만 하는 `update --check`를 `update`에서 분리했다. 확인 결과에는 블록 갱신·커밋 결과가 없어, `update` 응답과 같은 계약을 쓰면 혼동된다.

## 결정

`update --check`는 별도 `update-check` 계약으로 답한다. 레지스트리만 조회하고 저장소·지침·Git은 읽거나 쓰지 않는다.

## 검토한 대안

- `update` 계약 재사용(블록 갱신·커밋 결과가 없어 응답을 혼동한다)
