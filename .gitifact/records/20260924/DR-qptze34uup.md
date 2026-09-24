---
id: DR-qptze34uup
title: guide show의 CLI 내장 파일 한정 출력
docs:
  - D-tofdg5dot6
---

## 맥락

위키와 명세를 어떻게 운영할지는 프로젝트마다 달라, 한때 모든 topic을 `.gitifact/overrides/`로 재정의하게 했다. 실제로 프로젝트마다 달라져야 하는 것은 위키 운영 방식뿐이어서 사용자 결정으로 재정의와 `--eject`를 없애고, 위키 README만 `guide show wiki` 뒤에 실었다. 위키가 프로젝트 지침으로 바뀐 뒤에는 프로젝트마다 다른 일하는 방식을 프로젝트 지침과 AGENTS.md 색인이 담는다. CLI 출력에 프로젝트 파일을 섞으면 같은 명령이 프로젝트마다 다른 형식을 말한다.

## 결정

`guide show`는 CLI가 담은 파일만 출력하고 프로젝트 파일로 바뀌는 topic을 두지 않는다. wiki topic과 기본 위키 방침(`wiki.default.md`) 대신 instructions topic을 둔다.

## 검토한 대안

- 위키 README를 `guide show wiki` 뒤에 운영 방침으로 싣기(지침이 위키를 대신하며 없앴다)
- 모든 topic을 `.gitifact/overrides/<topic>.md`로 대체(`--eject`)(프로젝트마다 달라져야 하는 것은 위키 운영 방식뿐이었다)
