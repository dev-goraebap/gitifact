---
id: DR-4tyfhlmvtr
title: history.jsonl 한 파일과 크기 재검토 기준
docs:
  - I-zdpwuta64o
---

## 맥락

0.7에서는 이유가 기능 폴더·위키마다 `history.jsonl`에 흩어져, 요구사항을 다른 기능으로 옮기거나 여러 폴더에 걸친 이유를 남길 때 어느 파일에 둘지가 모호했다. 이유는 GitHub squash 병합에서 메시지를 고치거나 PR 제목만 쓰는 설정에서도 남고, 일반 clone에 따라와야 했다. 얕은 clone은 어느 방식이든 이력이 없으므로 감지해 알리는 것으로 대응한다(미구현).

## 결정

이유는 `.gitifact/history.jsonl` 한 파일에 `{id, docs, reason}` 한 줄씩 두고 `changes commit`만 줄을 더한다. 두 브랜치가 줄을 더해도 둘 다 남도록 `merge=union`으로 합친다. 10MB(약 25,000줄)를 넘으면 나누기를 다시 검토한다(6,300줄 2.3MB를 13ms에 읽음).

## 검토한 대안

- 커밋 메시지 트레일러(squash·편집으로 사라지고 CLI가 막을 수 없음)
- git notes(기본으로 push·fetch되지 않고 squash에서 사라짐)
- 별도 ref(기본 clone에 없어 전용 동기화가 필요함)
- 고아 브랜치(코드 커밋과 끊김)
- Change-Id(squash에서 끊김)
- 이유마다 조각 파일(파일 수가 늘고 읽기·쓰기를 다시 만들어야 해 보류)
