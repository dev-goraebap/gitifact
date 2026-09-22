---
id: D-eu7blfbnad
title: 작업 중 임시 입력 파일
description: 에이전트 입력 파일의 위치와 정리, 읽기 한도
order: 20
requirements:
  - R-jzujq3ruxn
---

원칙은 파일 생성을 없애는 것이 아니라, 생겨도 한곳에 모이고 저절로 사라지게 하는 것이다. 새 명령을 만들지 않고 에이전트가 이미 실행하는 흐름에 싣는다.

- `changes list`의 응답에 `inputs.commit` 경로(`commit.json`)를 싣는다. 텍스트 출력에서는 입력 파일 줄이다. 에이전트는 커밋 전에 바뀐 문서와 이유가 없는 문서를 보려고 `changes list`를 실행하므로 경로를 따로 물어볼 필요가 없다. 문서를 파일로 직접 고치므로 저장 입력은 없다.
- 경로는 `apps/cli/src/adapters/filesystem/agent-inputs.ts`가 정한다. 기본은 `os.tmpdir()/gitifact/<저장소 실제 경로 SHA-256 앞 16자>`다. 폴더를 만들고 시험 파일 쓰기에 실패하면 `.gitifact/tmp/`를 쓰고, 그 안에 `*` 한 줄짜리 `.gitignore`를 만든다. 폴더가 자기 자신까지 무시하므로 Git 상태와 커밋 대상에 나타나지 않는다. 두 곳 모두 실패하면 inputs를 비우고(JSON `null`) 조회는 계속한다.
- `changes commit`의 outcome이 `committed`이면 입력 파일이 위 두 폴더 중 하나의 바로 아래 일반 파일일 때만 지우고 `inputRemoved`를 싣는다. 실패·dry-run·불확실한 커밋은 파일을 남긴다. 삭제 실패는 명령 결과를 바꾸지 않는다.
- `changes list` 실행 때 선택된 폴더에서 수정 시각이 7일 지난 파일을 지운다. 하위 폴더와 `.gitignore`는 건드리지 않는다.
- `--file -`는 표준 입력을 입력 파일과 같은 1 MiB 한도로 읽는다. 표준 입력으로 받은 커밋은 지울 파일이 없다.
- 지침 블록·workflow·commit 지침은 입력을 inputs 경로에 쓰고 조회 결과와 지침 출력을 파일로 보관하지 않도록 안내한다. 여러 줄 한국어 본문은 Windows 셸 인자에서 깨지기 쉬워 파일 생성을 0으로 만들지는 않는다.

테스트는 fixture의 TEMP·TMP·TMPDIR을 임시 저장소 안으로 돌려 실제 사용자 임시 폴더를 쓰지 않는다. 쓸 수 없는 임시 폴더는 이 변수를 일반 파일로 가리켜 흉내 내고, 기간 정리는 폴더와 시계를 주입해 시험한다.
