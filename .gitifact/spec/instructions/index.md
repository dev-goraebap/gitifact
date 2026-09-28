---
id: S-7ymbd7bqzf
title: 프로젝트 지침
description: 이 프로젝트에서 일하는 방식을 작업별 지침 문서로 두고, AGENTS.md가 언제 무엇을 읽을지 알린다
---

이 프로젝트에서 어떻게 일하는지를 담는다. 아키텍처 규칙, 여러 기능에 걸친 결정, 문체, 검증 절차처럼 사람 머릿속과 위키에 있던 지식을 `.gitifact/instructions/<이름>/`의 지침 문서로 두고, 모든 세션이 읽는 AGENTS.md가 어떤 작업 때 어느 지침을 읽을지 알린다. 에이전트는 필요한 순간에 그 지침만 읽는다. 요구사항이 무엇을 만들지, 설계가 이 기능을 어떻게 만들지를 말한다면, 지침은 이 프로젝트에서 어떻게 일하는지를 말한다.

## 유즈케이스 모델

```mermaid
flowchart LR
  member[프로젝트 참여자]
  agent[에이전트]
  subgraph instructions[프로젝트 지침]
    uc1([지침 저장])
    uc2([AGENTS.md가 알리는 지침])
    uc3([지침 변경 이력])
    uc4([브라우저 지침 열람])
    uc5([지침과 명세의 연결])
  end
  member --- uc1
  agent --- uc1
  agent --- uc2
  member --- uc3
  member --- uc4
  agent --- uc5
  member --- uc5
```
