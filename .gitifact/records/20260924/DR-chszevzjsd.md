---
id: DR-chszevzjsd
title: schemaVersion 3과 0.7 전환 방식
docs:
  - I-zdpwuta64o
---

## 맥락

0.8.0은 0.7(schemaVersion 2)의 기능별 한 파일 형식을 문서별 파일과 프론트매터로 바꿨고, 기존 프로젝트는 한 번 옮겨야 한다. 변환 코드를 제품에 두지 않고, 옛 ID와 이유 문장을 그대로 이어야 했다.

## 결정

형식 번호는 schemaVersion 3이다. 0.7 프로젝트는 CLI가 변환하지 않고 에이전트가 `guide show migrate`의 절차로 옮긴다. 옛 ID와 이유 문장은 그대로 옮겨 적고, 전환 커밋에 `Gitifact-Migration: 0.8.0` 트레일러를 붙인다. 그 이전 이력은 1.0.0까지 남기는 0.7 파서로 읽는다.

## 검토한 대안

- CLI 변환 스크립트
