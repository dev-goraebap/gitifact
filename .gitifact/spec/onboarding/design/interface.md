---
id: D-qocsgecvk2
title: 지침 블록과 실행 방법
description: 지침 파일 후보와 블록 설치·갱신, 전역 설치 없는 npx 실행
order: 20
requirements:
  - R-b2q2g4sgsd
---

## 지침 블록 연결

후보 파일은 AGENTS.md, CLAUDE.md, .claude/CLAUDE.md, .cursorrules, .hermes.md, HERMES.md다. 옵션 없이 실행하면 존재하는 후보 전부에 블록을 쓰되 `@AGENTS.md`처럼 다른 후보만 가져오는 파일은 건너뛰고, 하나도 없으면 AGENTS.md를 보일러플레이트 헤더와 함께 만든다. `--agent claude|cursor|codex|hermes|all`은 도구별 탐색 순서에서 처음 존재하는 파일에 쓰고 없으면 마지막 후보를 만든다. `--remove-agents`는 블록을 제거하고 헤더만 남은 파일은 삭제한다. `--skip-agents`는 지침 파일을 건드리지 않는다. CLI는 실행 중인 에이전트를 감지하지 않으며 어느 파일을 쓸지는 기존 파일과 옵션으로 정한다.

설치 대상에 AGENTS.md가 들어가고(옵션 없음·`all`·`codex`·`cursor`·`hermes`) CLAUDE.md와 .claude/CLAUDE.md가 모두 없으면 루트 CLAUDE.md를 `@AGENTS.md` 한 줄로 만든다. 줄바꿈은 AGENTS.md를 따른다. 이 파일은 wrapper라 이후 init·update가 블록을 넣지 않는다. 결과의 `agentDocs.paths`에 CLAUDE.md도 담는다. `--remove-agents`는 AGENTS.md를 삭제할 때 CLAUDE.md의 내용이 공백을 제외하고 정확히 `@AGENTS.md`면 함께 삭제한다. AGENTS.md에 사용자 내용이 남거나 CLAUDE.md를 사용자가 고쳤으면 남긴다. `claude` 프리셋은 AGENTS.md를 쓰지 않으므로 wrapper도 만들지 않는다.

블록 본문은 apps/cli/src/shared/i18n/<lang>/block.md이며 commands/agent-block.ts가 `{version}`·`{language}`·`{topics}` 자리를 채우고 마커로 감싼다. 본문은 `## Gitifact Guide` 제목으로 시작하고 빈 줄 뒤에 CLI 버전·언어·저장 규약 줄(`gitifact vX · ko · 저장 규약 schemaVersion 2`)을 한 문단으로 둬 이후 stale 판정과 언어 유지에 쓴다. 파서는 이 줄을 위치가 아니라 줄 전체 일치로 찾으므로 제목 추가 전 블록도 읽는다. 언어 토큰이 없는 과거 블록도 읽고 한국어로 간주한다. 내용은 `###` 절로 나눈 시작 시 확인할 것(전역 설치 없이 블록 버전의 npx로 실행하고 권한 차단 시 필요한 승인 요청), 요구사항 분류 표, 규칙, 명령 목록이다. Markdown은 연속한 일반 줄을 한 문단으로 합치므로 모든 줄을 제목·목록·표·독립 문단으로 쓰고, 끝은 빈 줄과 `---`로 마커 바깥 내용과 구분한다(빈 줄 없이 `---`를 두면 앞 줄이 제목이 된다). 빈 줄을 포함해 50줄 이내다. 기본 실행 명령은 `npx --yes gitifact@{version} <cmd>`이며 블록을 쓴 CLI 버전으로 고정한다. 같은 버전의 프로젝트 의존성이 있으면 npm이 이를 사용하고, 없으면 npm 캐시에 설치해 실행한다. 프로젝트가 별도 실행 방법을 지정하면 우선하고 블록 안의 `gitifact`는 그 실행 방법의 약칭으로 읽는다. 실행 환경을 감지하거나 프로젝트 의존성을 자동 추가하지 않는다. 기존 파일의 줄바꿈(CRLF)을 따른다. 마커 쌍이 있으면 그 사이만 교체하고, 없으면 빈 줄 뒤에 덧붙이며, START만 있거나 START가 중복이면 AGENT_DOCS_MALFORMED로 거부한다.

상세 규칙은 apps/cli/src/shared/i18n/<lang>/docs/의 Markdown(workflow·spec·design·wiki·commit 각 형식 파일과 `.default.md` 운영 지침)이며 빌드 시 dist/i18n/<lang>/docs로 복사되고 `gitifact docs <topic>`이 그대로 출력한다. 스킬 파일과 매니페스트·복사본 검사는 두지 않는다. 지침 텍스트의 편집 원본은 한 곳이다.

## 전역 설치 없는 도입

전역 설치 승인 때문에 에이전트가 Gitifact 작업을 건너뛰는 사례에 따라 기본 안내를 npx 실행으로 바꾼다. 한국어·영어 소개, 시작하기, 블록, workflow에 같은 절차를 적용한다. Node.js 프로젝트에서는 개발 의존성으로 버전을 고정하는 선택지도 안내한다. 기존 전역 명령과 프로젝트별 실행 지침은 계속 지원한다.

npx 사용자는 새 버전의 `update`를 실행해 블록의 버전을 갱신한다. 프로젝트 설치 사용자는 기존 패키지 관리자로 버전을 갱신하고 그 설치본으로 `update`를 실행한다. init·update 응답은 `install.npx`와 `install.npmGlobal`을 제공한다. 기본 출력은 npx 명령이며 전역 설치 명령은 선택지로 유지한다. 계약은 project-init v6·update v4다. v5·v3 스키마는 0.8.0 준비에서 지웠다. `--yes`가 생략하는 것은 npm 설치 확인뿐이다. 네트워크·실행 권한이 막히면 승인 요청과 원인 안내를 하고, 명세 기록을 수동으로 대체하거나 성공으로 보고하지 않는다.

패키지 검사는 별도 임시 프로젝트에서 같은 버전의 로컬 패키지를 npx로 오프라인 실행해 초기화·조회와 생성 블록의 버전 고정을 확인한다. 실제 에이전트의 승인 요청 행동은 자연어 지침만으로 보장하지 않는다.

세션 시작에는 블록의 지정 버전으로 update --check를 한 번 실행하도록 안내한다. 새 버전이 있을 때만 동의를 묻고, 동의 후 갱신된 블록을 다시 읽는다. 확인 실패·비활성화·거절 시 지정 버전으로 계속한다. 업데이트 동의는 커밋·푸시 권한을 포함하지 않는다. 사용자용 README·시작하기 예시는 npx gitifact로 짧게 적고, --yes와 정확한 버전은 에이전트 블록에 둔다.
