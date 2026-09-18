<!-- gitifact-design: S-b7f4g2gpw6 -->

# 버전 확인과 패치노트 설계

## 개요

실행 중인 CLI보다 새로운 릴리스가 있는지 확인하고, 그 결과와 현재 버전, 버전별 변경 내역을 브라우저와 명령줄에 제공한다. 설치는 어느 경로에서도 자동으로 실행하지 않는다. 브라우저의 네 기능(새 버전 안내, 버전 표시, 패치노트)과 `gitifact update`가 같은 조회·비교 코드를 쓴다.

## 구조와 데이터
<!-- gitifact-ref: R-cj525dk5vt, R-cr5rajcs4a -->

- `apps/cli/src/adapters/registry/latest-version.ts`: CLI의 유일한 외부 요청. `https://registry.npmjs.org/gitifact`의 축약 매니페스트(`application/vnd.npm.install-v1+json`)에서 `dist-tags.latest`를 읽는다. 프로젝트 정보는 보내지 않는다.
- `apps/cli/src/shared/update-check.ts`: `isNewerRelease`(x.y.z 비교, 같은 숫자의 사전 릴리스 빌드는 정식 릴리스보다 낮음), `resolveUpdate`(제한 시간 3초, 거부하지 않고 항상 상태를 반환), `updateCheckDisabled`(`--no-update-check` 또는 `GITIFACT_NO_UPDATE_CHECK`), npm 전역 설치 명령 문자열.
- 상태는 `checking`·`available`·`up-to-date`·`unavailable`·`disabled` 다섯 가지다. `latestVersion`은 조회가 결과를 낸 `available`·`up-to-date`에서만 값이 있다. 레지스트리의 값이 x.y.z 형식이 아니면 `unavailable`로 처리한다.
- 계약: `browser-session` version 2가 `cliVersion`과 `update`를 포함한다. v1 스키마는 소비자가 없어 제거했다. `update` version 2는 명령 출력이며 v1에 `commit`을 더했다. strict 스키마라 필드 추가를 버전 변경으로 보고, CLI 밖 소비자가 없는 v1은 제거했다. `changelog` version 1은 패치노트 응답이다.
- `apps/cli/src/adapters/git/agent-docs-commit.ts`: `update --commit`의 Git 접근. HEAD의 파일 내용 조회, `git commit --only`, 커밋의 부모·변경 파일 조회만 한다.
- 현재 버전은 빌드 시 주입되는 CLI 버전(`gitifact --version`과 같은 값)이다. AGENTS.md 블록의 버전 줄은 블록을 쓴 시점의 값이므로 현재 버전 판단에 쓰지 않는다.

## 처리 흐름

### 브라우저 서버
<!-- gitifact-ref: R-cj525dk5vt, R-hlndpxflx7 -->

1. `gitifact browser`는 조회가 꺼져 있지 않으면 서버에 조회 함수를 넘긴다. 넘기지 않으면 세션의 상태는 `disabled`다.
2. 서버는 수신을 시작한 뒤 상태를 `checking`으로 두고 백그라운드에서 한 번 조회한다. 기동과 어떤 페이지도 이 요청을 기다리지 않는다.
3. `/api/v1/session`은 읽을 때마다 현재 상태로 세션을 만든다. 세션을 다시 읽어도 레지스트리 요청은 늘지 않는다.
4. 브라우저는 상태가 `checking`인 동안만 1초 간격으로 세션을 다시 읽고 8회에서 멈춘다. 서버도 제한 시간이 지나면 반드시 `unavailable`로 바꾼다.
5. 사이드 메뉴 하단은 세션을 받은 뒤에만 `v<버전>`을 표시하며 패치노트로 이동하는 링크다. `available`일 때만 그 옆에 새 버전 버튼을 둔다. `unavailable`·`disabled`는 아무 안내도 표시하지 않아 확인 실패가 최신으로 보이지 않는다.
6. 버튼은 대화상자를 열어 현재·최신 버전, 에이전트에게 전달할 문장, npm 전역 설치용 명령을 복사 가능한 블록으로 보여 준다. 문장은 에이전트가 `gitifact update`를 실행해 설치 방법을 확인하고 설치 후 `gitifact update --commit`으로 블록을 갱신·커밋하도록 한다.

