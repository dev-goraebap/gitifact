---
id: DR-rn2zc2sslc
title: AGENTS.md 블록과 CLAUDE.md 연결 파일 생성
docs:
  - D-rqtjehka7u
---

## 맥락

AGENTS.md만 두고 도입한 프로젝트에 Claude Code 사용자가 참여하자, Claude Code가 AGENTS.md를 읽지 않아 블록 없이 작업하고 커밋 형식만 흉내 내 변경 이유가 빠졌다는 보고가 있었다. 원본을 AGENTS.md 하나로 두면 블록뿐 아니라 프로젝트 고유 지침도 전달된다. Claude를 쓰지 않는 프로젝트에도 파일이 하나 생기는 것은 감수한다.

## 결정

AGENTS.md에 블록을 쓰고 CLAUDE.md와 `.claude/CLAUDE.md`가 모두 없으면 `@AGENTS.md` 한 줄의 루트 CLAUDE.md를 만든다. 사용자가 Claude 사용 여부와 무관하게 만드는 방식을 골랐다. 블록을 제거할 때 이 파일은 바뀌지 않았을 때만 지운다.

## 검토한 대안

- `--agent claude`로 블록을 한 벌 더 쓰기(내용이 중복되고 AGENTS.md의 프로젝트 지침이 전달되지 않는다)
