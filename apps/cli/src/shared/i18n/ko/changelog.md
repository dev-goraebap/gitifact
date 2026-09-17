## 0.3.1 - 2026-09-17
### Added
- 브라우저에 제품 개요 대시보드와 Gitifact 소개 페이지를 추가했습니다.
- 지침 문서를 열 보기로 훑고 미리보기로 읽을 수 있습니다.
- 헤더에 마지막 조회 시각을, Git 상태 메뉴에 미커밋 변경 표시를 보여 줍니다.
### Changed
- 요구사항 메뉴의 이름과 순서를 정리했습니다.

## 0.3.0 - 2026-09-16
### Added
- `init`이 AGENTS.md·CLAUDE.md·`.cursorrules` 등 에이전트 지침 파일에 `GITIFACT:START`/`GITIFACT:END` 블록을 쓰고, 다시 실행하면 그 사이만 갱신합니다.
- `init`에 `--agent`·`--remove-agents`·`--skip-agents` 옵션을 추가했습니다.
- `docs <topic>` 명령이 번들된 지침 문서 다섯 편(workflow·spec·design·product·commit)을 출력합니다.
### Changed
- `project-init` 계약이 version 4가 됐습니다.
### Removed
- `skills install`·`skills sync`·`skills remove` 명령과 배포 스킬 파일을 제거했습니다. 0.2.0 스킬 설치본의 자동 정리는 제공하지 않습니다.

## 0.2.0 - 2026-09-15
### Added
- 1920px 이상 화면에서 브라우저의 기본 글자 크기를 키웁니다.
### Changed
- 브라우저의 기여자 화면을 참여자 화면으로 바꿨습니다.
- 기능·참여자 상세를 `/features/<S-ID>`·`/contributors/<이메일>` 경로로 옮겼습니다. 이전 `?feature=`·`?author=` 링크는 리다이렉트하지 않습니다.
- Git 상태 페이지를 다른 페이지와 같은 구조로 정리했습니다.

## 0.1.0 - 2026-09-15
### Added
- `migrate` 명령으로 이전 `@tryce/cli` 저장소를 Gitifact 형식으로 전환합니다. 과거 커밋 기록은 그대로 읽힙니다.
### Changed
- Tryce에서 Gitifact로 이름을 바꿨습니다. 패키지는 `gitifact`, 실행 명령은 `gitifact`, 저장 경로는 `.gitifact`, 스킬은 `gitifact-workflow`입니다.