### 패치노트
<!-- gitifact-ref: R-yrk7zcukqy -->

원본은 `apps/cli/src/shared/i18n/<lang>/changelog.md`이며 빌드가 `dist/i18n/<lang>/`으로 복사한다. `/api/v1/changelog?lang=<언어>`는 세션 헤더를 요구하고, 언어 코드는 `^[a-z]{2}(-[A-Z]{2})?$`만 받아 경로 조작을 막는다. 요청한 언어의 파일이 없으면 기본 언어를 읽고 `fallback: true`로 알린다. core의 `parseChangelog`가 절 제목(영어 토큰 Added·Changed·Removed·Fixed)과 날짜 형식을 검증하며 형식 오류는 503으로 답한다. 브라우저의 `/changelog` 페이지는 버전마다 제목·날짜와 절별 항목을 세로 타임라인으로 그리고, 실행 중인 버전에 표시를 붙인다. 절 이름의 화면 표기는 브라우저의 메시지 표가 맡는다. 항목은 Markdown으로 렌더링한다.

### update 명령
<!-- gitifact-ref: R-cr5rajcs4a -->

`gitifact update`는 레지스트리 확인과 지침 블록 갱신을 함께 수행하고 `update` 계약으로 출력한다(`--format text` 지원). 새 버전이 있으면 `install.npmGlobal`에 npm 전역 설치용 명령을 담는다. 블록 갱신은 `planAgentDocs`의 `onlyExisting`으로 이미 블록이 있는 파일만 대상으로 하며 파일을 만들지 않는다. Git 저장소가 아니거나 설정이 없으면 `not-initialized`, 블록이 있는 파일이 없으면 `no-block`, 모두 현재 버전이면 `current`, 바꿨으면 `refreshed`다. 블록이 AGENTS.md에 있고 CLAUDE.md와 .claude/CLAUDE.md가 없으면 `agentDocs.missing`에 CLAUDE.md를 담고 텍스트 출력은 init 재실행을 안내한다. 이미 도입한 프로젝트가 wrapper를 얻는 경로는 init 재실행 하나이며 update는 만들지 않는다. 쓰기 전 HEAD·index·설정이 그대로인지 다시 확인한다. `init`은 도입, `update`는 유지 역할이다.

`--commit`은 블록 갱신 뒤에 실행한다. 대상은 블록을 가진 지침 파일(`planAgentDocs`의 paths)이며, wrapper에서 블록을 걷어낸 변경은 블록 안 변경이 아니므로 넣지 않는다. 파일마다 HEAD 내용과 작업 트리 내용을 CRLF를 LF로 맞춰 비교한다. 같으면 건너뛰고, HEAD에 없으면 `untracked`, 두 내용에서 마커 구간을 같은 자리표시로 바꾼 나머지가 다르면 `other-changes`로 전체를 멈춘다. 블록은 이미 현재 버전이므로 남은 차이는 갱신뿐이다. 이전에 옵션 없이 갱신만 해 둔 파일도 같은 판정으로 커밋된다. 대상이 모두 통과하면 `git commit --only -m "chore(gitifact): refresh GITIFACT block to v<버전>" -- <파일>`을 실행한다. `--only`는 지정 파일의 작업 트리 내용만 커밋하고 다른 staging을 index에 남긴다. 훅·서명 설정은 끄지 않는다. 실행 뒤 HEAD가 그대로면 `commit-failed`(감지한 오류 메시지를 `detail`에)로 알리고, 바뀌었으면 부모가 이전 HEAD 하나인지 확인한 뒤 커밋 해시와 실제 변경 파일을 싣는다. 부모가 다르면 `COMMIT_RESULT_UNKNOWN`으로 실패시키고 되돌리지 않는다. 출력의 `commit.state`는 `not-requested`·`nothing`·`committed`·`skipped`다.

## 오류 처리와 검증

