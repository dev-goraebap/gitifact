---
id: DR-f2qenofehr
title: 지침 본문 파일의 index.md 통일
docs:
  - D-r4umcdt4c6
---

## 맥락

지침을 에이전트 스킬이 아니라 gitifact 문서 종류로 다루기로 하면서 본문 파일 이름을 다시 정해야 했다. 기능 폴더는 이미 `index.md`를 본문으로 쓴다. 같은 모양이면 폴더와 본문 파일의 규칙이 하나다.

## 결정

지침 하나는 `.gitifact/instructions/<이름>/` 폴더이고 본문 파일은 `index.md`다. 긴 내용은 `references/` 아래 파일로 나눈다.

## 검토한 대안

- `SKILL.md`
- `README.md`
