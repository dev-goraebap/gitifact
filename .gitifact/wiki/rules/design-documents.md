---
id: W-b757hxarv2
title: 기능 설계 문서
description: 기능 설계 문서의 형식을 정하는 곳과 이 저장소에서 설계 파일을 나눈 기준
---

기능별 요구사항은 원하는 동작과 수용 조건을, 설계는 구현 구조와 처리 방식을 설명한다. 설계의 축, 프론트매터, 파일 나누기, 다이어그램, 개정 방식은 CLI 지침 `pnpm cli guide show design`을 따르고 여기에 다시 적지 않는다. 지침 원본은 `apps/cli/src/shared/i18n/<lang>/docs/design.md`다.

새 기능을 정리할 때 에이전트는 요구사항과 설계를 함께 쓴다. 단계별 승인을 강제하지 않고 중요한 불명확함만 질문한다. CLI는 빈 설계를 만들지 않으며, 사용자가 요구사항만 요청하거나 기존 기능에 설계가 없으면 그대로 둔다. tasks 문서는 다루지 않는다. CLI는 형식과 참조의 존재만 검사하고 설계 내용의 타당성은 판정하지 않는다.

## 이 저장소의 설계 파일

2026-09-22에 0.8.0 형식으로 전환하며 기능마다 `design/overview.md` 하나로 옮긴 뒤, 본문이 약 1만 자를 넘고 한 관점이 여러 절인 기능만 축 파일로 나눴다.

| 기능 | 설계 파일 |
| :--- | :--- |
| browser | overview, data, interface, ui, document(문서 표시), search(문서 검색), errors |
| agent-workflow | overview, data, interface |
| onboarding, updates | overview, interface |
| 나머지 기능 | overview |

browser의 document와 search는 권장 축에 없는 파일이다. 문서 표시와 검색은 각각 여러 절 분량이고 화면 구성(ui)과 따로 고쳐져서 나눴다. 작은 기능까지 모두 나누는 안은 두 문단짜리 파일이 많아지고 읽을 때 파일을 여러 번 옮겨 다녀야 해서 기각했다.

설계 파일을 나누거나 합칠 때는 문장만 옮기는 커밋과 내용을 고치는 커밋을 나눈다. 옮긴 뒤 옛 파일의 문장이 새 파일들에 빠짐없이 한 번씩 있는지, 옛 `requirements`와 `sources`가 남은 파일에 모두 있는지 대조한다.