오프라인·시간 초과·중단·잘못된 응답은 모두 `unavailable`이며 서버 기동과 `update` 명령을 실패시키지 않는다. 서버를 닫을 때 진행 중인 조회를 중단하고 기다린다. 깨진 마커가 있는 지침 파일은 `update`도 `AGENT_DOCS_MALFORMED`로 거부하고 아무것도 쓰지 않는다.

테스트는 네트워크를 쓰지 않는다. 조회 함수와 패치노트·블록 읽기를 주입해 정상·최신·오류·형식 오류·시간 초과·중단을 만들고, 세션 재조회가 조회 횟수를 늘리지 않음을 확인한다. 브라우저는 모의 API로 버전 표시, 안내 대화상자, 확인 중 재조회, 실패 상태의 무표시, 패치노트 타임라인과 대체 안내를 확인하고 브라우저가 외부 주소에 요청하지 않음을 검사한다. CLI 테스트는 CLAUDE.md가 빠진 프로젝트에서 `missing` 보고와 파일 미생성, init 재실행 뒤 해소를 확인한다. 임시 저장소에서 `--commit`의 고정 메시지 커밋, 다른 staging·작업 트리 수정 보존, 두 번째 실행의 `nothing`, 옵션 없이 갱신해 둔 블록의 이후 커밋, 블록 밖 수정·미추적 파일·신원 없는 커밋 거부 시 HEAD 유지를 확인한다. 패키지 검사는 조회를 끈 채 설치본의 `update`가 블록을 복원하는지, 세션이 v2이고 패치노트 첫 항목이 패키지 버전인지 확인한다.

## 주요 설계 결정

- **확인 주체는 서버.** 브라우저가 레지스트리에 직접 요청하면 CORS와 "브라우저는 로컬 서버만 본다"는 경계에 어긋난다.
- **자동 설치를 하지 않는다.** CLI는 npm·pnpm 전역, npx, 프로젝트 로컬 중 어떻게 설치됐는지 확실히 알 수 없고, 실행 중인 자기 파일을 교체해야 하며, 전역 경로는 관리자 권한이 필요할 수 있다. 브라우저 요청으로 명령을 실행하는 endpoint는 서버가 두지 않기로 한 표면이다. 대신 에이전트용 문장과 설치 명령을 제공한다. 전역 npm 설치가 확인된 경우에 한한 자동 설치는 이후 검토 대상이다.
- **커밋은 옵션으로.** 기본 커밋(`--no-commit`으로 끔)은 "자동 기록은 자동 커밋 권한이 아니다"는 제품 원칙에 예외를 만들고 사람이 직접 실행해도 커밋이 생겨 기각했다. 에이전트 지침만 추가하는 방식은 메시지와 범위가 에이전트마다 달라지고 테스트로 보장할 수 없어 기각했다. 옵션을 명시한 실행을 사용자 요청으로 보고, 브라우저 안내 문장과 블록이 `update --commit`을 쓴다.
- **블록 밖 변경이 있으면 커밋하지 않는다.** 블록 구간만 골라 부분 staging하면 사용자의 작업 중 수정과 섞일 위험이 있어, 파일 전체가 블록 안에서만 다를 때만 커밋한다.
- **빠진 CLAUDE.md는 안내만 한다.** update가 만들면 `--commit`의 "블록 안만 바뀐 파일" 규칙에 새 파일을 커밋할지 따로 정해야 하고 유지 명령이 도입 동작을 겸하게 된다. 아무 안내 없이 init 재실행에만 맡기는 방식은 이미 도입한 프로젝트가 모르고 지나칠 수 있어 기각했다. update 계약은 이 필드로 v3가 됐고 CLI 밖 소비자가 없는 v2는 제거했다.
- **디스크 캐시 없음.** 서버 시작마다 한 번만 조회한다. 하루 한 번 같은 제한이 필요해지면 프로젝트 밖에 파일을 쓰는 첫 사례가 되므로 별도로 결정한다.
- **세션 계약을 v2로.** v1은 strict 스키마라 필드 추가가 의미 변경이다. 브라우저와 서버는 함께 배포되므로 v1 호환 코드는 남기지 않았다.

## 미결 사항

`update --apply`(자기 교체 설치), 조회 결과 캐시, 두 번째 언어의 패치노트 파일은 아직 없다.
