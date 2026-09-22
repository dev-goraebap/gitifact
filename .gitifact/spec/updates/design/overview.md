---
id: D-crtw43mrkq
title: 버전 확인과 패치노트 설계
description: 레지스트리 조회, update 명령의 블록 갱신과 커밋, 패치노트 원본과 화면
order: 10
requirements:
  - R-cj525dk5vt
  - R-cr5rajcs4a
  - R-hlndpxflx7
  - R-yrk7zcukqy
sources:
  - id: W-dmcvdbs53b
  - id: W-hwwbtzdipa
  - id: W-5t5ypod2ty
  - id: W-3lihunsfpn
---

## 개요

에이전트가 새 세션에서 지정 버전으로 새 릴리스를 확인하고 사용자 동의 후 지침을 갱신한다. 브라우저는 현재 버전과 패치노트만 제공한다. 설치나 커밋은 자동으로 실행하지 않는다.

## 구조와 데이터

- `apps/cli/src/adapters/registry/latest-version.ts`: CLI의 유일한 외부 요청. `https://registry.npmjs.org/gitifact`의 축약 매니페스트(`application/vnd.npm.install-v1+json`)에서 `dist-tags.latest`를 읽는다. 프로젝트 정보는 보내지 않는다.
- `apps/cli/src/shared/update-check.ts`: `isNewerRelease`(x.y.z 비교, 같은 숫자의 사전 릴리스 빌드는 정식 릴리스보다 낮음), `resolveUpdate`(제한 시간 3초, 거부하지 않고 항상 상태를 반환), `updateCheckDisabled`(`GITIFACT_NO_UPDATE_CHECK`), 버전을 지정한 npx 업데이트 명령과 선택적인 npm 전역 설치 명령 문자열.
- 확인 결과는 `available`·`up-to-date`·`unavailable`·`disabled`다. 과거 계약에 남아 있는 `checking`은 새 확인 응답에서 허용하지 않는다. `latestVersion`은 조회가 결과를 낸 `available`·`up-to-date`에서만 값이 있다. 레지스트리의 값이 x.y.z 형식이 아니면 `unavailable`로 처리한다.
- 계약: `browser-session` version 3은 `update` 필드를 제거하고 `cliVersion`을 유지한다. 이전 v2 스키마는 변경하지 않는다. `update-check` version 1은 읽기 전용 확인 결과(cliVersion·update·새 버전일 때만 command)를 담는다. `update` version 4와 `project-init` version 6은 `install.npx`를 추가한다. strict 계약이므로 버전을 올리고, 기존 update v3와 project-init v5 스키마는 변경하지 않고 유지한다. `changelog` version 1은 패치노트 응답이다.
- `apps/cli/src/adapters/git/agent-docs-commit.ts`: `update --commit`의 Git 접근. HEAD의 파일 내용 조회, `git commit --only`, 커밋의 부모·변경 파일 조회만 한다.
- 현재 버전은 빌드 시 주입되는 CLI 버전(`gitifact --version`과 같은 값)이다. 에이전트가 블록에 고정된 npx 명령을 실행하므로 조회 기준도 프로젝트의 지정 버전이 된다. CLI는 AGENTS.md를 읽어 실행 버전을 바꾸지 않는다.

## 처리 흐름

### 세션 시작과 업데이트

블록과 workflow는 새 세션에서 한 번 지정 버전으로 update --check를 실행하도록 안내한다. commands/update-check.ts는 레지스트리만 조회하며 저장소·지침·Git 어댑터를 호출하지 않는다. --format text도 지원하고 --commit과의 조합은 Commander에서 거부한다. 새 버전이 있으면 응답에 검증된 정식 버전의 npx 업데이트 명령을 담는다.

에이전트는 현재·새 버전을 알리고 동의를 기다린다. 동의 후에는 프로젝트 실행 방식으로 새 CLI의 update를 실행하고 블록을 다시 읽는다. npx는 새 버전을 직접 지정하고, 프로젝트 의존성은 기존 패키지 관리자로 갱신한다. 거절·확인 불가·비활성화 시 기존 버전을 유지하며 같은 세션에서 다시 묻지 않는다. 커밋·푸시는 별도 권한을 따른다. 갱신된 블록을 공유하면 팀원도 pull 이후 새 세션에서 같은 버전을 사용한다.

