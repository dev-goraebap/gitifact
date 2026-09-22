---
id: D-m7r675lhb3
title: 기능 명세 관리 설계
description: 명세 형식, ID 발급, 설계와 참고 문서, 문서 검사의 구조
order: 10
requirements:
  - R-errzmn5edh
  - R-fypnjx6dju
  - R-obomewrs7e
  - R-hbz77tj5kc
  - R-vaw2ychvkd
  - R-uvehohexvw
---

## 개요

기능별 현재 요구사항과 구현 설계를 Markdown으로 관리한다. 경로 판정·파싱·렌더링·전체 검사 같은 순수 형식 규칙은 packages/core(`formats/document-file.ts`, `formats/frontmatter.ts`, `use-cases/check-documents.ts`)에, 파일 읽기·쓰기와 캐시는 CLI 어댑터에 둔다. Git 연결은 Git 기록 연결 설계에서 다룬다.

## 구조와 데이터

.gitifact/spec/<기능>/에 기능 개요 `index.md`(S-), 요구사항마다 `requirements/<slug>.md`(R-), 설계 관점마다 `design/<slug>.md`(D-)를 둔다. 설계가 하나라도 있으면 `design/overview.md`가 있어야 한다. 변경 이유는 기능 폴더가 아니라 `.gitifact/history.jsonl` 하나에 둔다. 기능 폴더에 그 밖의 파일(0.7의 requirements.md·design.md·폴더별 history.jsonl 포함)이 있으면 문서 검사가 오류로 알린다. 별도 요구사항 목록이나 docs/specs 복사본은 만들지 않는다.

모든 문서는 YAML frontmatter에 `id`·`title`·`description`을 두고, 요구사항과 설계는 같은 폴더 안의 순서 `order`를 더 둔다. 소속 기능은 폴더 위치로만 정한다. 본문은 사람과 에이전트가 읽는 산문이며 CLI가 데이터를 뽑으려고 파싱하지 않는다. 본문에는 `#` 제목과 gitifact HTML 주석을 쓰지 않는다. 요구사항 본문은 사용자 역할·목표·이유를 담은 사용자 스토리로 시작하고, 필요한 확정 제약은 범위와 제약 절에, 조건과 기대 동작은 수용 조건 절에 둔다. `gitifact guide show spec`이 작성 방식을 안내하며 CLI는 사용자 스토리의 문형이나 의미를 검사하지 않는다.

ID는 CLI가 발급하는 접두어와 소문자 base32 10자다(`generateId`). 이름·폴더와 독립적이며 이동·개명에도 유지한다. 이름 변경을 다른 요구사항 생성으로 처리하지 않는다.

## 설계 문서

설계 frontmatter의 `requirements`는 이 파일이 설명하는 요구사항의 R-ID 목록이고, `sources`는 참고 문서 목록이다. `sources` 항목은 저장소 안 문서를 가리키는 `{id, note?}` 또는 외부 자료를 가리키는 `{title, url, note?}`(http·https)이며 core `parseDocumentFile`이 검증한다. frontmatter 파서는 `key: value` 스칼라, 문자열 목록, 평평한 맵 목록만 읽는 엄격한 부분집합이며 그 밖의 줄은 거부한다. 렌더러는 키 순서를 고정하고 `quoteScalar`가 필요한 값만 큰따옴표로 감싼다. 설계 본문은 비어 있으면 안 되며, 어떤 축 파일을 두고 무엇을 쓰는지는 `gitifact guide show design`이 안내한다.

요구사항 참조는 현재 전체 문서에서 찾아 다른 기능으로 이동한 요구사항에도 연결할 수 있다. 관계는 frontmatter에만 두므로 본문의 링크나 코드 블록 예시는 참조로 해석하지 않는다. 설계는 파일 하나 전체가 비교 단위이며 별도 문단 ID는 없다. tasks.md는 지원하지 않는다.

## 작성 흐름

