---
id: D-v6phrzooji
title: Git 기록 연결 설계
description: 커밋 시점의 이유 기록, 격리 index 커밋, 상태 보고와 복구
order: 10
requirements:
  - R-wpeh3aib32
  - R-w4xotddy7p
  - R-droz5whebf
  - R-r6sufs7aez
---

## 개요

작업 중 명세는 초안으로 편집하고, 커밋 시점의 최종 명세와 변경 이유를 Git에 연결한다. 관련 소스·테스트와 명세를 같은 커밋에 담는 것이 기본이다. 프로젝트의 분리 커밋 정책과 기존 staging은 존중한다.

## 구조와 데이터

- 기능은 `index.md`의 S-ID, 요구사항은 파일마다 R-ID, 설계는 축 파일마다 D-ID, 위키 페이지는 W-ID로 식별한다. 문서마다 파일 하나 전체를 하나의 변경 단위로 비교한다.
- 변경 이유는 `.gitifact/history.jsonl` 한 파일에 한 줄씩 `{id, docs, reason}`으로 둔다. `docs`는 대상 문서 ID(S·R·D·W)다. 원문·작성자·시각은 Git에서 읽는다. 두 브랜치가 함께 줄을 더해도 합쳐지도록 `init`이 `.gitattributes`에 `merge=union` 규칙을 더한다.
- CLI는 HEAD와 작업 폴더의 문서를 파싱해 ID로 비교한다(core `compareDocumentSets`). 경로가 바뀌면 이동, 내용이 바뀌면 변경이며, 파일 이동 후에도 ID가 같으면 동일 문서로 추적한다. 이유는 HEAD에 없고 작업 폴더에만 있는 줄이다.

## 처리 흐름

1. 에이전트는 커밋 요청을 받으면 실제 diff와 관련 테스트, 프로젝트 정책을 확인한다. `changes list`로 바뀐 문서, 아직 커밋하지 않은 이유, 이유가 없는 문서, 문서 검사 결과와 커밋 입력 파일 경로를 본다.
2. `changes commit --file`에 `{reasons?: [{docs, reason}], paths, message, authorization: {basis, evidence}}`를 전달한다. `basis`는 `user-request` 또는 `project-policy`이며, CLI는 입력된 자연어 근거의 진위를 판정하지 않는다.
3. CLI는 커밋 잠금(`gitifact-changes-commit.lock`) 아래 HEAD·문서·선택 경로를 검증한다. `docs check`와 같은 검사를 커밋될 파일에 돌리고, 이유마다 H-ID를 발급해 이유 파일 끝에 붙일 줄을 준비한다. 바뀐 문서와 이유 파일은 모두 `paths`에 있어야 한다. dry-run은 쓰지 않고 예상 결과를 반환한다.
4. 실제 실행에서는 이유 파일을 반영한 뒤 격리 index로 선택 경로만 커밋한다. 실행 전 기존 staging이 있으면 보존하고 거부한다.
5. 커밋 결과와 선택 경로를 확인한다. 바뀐 문서와 이유가 가리킨 문서를 트레일러로 연결한다. 요구사항은 `Gitifact-Req`, 설계는 `Gitifact-Design`, 기능 개요와 위키는 `Gitifact-Doc`이다. 설계만 바뀌면 요구사항 변경을 만들지 않는다. 형식 전환 커밋은 입력의 `migration: true`로 `Gitifact-Migration: 0.8.0` 트레일러를 붙인다.

이력은 캐시(`.gitifact/cache/index.db`)가 커밋 100개 단위로 `git log --raw`와 `git cat-file --batch`로 읽어 커밋별 문서 변경을 한 번만 계산해 둔다. 이유는 커밋이 이유 파일에 더한 줄을 diff로 읽는다. 문서는 ID별로 비교하며, 같은 커밋의 항목을 함께 표시하되 각 문서의 변경 관계를 구분한다. 마이그레이션 커밋 이전 커밋은 1.0.0까지 남기는 0.7 파서로 읽고, 마이그레이션 커밋 자체는 활동에 보이지 않는다. 남은 0.7 코드는 읽기뿐이다. core `formats/store.ts`의 파서와 CLI `adapters/git/store-reader.ts`·`adapters/cache/legacy-changes.ts`이며, 0.7이 쓰던 편집·커밋 준비 코드는 0.8.0에서 지웠다.

## 오류 처리와 검증

문서 검사 실패(남은 `draft: true` 포함), 존재한 적 없는 문서를 가리키는 이유, 선택하지 않은 문서 변경, 기존 staging, `.gitifact` 안의 문서·이유·설정·에셋이 아닌 파일, 실행 중 바뀐 파일·정책, 문서 원문을 바꾸는 Git 필터는 커밋 전에 거부한다. 훅이 거부하고 HEAD가 그대로라면 이번에 쓴 이유 파일을 실행 전으로 되돌린다. 실제 index는 커밋 결과를 확인한 뒤에만 바꾸므로 그대로 남는다. 다른 프로세스가 이유 파일을 바꿨거나 `git commit` 실행 뒤 HEAD가 실행 전과 달라졌다면 임의 복원하지 않고 잠금 폴더와 복구 자료(`recovery.json`)를 남긴다(`COMMIT_RECOVERY`, `COMMIT_UNCERTAIN`).

독립 저장소에서 SHA-1·SHA-256, dry-run 무변경, 이유 연결, 이유 누락 표시, 훅 거부 후 복구, CRLF checkout, 필터 거부, 마이그레이션 커밋을 검증한다(`changes-commit.test.mjs`). 현재 프로젝트를 실패 시험 대상으로 사용하지 않는다.

## 주요 설계 결정

### 이유 누락은 거부하지 않고 표시한다

이유가 없어도 커밋하고 withoutReason에 해당 변경 ID를 표시한다. 이유를 필수로 요구하면 에이전트가 알 수 없는 이유를 지어낼 수 있다. history.jsonl에는 before/after를 복제하지 않는다. 커밋 사이의 짧은 초안 수정까지 영구 이력으로 남길 필요가 없기 때문이다.

### 줄바꿈만 다른 문서는 변경으로 보지 않는다

core.autocrlf=true에서 LF 문서가 CRLF로 checkout돼도 변경으로 보지 않는다. 0.7은 Git blob ID로 비교했으나, 0.8.0 문서 형식은 파서가 CRLF를 LF로 읽으므로 문서 비교도 줄바꿈을 LF로 맞춘 내용으로 한다. 어떤 파일을 커밋할지는 Git 상태가 정한다. 필터 검사는 staging된 원문이 작업 파일과 같거나 줄바꿈만 다를 때만 허용하고 그 밖의 내용 변경은 거부한다.

### 이유 파일은 커밋 전에 반영하고 실패 시 복원한다

작업 폴더를 읽는 훅도 이유 파일을 볼 수 있어야 한다. 커밋 성공 후에만 쓰는 방식은 사용하지 않는다. 거부 후 이유 파일을 그대로 남기는 방식도 다음 커밋에 잘못 이어질 수 있어 사용하지 않는다.

## 미결 사항

- init이 새 프로젝트에 .gitattributes의 eol=lf 규칙을 제안하거나 생성할지는 정하지 않았다. 지금 init은 이유 파일의 `merge=union` 규칙만 더한다.
- CLI는 이유 파일 끝에 줄을 더하기만 하며, 커밋된 줄의 수정·삭제는 따로 검사하지 않는다(H-ID 중복만 검사).