### 브라우저 서버

서버는 레지스트리 조회·상태·종료 시 대기를 갖지 않는다. 세션 v3은 고정된 세션 식별자와 현재 CLI 버전을 제공한다. 브라우저의 반복 조회와 업데이트 대화상자를 제거하고, 사이드 메뉴 하단의 현재 버전 링크와 패치노트를 유지한다. 불필요해진 browser --no-update-check 옵션도 제거한다.

### 패치노트

원본은 `apps/cli/src/shared/i18n/<lang>/changelog.md`이며 빌드가 `dist/i18n/<lang>/`으로 복사한다. `/api/v1/changelog?lang=<언어>`는 세션 헤더를 요구하고, 언어 코드는 `^[a-z]{2}(-[A-Z]{2})?$`만 받아 경로 조작을 막는다. 요청한 언어의 파일이 없으면 기본 언어를 읽고 `fallback: true`로 알린다. core의 `parseChangelog`가 절 제목(영어 토큰 Added·Changed·Removed·Fixed)과 날짜 형식을 검증하며 형식 오류는 503으로 답한다. 브라우저의 `/changelog` 페이지는 버전마다 제목·날짜와 절별 항목을 세로 타임라인으로 그리고, 실행 중인 버전에 표시를 붙인다. 절 이름의 화면 표기는 브라우저의 메시지 표가 맡는다. 항목은 Markdown으로 렌더링한다.

### update 명령

`gitifact update`는 레지스트리 확인과 지침 블록 갱신을 함께 수행하고 `update` 계약으로 출력한다(`--format text` 지원). 새 버전이 있으면 `install.npx`에 버전을 고정한 npx 업데이트 명령을 담고 텍스트 출력도 이 명령을 안내한다. `install.npmGlobal`은 전역 설치 사용자를 위한 선택지로 유지한다. 프로젝트 의존성 사용자는 해당 패키지 관리자로 의존성을 먼저 갱신한다. 안내 명령을 CLI가 직접 실행하지 않으며 조회가 꺼졌거나 실패하면 install은 null이다. 블록 갱신은 `planAgentDocs`의 `onlyExisting`으로 이미 블록이 있는 파일만 대상으로 하며 파일을 만들지 않는다. Git 저장소가 아니거나 설정이 없으면 `not-initialized`, 블록이 있는 파일이 없으면 `no-block`, 모두 현재 버전이면 `current`, 바꿨으면 `refreshed`다. 블록이 AGENTS.md에 있고 CLAUDE.md와 .claude/CLAUDE.md가 없으면 `agentDocs.missing`에 CLAUDE.md를 담고 텍스트 출력은 init 재실행을 안내한다. 이미 도입한 프로젝트가 wrapper를 얻는 경로는 init 재실행 하나이며 update는 만들지 않는다. 쓰기 전 HEAD·index·설정이 그대로인지 다시 확인한다. `init`은 도입, `update`는 유지 역할이다.

`--commit`은 블록 갱신 뒤에 실행한다. 대상은 블록을 가진 지침 파일(`planAgentDocs`의 paths)이며, wrapper에서 블록을 걷어낸 변경은 블록 안 변경이 아니므로 넣지 않는다. 파일마다 HEAD 내용과 작업 트리 내용을 CRLF를 LF로 맞춰 비교한다. 같으면 건너뛰고, HEAD에 없으면 `untracked`, 두 내용에서 마커 구간을 같은 자리표시로 바꾼 나머지가 다르면 `other-changes`로 전체를 멈춘다. 블록은 이미 현재 버전이므로 남은 차이는 갱신뿐이다. 이전에 옵션 없이 갱신만 해 둔 파일도 같은 판정으로 커밋된다. 대상이 모두 통과하면 `git commit --only -m "chore(gitifact): refresh GITIFACT block to v<버전>" -- <파일>`을 실행한다. `--only`는 지정 파일의 작업 트리 내용만 커밋하고 다른 staging을 index에 남긴다. 훅·서명 설정은 끄지 않는다. 실행 뒤 HEAD가 그대로면 `commit-failed`(감지한 오류 메시지를 `detail`에)로 알리고, 바뀌었으면 부모가 이전 HEAD 하나인지 확인한 뒤 커밋 해시와 실제 변경 파일을 싣는다. 부모가 다르면 `COMMIT_RESULT_UNKNOWN`으로 실패시키고 되돌리지 않는다. 출력의 `commit.state`는 `not-requested`·`nothing`·`committed`·`skipped`다.