1. `docs list`로 frontmatter 목록을 읽고 `docs show <ID…>`로 필요한 원문을 읽는다.
2. `docs new <종류> <경로> --title … --description …`으로 새 문서를 만든다. CLI는 ID를 발급하고 frontmatter와 종류별 본문 뼈대를 쓰며, `order`는 같은 폴더의 최댓값+10으로 매기고 `draft: true`를 붙인다. 같은 경로에 파일이 있으면 거부하고 링크를 거쳐 폴더를 만들지 않는다.
3. 에이전트가 파일을 직접 고치고 `draft: true` 줄을 지운 뒤 `docs check`로 확인한다.
4. 문서 작성은 커밋이나 완료 선언을 만들지 않는다. 커밋은 `changes commit`이 맡는다.

설계의 `requirements`에는 `docs new`가 발급한 실제 R-ID만 적고 아직 없는 ID를 지어내지 않는다. 요구사항 이동·삭제와 기능 폴더 개명은 파일을 직접 옮기거나 지워서 한다. ID가 파일 안에 있어 옮긴 뒤에도 같은 문서로 추적한다. 0.7의 `spec save`가 하던 stamp 대조(읽은 뒤 바뀐 파일의 저장 거부)는 없어졌고, 문서 파일은 일반 코드 파일과 같은 수준으로 보호된다.

## 오류 처리와 검증

`docs check`는 작업 폴더 전체를 읽어 첫 오류에서 멈추지 않고 모든 문제를 보이며, 문제가 있으면 종료 코드 1로 끝난다. 규칙 밖 경로, frontmatter 형식·모르는 키·필수 키 누락, ID 형식, 본문 `#` 제목·gitifact 주석, 잘못된 문자(NUL·단독 CR·BOM), 1MB 초과·링크 파일, ID·이유 ID·order 중복, 없는 문서를 가리키는 `requirements`·`sources`, `index.md`·`overview.md` 누락, 남은 `draft: true`를 문제로 보고한다. `changes commit`은 커밋 직전에 같은 검사를 돌려 문제가 있으면 커밋하지 않는다. `docs list`는 읽지 못한 파일 수를 함께 알려 손상을 빈 정상 결과로 보이지 않는다. 설정의 `schemaVersion`이 2면 옛 형식으로 보고 마이그레이션 지침(`guide show migrate`)을 안내하며 거부한다.

형식 고정 자료와 독립 저장소로 파싱·렌더링·검사와 명령 동작을 시험한다(core `documents.test.mjs`, CLI `docs-commands.test.mjs`). 명세 구조가 유효하다는 결과를 제품 의미나 코드 구현의 검증으로 해석하지 않는다.

## 주요 설계 결정

기능 응집은 사용자의 제품 맥락으로 정하고 코드 모듈 구조를 강제하지 않는다. 설계는 기본 작성 대상으로 안내하되 빈 파일 생성을 강제하지 않는다. 현재 문서만 저장하고 과거 원문은 Git에서 읽어 중복 스냅샷을 줄인다.

## frontmatter와 파일 나누기

2026-09-18에 파일 단위 메타(ID, 참고 문서)는 frontmatter에, 절 단위 표시(`gitifact-req`, `gitifact-ref`)는 본문 주석에 두기로 했다. "frontmatter를 쓰지 않는다"는 이전 결정을 뒤집은 것으로, 참고 문서 목록처럼 구조가 있는 메타를 주석 한 줄에 담기 어렵고 GitHub가 frontmatter를 표로 보여 주기 때문이다. 이때 요구사항 하나를 파일 하나로 쪼개는 안(Doorstop 방식)은 기능 단위 읽기를 깬다는 이유로 기각했다.

0.8.0(schemaVersion 3)은 이 기각을 뒤집어 요구사항·설계를 파일 하나씩으로 나누고 모든 구조 정보를 frontmatter로 옮겼다. 본문 주석은 금지한다. 기능 단위 읽기는 `docs list --feature`와 브라우저 기능 상세가 맡고, 서로 다른 요구사항의 수정은 파일 단위로 충돌 없이 합쳐진다. 제목과 ID의 짝을 따로 유지할 필요도 없어졌다. 대가로 설계와 요구사항의 연결은 절 단위에서 파일 단위(`requirements` 목록)로 넓어졌다.
