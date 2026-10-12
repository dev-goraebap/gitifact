---
id: DR-othc5l4nip
title: init이 CLAUDE.md를 만들지 않음
docs:
  - R-b2q2g4sgsd
  - D-qocsgecvk2
  - D-rqtjehka7u
  - D-yrow77r5pf
  - R-cr5rajcs4a
---

## 맥락

Claude Code가 CLAUDE.md만 읽던 때에는, 블록이 AGENTS.md에만 있는 프로젝트에 init이 `@AGENTS.md` 한 줄짜리 CLAUDE.md를 만들고 update는 그 파일이 빠졌다고 알렸다. Claude Code 2.1.277(2026-09-18)부터는 CLAUDE.md가 없으면 AGENTS.md를 읽는다. CLAUDE.md가 있으면 그 파일이 우선해 AGENTS.md를 읽지 않는다.

## 결정

init은 CLAUDE.md를 새로 만들지 않고, update는 빠진 파일을 알리지 않는다(update-v6의 `agentDocs.missing`은 늘 빈 배열). 이미 있는 CLAUDE.md·.claude/CLAUDE.md에는 지금처럼 블록을 쓴다. `--remove-agents`는 0.9.0 이전 init이 만든 그대로인 wrapper를 계속 함께 지운다. 2.1.277 이전 Claude Code와 AGENTS.md 읽기가 없는 Bedrock·Vertex·Foundry 사용자는 블록을 읽지 못하는 대가를 받아들인다.

## 검토한 대안

- CLAUDE.md 지원을 모두 제거(CLAUDE.md가 있는 프로젝트에서는 Claude Code가 AGENTS.md를 읽지 않아 블록이 보이지 않는다)
- 지금 그대로 유지(새 Claude Code에서는 필요 없는 한 줄짜리 파일이 계속 생긴다)
