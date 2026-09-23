---
id: R-uywsfp34va
title: 위키 운영 방침의 프로젝트별 조정
description: 위키를 무엇으로 어떻게 채울지 프로젝트가 위키 README로 정한다
order: 60
---

자기 방식으로 위키를 운영하려는 사용자로서, gitifact의 저장 형식은 그대로 두면서 위키를 무엇으로 어떻게 채울지는 우리 팀 기준으로 정하기 위해 위키 운영 방침을 프로젝트 안에서 고치고 싶다.

### 범위와 제약

위키 운영 방침은 `.gitifact/wiki/README.md`다. `gitifact guide show wiki`는 CLI가 정한 형식 뒤에 README 본문을 운영 방침으로 싣고, README가 없거나 비어 있으면 내장 기본 방침을 싣는다. `init`은 처음 도입할 때 기본 방침으로 README를 만들며 다시 만들지 않는다. 기본 방침은 아키텍처 결정 기록(ADR)을 쌓는 것이다. workflow·spec·design·writing·commit은 CLI 내장 지침만 쓰고 프로젝트가 대체하지 않는다. 형식과 `docs check`의 검사는 README와 무관하다.

### 수용 조건

1. 조건: 새 프로젝트에 `init`을 실행합니다.
   기대 동작: `.gitifact/wiki/README.md`가 기본 방침으로 만들어지고 `guide show wiki`가 그 본문을 운영 방침으로 싣습니다.
2. 조건: 사용자가 README를 고친 뒤 `guide show wiki`를 실행합니다.
   기대 동작: 형식 뒤에 고친 방침이 그대로 실립니다. 에이전트는 그 방침에 따라 위키를 다룹니다.
3. 조건: 사용자가 README를 지우고 `init`을 다시 실행합니다.
   기대 동작: README를 되살리지 않고, `guide show wiki`는 내장 기본 방침을 기본값이라고 밝혀 싣습니다.
