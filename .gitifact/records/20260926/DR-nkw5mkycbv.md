---
id: DR-nkw5mkycbv
title: config.json의 cli 기준 버전과 0.8.2 이하 호환 끊김
docs:
  - R-cr5rajcs4a
  - D-yrow77r5pf
  - D-rqtjehka7u
  - I-zdpwuta64o
---

## 맥락

프로젝트가 기준으로 삼는 CLI 버전이 AGENTS.md 블록 첫 줄에 있어, 배포할 때마다 블록이 바뀌고 블록만 따로 커밋해야 했다. 명령마다 프로젝트 버전과 실행 중인 버전을 비교하려면 CLI가 읽기 쉬운 곳에 버전이 있어야 한다. 0.8.2 이하의 설정 파서는 `schemaVersion`·`baseline` 밖의 필드를 `INVALID_CONFIG`로 거부한다.

## 결정

`.gitifact/config.json`에 `cli`를 두고 `init`·`update`가 실행 중인 버전으로 쓴다(사용자 결정). 더 새 버전을 기준으로 삼은 프로젝트에서는 `cli`와 블록을 낮추지 않고, 명령은 막지 않고 안내만 한다. 0.8.3에서 호환을 한 번 끊어 0.8.2 이하는 이 설정에서 멈추며, 0.8.3부터는 모르는 필드를 허용하고 다시 쓸 때 남겨 이후에는 끊기지 않게 한다. `update --commit`은 `cli`·`language`만 바뀐 설정도 함께 커밋한다.

## 검토한 대안

- 별도 파일 `.gitifact/version.json`(관리할 파일이 늘어난다)
- 두 단계 배포, 0.8.3은 읽기만 하고 쓰기는 0.8.4부터(끊김을 한 번 미룰 뿐 배포가 둘로 늘어난다)
- 기준보다 낮은 CLI의 쓰기 명령 막기(작업이 멈추고, 안내로 충분하다)
