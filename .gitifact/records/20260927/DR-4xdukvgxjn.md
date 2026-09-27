---
id: DR-4xdukvgxjn
title: 요구사항 형식 경고의 바뀐 요구사항 한정
docs:
  - R-obomewrs7e
  - D-y2fgchwma5
---

## 맥락

dev-goraebap/gitifact#4는 수용 조건과 범위와 제약의 형식 밖 문단을 `check`가 경고하자고 했다. 새 형식으로 세면 이 저장소 요구사항 51개 중 44개가 걸린다. spec 가이드는 이번 작업과 무관한 요구사항을 일괄 개정하지 않는다고 정한다.

## 결정

`REQUIREMENT_SCOPE_FORMAT`·`REQUIREMENT_CRITERIA_FORMAT` 경고는 `changes list`와 `changes commit`이 이번에 바뀐 요구사항에만 내고 줄마다 보인다. `check`는 내지 않는다. 커밋은 막지 않으며, 기존 요구사항은 고칠 때 하나씩 새 형식으로 맞춘다. `specs new requirement`의 뼈대는 처음부터 이 형식이다.

## 검토한 대안

- `check`에서 모든 요구사항 경고(44개가 늘 떠 있어 경고를 무시하게 된다)
- 경고 없이 가이드와 뼈대만(형식이 섞여도 알아챌 계기가 없다)
