---
id: DR-scq77evl5l
title: 이전 규약 설정의 자동 교체 배제
docs:
  - D-rqtjehka7u
---

## 맥락

한때 init은 다른 기록 없이 설정만 남은 schemaVersion 1 설정을 새 설정으로 교체했다. 0.8.0에서 옛 형식 지원을 모두 지우기로 했고, 0.8.0 CLI는 옛 형식을 읽지 않는다. 정식 버전 전 규약은 CLI가 전환하지 않는다.

## 결정

이전 규약 설정은 읽거나 교체하지 않고 이유를 밝히며 거부한다. 0.7 형식(schemaVersion 2) 프로젝트는 에이전트가 `guide show migrate`의 절차로 옮기도록 안내한다. 더 새로운 규약이면 CLI를 올리라고 안내한다.

## 검토한 대안

- init이 schemaVersion 1 설정을 새 설정으로 교체(결과 `replaced`)
