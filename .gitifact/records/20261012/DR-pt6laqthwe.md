---
id: DR-pt6laqthwe
title: 커밋 메시지 트레일러 줄만 거부
docs:
  - R-w4xotddy7p
  - D-v6phrzooji
---

## 맥락

`changes commit`은 메시지의 어느 줄이든 대소문자 무시로 `Gitifact-`로 시작하면 거부했다. 본문 줄이 `gitifact-playbook 스킬을 ...`으로 시작하는 커밋이 실제로 거부됐다. 막으려던 것은 사용자가 CLI가 붙이는 트레일러를 직접 쓰는 것뿐이다.

## 결정

`Gitifact-<토큰>:` 형식의 줄(앞뒤 공백·탭 허용)만 거부한다. Git 트레일러 키는 대소문자를 가리지 않으므로 `gitifact-req: X`도 거부한다. 콜론이 없는 일반 문장은 통과한다.