## 오류 처리와 검증

오프라인·시간 초과·중단·잘못된 응답은 모두 `unavailable`이며 update와 update --check를 실패시키지 않는다. 깨진 마커가 있는 지침 파일은 `update`도 `AGENT_DOCS_MALFORMED`로 거부하고 아무것도 쓰지 않는다. --check는 깨진 블록도 읽지 않으므로 버전 확인을 계속할 수 있다.

테스트는 네트워크를 쓰지 않는다. 조회 함수와 패치노트·블록 읽기를 주입해 새 버전·최신·오류·형식 오류·시간 초과·비활성화를 확인한다. 임시 프로젝트의 오래된 블록·깨진 블록·staging·HEAD가 --check 실행 전후 같음을 비교하고 저장소 밖 실행과 --commit 충돌을 검사한다. 브라우저는 레지스트리 요청·반복 조회·업데이트 UI가 없고 버전 링크·패치노트가 유지되는지 확인한다. 기존 update의 블록 갱신·커밋·거부·사용자 변경 보존 검사도 유지한다. 패키지 검사는 설치본의 --check가 파일을 보존하고 update가 블록을 복원하는지, 세션이 v3이고 패치노트 첫 항목이 패키지 버전인지 확인한다.

## 주요 설계 결정

- **세션 시작에서 확인한다.** 브라우저 알림과 서버 조회를 없애고 에이전트 지침으로 안내를 모은다. 세션당 한 번이라는 규칙과 사용자에게 묻는 절차는 에이전트가 따르며 CLI는 조회의 읽기 전용 동작을 보장한다.
- **자동 설치를 하지 않는다.** 사용자 동의 전에는 버전을 바꾸지 않는다. 프로젝트가 지정한 실행 방식을 유지하고 CLI는 새 버전의 실행 명령만 제공한다.
- **커밋은 옵션으로.** 기본 커밋(`--no-commit`으로 끔)은 "자동 기록은 자동 커밋 권한이 아니다"는 제품 원칙에 예외를 만들고 사람이 직접 실행해도 커밋이 생겨 기각했다. 에이전트 지침만 추가하는 방식은 메시지와 범위가 에이전트마다 달라지고 테스트로 보장할 수 없어 기각했다. 옵션을 명시한 실행에서만 커밋한다. 에이전트 지침은 커밋까지 요청받은 경우에만 이 옵션을 쓰도록 한다.
- **블록 밖 변경이 있으면 커밋하지 않는다.** 블록 구간만 골라 부분 staging하면 사용자의 작업 중 수정과 섞일 위험이 있어, 파일 전체가 블록 안에서만 다를 때만 커밋한다.
- **빠진 CLAUDE.md는 안내만 한다.** update가 만들면 `--commit`의 "블록 안만 바뀐 파일" 규칙에 새 파일을 커밋할지 따로 정해야 하고 유지 명령이 도입 동작을 겸하게 된다. 아무 안내 없이 init 재실행에만 맡기는 방식은 이미 도입한 프로젝트가 모르고 지나칠 수 있어 기각했다. update 계약은 이 필드로 v3가 됐고 CLI 밖 소비자가 없는 v2는 제거했다.
- **디스크 캐시 없음.** 에이전트는 세션 시작에 한 번 확인하며 CLI는 조회 결과를 저장하지 않는다. 하루 한 번 같은 제한이 필요해지면 프로젝트 밖에 파일을 쓰는 첫 사례가 되므로 별도로 결정한다.
- **버전이 있는 계약.** 세션 필드 제거는 v3으로 구분한다. --check는 블록 갱신·커밋 결과가 없는 별도 update-check v1 계약을 사용해 기존 update 응답과 혼동하지 않는다.

## 미결 사항

`update --apply`(자기 교체 설치)와 조회 결과 캐시는 제공하지 않는다.
