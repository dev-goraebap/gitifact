# npm 배포

공개 패키지는 `apps/cli`의 `gitifact` 하나다. 설치는 `npm install -g gitifact`, 실행 명령은 `gitifact`다. 루트 workspace와 공통 패키지·브라우저는 private으로 유지한다. 첫 배포 버전은 0.1.0, 사용자가 선택한 라이선스는 MIT다. Node.js 24.x와 Git이 필요하며 현재 실행 검증 환경은 Windows다.

버전별 기능 변경은 [패치노트](../apps/cli/src/shared/i18n/ko/changelog.md)가 원본이다. 이 문서는 배포 준비의 검증 결과·해시와 게시 경과만 기록한다.

## 준비와 게시

저장소 루트에서 의존성을 설치하고 빌드·테스트한다. 아래 명령은 Git Bash에서도 그대로 사용한다.

```sh
pnpm install --frozen-lockfile
pnpm check
```

버전을 올릴 때 [패치노트](../apps/cli/src/shared/i18n/ko/changelog.md) 맨 앞에 그 버전의 항목을 쓴다. 절 제목은 `Added`·`Changed`·`Removed`·`Fixed`만 쓰고 사용자에게 보이는 변경만 적는다. 첫 항목이 `apps/cli/package.json`의 버전과 다르면 `pnpm check`의 패키지 검사가 실패한다. README와 소개 페이지에는 버전 번호를 적지 않는다.

검증한 변경을 커밋하고 게시 브랜치 `main`을 원격과 맞춘 뒤, 패키지 폴더에서 게시한다. pnpm은 브랜치·작업 폴더·원격 상태를 검사한다. Git 푸시는 별도로 요청받은 범위에서 수행한다.

```sh
cd apps/cli
pnpm publish --dry-run --json --publish-branch main
pnpm publish --access public --tag latest --publish-branch main
```

게시 기준은 `apps/cli/package.json`이다. `files: ["dist"]`로 빌드 결과를 포함하며 README·LICENSE·package.json도 함께 묶인다. `dist`를 독립 패키지 폴더로 만들거나 `.tmp`에 게시용 압축 파일을 먼저 둘 필요는 없다. pnpm을 사용해 `workspace:` 의존성을 게시 가능한 버전으로 변환한다. [pnpm publish](https://pnpm.io/cli/publish), [workspace 패키지 게시](https://pnpm.io/workspaces#publishing-workspace-packages).

모의 실행에서 파일 목록·버전·integrity를 확인하고 게시까지 소스·설정·빌드 결과를 바꾸지 않는다. 변경했다면 검증부터 다시 수행한다. 게시 이후 같은 이름·버전을 덮어쓰지 않고 수정 버전을 발급한다. 게시 권한·추가 인증이 필요하면 npm이 제공하는 절차를 따른다. 자격 증명을 저장소나 로그에 기록하지 않는다. [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

압축 파일에는 번들 CLI, 브라우저 정적 자산, 에이전트 지침·패치노트 Markdown(`dist/i18n`), 사용 안내, MIT 라이선스와 제3자 고지만 포함한다. 실행 의존성을 번들해 내부 private 패키지의 게시를 요구하지 않는다. 소스·테스트·프로젝트 기록·인증 파일은 배포하지 않는다. npm 설치 시 실행하는 lifecycle script도 없다.

빌드는 runtime dependency의 라이선스 본문을 모아 `dist/THIRD_PARTY_NOTICES.txt`를 만든다. 배포 패키지에 빠진 Astryx·StyleX 고지는 [출처가 고정된 사본](../apps/cli/licenses/README.md)을 사용한다. 버전을 바꾸면 해당 사본과 고지를 다시 검토한다.

## 게시 확인

```sh
npm view gitifact@0.1.0 version license dist.integrity
```

레지스트리 integrity를 실제 게시 결과와 비교하고, 새 시험 폴더에 레지스트리에서 설치해 버전·help와 실제 Git 프로젝트 명령을 실행한다. 모의 실행과 해시가 다르면 게시 전에 파일 내용과 배포 매니페스트를 비교해 원인을 확인한다. 로컬 검증·원격 게시·설치 확인의 성공 여부를 각각 기록한다.

Git 커밋과 npm 게시를 구분한다. 검증한 변경은 커밋하며, Git 원격 푸시는 별도로 요청받은 범위에서 수행한다.

Gitifact는 조직 없는 공개 패키지 `gitifact`로 게시한다. 사용자가 이름을 확인했으며 첫 버전은 0.1.0이다. 배포 직전에 레지스트리 상태를 다시 확인한다. 이번 전환에서는 사용자가 새 토큰을 npm 사용자 전역 인증 설정에 반영하도록 요청했다. 토큰 경로와 전달 사항은 로컬 인계 문서에만 두고 토큰 값은 문서·명령 출력·패키지에 포함하지 않는다. 기존 다른 registry 설정은 보존한다.

이름 변경과 새 remote 반영, 기록 전환, 패키지 검증을 완료한 뒤 위 게시 절차를 수행한다. 현재 문서 변경만으로 인증 설정·게시가 완료된 것은 아니다. [이름 전환 계획](gitifact-transition.md)을 함께 따른다.

## 0.1.0 배포 준비

Tryce에서 Gitifact로 이름을 바꾼 첫 배포다. 패키지 `gitifact@0.1.0`, 실행 명령 `gitifact`, 저장 경로 `.gitifact`, 스킬 `gitifact-workflow`, 새 `migrate` 명령을 포함한다. 이전 `@tryce/cli` 0.5.0 사용자는 `gitifact migrate`로 저장소를 전환하며 과거 커밋 기록은 그대로 읽힌다. 전환 내용은 [이름 전환 계획](gitifact-transition.md), 검증은 [개발 환경](development.md#2026-09-15-gitifact-전환-사용-빌드)에 있다.

`pnpm check`와 `pnpm test:package`를 통과했다. core 16개·contracts 4개·CLI 106개·브라우저 16개·스킬 5개와 workspace 밖 오프라인 설치·실행을 확인했다. CLI 번들 SHA-256은 지정 빌드와 같은 `9bbe7721595c08c0aa3f7b71427fae34b12f957a25d3e992f312934a9474bfc5`이다. 게시 결과는 아래에 이어서 기록한다.

## 0.1.0 게시 결과

2026-09-15 전환 커밋 abf8c5c까지 main을 새 원격 `dev-goraebap/gitifact`에 fast-forward로 푸시하고 `apps/cli`에서 Git 검사를 유지한 pnpm publish로 공개 게시했다. latest는 0.1.0, 라이선스는 MIT다. 게시 전 모의 실행에서 이전 빌드가 남긴 `dist/skills/tryce-workflow`를 발견해 제거했고, 최종 패키지는 288개 파일이다. 레지스트리 integrity는 `sha512-AJ3RlH3UXLoxUcN6EPHRynMZdCvVkFKB3IasF2SaNscUnfrlsDYEFBMTIvWCfHoRC5Q8aPHeGoEGnNWJP1dY4Q==`, shasum은 `9c8c8cc4aa3081c126cf37e3fddd6e02c74bbbfa`다.

새 폴더에 레지스트리에서 `gitifact@0.1.0`을 설치해 version·help, 새 Git 저장소의 init(`.gitifact/config.json`), spec working·save(`gitifact-spec` 마커), skills install(`gitifact-workflow`), spec commit, spec read를 확인했다. 설치된 main.js의 SHA-256은 지정 빌드와 같은 `9bbe7721…`이다. npm 인증은 기존 로그인 세션을 사용했고 인계 문서의 새 토큰은 실행 정책상 사용자 설정에 반영하지 못했다.

## 0.2.0 배포 준비

2026-09-15 사용자 배포 요청으로 0.1.0 이후의 브라우저 작업을 0.2.0으로 준비했다. 기여자 화면을 참여자로 바꾸고, 기능·참여자 상세를 `/features/<S-ID>`·`/contributors/<이메일>` 경로로 옮겼으며, Git 상태 페이지를 다른 페이지와 같은 구조로 다듬고, 1920px 이상에서 루트 글자 크기를 키우는 규칙을 넣었다. 이전 `?feature=`·`?author=` 링크는 리다이렉트하지 않는다. 서버 계약과 저장 형식은 바뀌지 않았다.

`pnpm check`와 `pnpm test:package`를 통과했다. core 16개·contracts 4개·CLI 106개·브라우저 16개·스킬 5개와 workspace 밖 오프라인 설치·실행을 확인했다. CLI 번들 SHA-256은 `667985b8966a625ae6b401d779eb7f6798ea8ff6775a65891a285a493e6727ea`이다. 게시 결과는 아래에 이어서 기록한다.

## 0.2.0 게시 완료

2026-09-15 릴리스 준비 커밋 `b4f8a84`까지 main을 푸시한 뒤 사용자가 apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main`을 실행했다. 에이전트 세션의 자동 모드 권한 분류기가 게시 명령을 막아 사용자가 직접 실행했다. npm은 202로 접수하고 몇 분 뒤 공개했다. latest는 0.2.0, 라이선스는 MIT다. 모의 실행·실제 게시·레지스트리의 integrity는 모두 `sha512-n4+s9GsDTmrDnnKL2xVrioMVeSAtn9WkeHVyR/TqBeaY1+fNe3l/6aKBDnto7QKq4XVjy0ZRZu1q+smQQdHUwg==`, shasum은 `a89139ff6a407cdd3ded64f862c54331a6a6932e`이며 패키지는 44개 파일이다.

레지스트리에서 새 임시 폴더에 설치한 CLI 번들의 SHA-256이 지정 빌드 `667985b8…`와 같았다. 설치본으로 version, init dry-run·init, spec working을 실행했고 브라우저 정적 자산과 스킬 원본이 포함됨을 확인했다.

## 0.3.0 배포 준비

2026-09-16 사용자 배포 요청으로 스킬 배포를 에이전트 지침 파일의 관리 블록으로 바꾼 변경을 0.3.0으로 준비했다. `init`이 AGENTS.md·CLAUDE.md·`.cursorrules` 등에 `GITIFACT:START/END` 블록을 쓰고 재실행 시 갱신하며 `--agent`·`--remove-agents`·`--skip-agents`를 받는다. 새 `docs <topic>` 명령이 번들된 지침 Markdown 다섯 편을 출력한다. `skills install/sync/remove`와 배포 스킬 파일은 제거했고 `project-init` 계약은 version 4가 됐다. 1.0.0 이전이므로 0.2.0 스킬 설치본의 호환·자동 정리는 제공하지 않는다. README는 도입 프롬프트를 두 문장으로 줄였다.

스킬 제거 커밋 07f155b까지 `pnpm check`를 통과했다. core 19개·contracts 4개·CLI 110개·브라우저와 workspace 밖 오프라인 설치에서 init의 블록 생성·사용자 문단 보존·제거와 `docs spec` 출력이 자산 원본과 같음을 확인했다. 버전을 0.3.0으로 올린 뒤 `pnpm check`를 다시 통과했고 루트 AGENTS.md의 블록도 `pnpm cli init`으로 v0.3.0 줄로 갱신했다. CLI 번들 SHA-256은 `60f85715430e819b14143c4b1dfee103bb63e5389efd9b0dc4d22d324607f4ab`이다. 게시 결과는 아래에 이어서 기록한다.

## 0.3.0 게시 완료

2026-09-16 릴리스 준비 커밋 `723f609`까지 main을 푸시하고 apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. npm은 접수 후 몇 분 뒤 공개했다. latest는 0.3.0, 라이선스는 MIT다. 실제 게시와 레지스트리의 integrity는 `sha512-TgWs+d3A9gqWOH+DzRxut8h4RTu8jYmZC3Nz0RGCm+PzIHPuNTZPpaDM6SQJQXrIr/sbV8zzLQJUaXZ9YPFp2Q==`, shasum은 `5936ecd1c4637a974a187b7203d3cd5a64ab7aa4`이며 패키지는 51개 파일이다. 모의 실행의 integrity(`sha512-gXPD52…`)는 pnpm이 매니페스트를 다시 쓰는 순서 차이로 달랐고 파일 목록은 같았다. 배포물에 `dist/skills`는 없고 `dist/docs`의 지침 다섯 편이 들어 있다.

레지스트리에서 새 임시 폴더에 설치한 CLI 번들의 SHA-256이 검증 빌드 `60f85715…`와 같았다. 설치본으로 version, 새 Git 저장소의 init(config.json 생성과 AGENTS.md의 `gitifact v0.3.0` 블록), `docs` 목록과 `docs spec` 출력을 확인했고 제거한 `skills` 명령은 인자 오류를 반환했다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

## 0.3.1 배포 준비

2026-09-17 사용자 푸시·배포 요청으로 브라우저 정리 커밋 `fdeae24`를 패치 버전 0.3.1로 준비했다. 제품 개요 대시보드, 지침 열 보기·미리보기, 요구사항 메뉴 이름과 순서, 헤더 조회 시각, Git 상태 메뉴의 미커밋 표시, Gitifact 소개 페이지를 포함한다. CLI 명령·서버 계약·저장 형식은 바뀌지 않았다. 내용은 [개발 환경](development.md#2026-09-17-브라우저-정리와-제품-개요-대시보드)을 따른다.

버전을 0.3.1로 올린 뒤 `pnpm check`를 통과했다. core 19개·contracts 4개·CLI 110개·브라우저 21개와 workspace 밖 오프라인 설치·실행을 확인했고 루트 AGENTS.md의 블록도 `pnpm cli init`으로 v0.3.1 줄로 갱신했다. CLI 번들 SHA-256은 `a35ef9c94b0362ce5ec7c2b67f93727908a529dc037453b4933d36128cf0da58`이다. 모의 게시(`--dry-run --no-git-checks`, 미커밋 상태의 패키징 확인용)는 51개 파일, integrity `sha512-ETaJt1okgvBSSACpr0bU2kwFcmaSsfbyA7Y5FsQor75sPDK5NB7SedB7VEl0k3PasdVkCwZieYhfa0rOG7KthA==`이며 dist·README·LICENSE·package.json만 포함했다. 게시 결과는 아래에 이어서 기록한다.

## 0.3.1 게시 완료

2026-09-17 릴리스 준비 커밋 `b31d412`까지 main을 푸시하고 apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. npm은 접수 후 몇 분 뒤 공개했다. latest는 0.3.1, 라이선스는 MIT다. 실제 게시와 레지스트리의 integrity는 `sha512-KYe0Z1eey71AiY1I4m2ZnNkRrMcNTvPhCZ1x95MwsZrHNNAtfB9JkGb+sL0+ZF3R3BqL7PDxonO4E7bxwm+upw==`, shasum은 `5af517c18a79a852d8e8c91447eb6b03de370be5`이며 패키지는 51개 파일이다. 모의 실행의 integrity(`sha512-ETaJt1…`)는 0.3.0 때와 같이 매니페스트 기록 순서 차이로 달랐고 파일 목록은 같았다.

레지스트리에서 새 임시 폴더에 설치한 CLI 번들의 SHA-256이 검증 빌드 `a35ef9c9…`와 같았다. 설치본으로 version, 새 Git 저장소의 init(config.json 생성과 AGENTS.md의 `gitifact v0.3.1` 블록), `docs` 목록을 확인했다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

## 0.3.2 배포 준비

2026-09-17 사용자 푸시·배포 요청으로 언어별 문구 구조 정리(`73752a8`~`5980ee9`)를 패치 버전 0.3.2로 준비했다. 사용자에게 보이는 변경은 패치노트 동봉, `spec` 하위 명령 5개의 도움말 설명, 브라우저 소개 페이지의 로고와 새 소개 글, GITIFACT 블록 첫 줄의 언어 토큰(`· ko ·`), CLI 안내의 잘못된 구형 버전 표기 정정이다. CLI 명령·서버 계약·저장 형식은 바뀌지 않았고 CLI 출력 문구도 도움말 설명 외에는 같다. 내용은 [개발 환경](development.md#2026-09-17-언어별-문구-구조)을 따른다.

배포물의 지침 Markdown 위치가 `dist/docs`에서 `dist/i18n/ko/docs`로 바뀌었다. 모의 게시에서 이전 빌드가 남긴 `dist/docs`가 함께 묶이는 것을 발견해(파일 59개), 빌드가 그 폴더를 지우고 패키지 검사가 `dist/docs`·`dist/skills`가 없음을 확인하도록 했다. 같은 준비 중 core 테스트가 패치노트의 버전 목록을 고정해 새 항목에서 실패해, 가장 오래된 0.1.0만 확인하도록 고쳤다.

버전을 0.3.2로 올리고 패치노트 첫 항목을 쓴 뒤 `pnpm check`를 통과했다. core 27개·contracts 5개·intro 3개·CLI 117개·브라우저 23개와 workspace 밖 오프라인 설치·실행을 확인했고 루트 AGENTS.md의 블록을 `pnpm cli init`으로 v0.3.2 줄로 갱신했다. CLI 런타임 의존성과 라이선스 사본은 0.3.1과 같다. CLI 번들 SHA-256은 `2b21657c72beccfa4665b2c6f5148f0f846f595c57ed811fcecee9f493b90c22`이다. 모의 게시(`--dry-run --no-git-checks`, 커밋 전 확인용)는 54개 파일, integrity `sha512-4NIh4ja3zpvWPhz/mYT96myUcz//nL3Ghru/5/m8k1f6d27r/pmkmw+fK1q2eD0WFFRPZyAeIkK8CDbbJZO86Q==`이며 dist·README·LICENSE·package.json만 포함했다. 게시 결과는 아래에 이어서 기록한다.

## 0.3.2 게시 완료

2026-09-17 릴리스 준비 커밋 `7273947`까지 main을 푸시하고 apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. npm은 접수 후 약 2분 뒤 공개했다. latest는 0.3.2, 라이선스는 MIT다. 실제 게시와 레지스트리의 integrity는 `sha512-4NIh4ja3zpvWPhz/mYT96myUcz//nL3Ghru/5/m8k1f6d27r/pmkmw+fK1q2eD0WFFRPZyAeIkK8CDbbJZO86Q==`, shasum은 `a4f11b9ae4e2d1a3aee6c5ac3e0eaf40baf220e7`이며 패키지는 54개 파일이다. 이번에는 모의 실행의 integrity도 같았다.

레지스트리에서 새 임시 폴더에 설치한 CLI 번들의 SHA-256이 검증 빌드 `2b21657c…`와 같았고 배포물에 `dist/docs`가 없음을 확인했다. 설치본으로 version, 새 Git 저장소의 init(AGENTS.md의 `gitifact v0.3.2 · ko · 저장 규약 schemaVersion 1` 블록), `docs` 목록과 `docs spec`, `spec --help`의 새 명령 설명, 동봉 패치노트의 첫 항목 0.3.2를 확인했다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

## 0.4.0 배포 준비

2026-09-17 사용자 요청으로 버전 확인과 패치노트 기능을 0.4.0으로 준비했다. 기능 목록은 패치노트가 원본이다. `browser` 기동 시와 새 `update` 명령이 npm 레지스트리에서 최신 버전을 한 번 조회하며(프로젝트 정보 없음, 제한 시간 3초, `--no-update-check`·`GITIFACT_NO_UPDATE_CHECK`로 끔), 이것이 CLI의 첫 외부 요청이다. 설치는 어느 경로에서도 자동 실행하지 않는다. `browser-session` 계약은 version 2가 됐고 v1 스키마는 제거했다.

`pnpm check`를 통과했다. contracts 7개·core 27개·intro 3개·CLI 123개·브라우저 26개와 workspace 밖 오프라인 설치에서 `update`의 블록 복원, 세션 v2, 패치노트 첫 항목이 패키지 버전과 같음을 확인했다. 테스트는 조회 함수를 주입하므로 네트워크를 쓰지 않는다. 별도로 이 저장소에서 `pnpm cli update`를 실행해 실제 레지스트리 응답(최신 0.3.2, 상태 up-to-date)과 루트 AGENTS.md 블록의 v0.4.0 갱신을 확인했다. CLI 번들 SHA-256은 `3ce604a985af05b07e09199355b4f6d7af02317d332a4f51273d979c2db435f1`이다. 게시 결과는 아래에 이어서 기록한다.

## 0.4.0 게시 완료

2026-09-17 하단 표시 정리 커밋 `f653527`까지 main을 푸시하고 apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. npm은 접수 후 몇 분 뒤 공개했다. latest는 0.4.0, 라이선스는 MIT다. 모의 실행·실제 게시·레지스트리의 integrity는 모두 `sha512-8x5cMusMqJrgVk69irBUE4yKS1qHZ1vW+1sfua0s78xtwSJltp+qht2WNy0juIdoXLinc2mNKTyntyxmUBi/gw==`, shasum은 `424d06cf5a429df6adc14f63f0117311598a4d0a`이며 패키지는 57개 파일이다. `dist/i18n/ko`에 지침 다섯 편·block.md·changelog.md가 들어 있다.

레지스트리에서 새 임시 폴더에 설치한 CLI 번들의 SHA-256이 검증 빌드 `3ce604a9…`와 같았다. 설치본으로 새 Git 저장소의 init, `update`(실제 레지스트리 조회 결과 up-to-date·latest 0.4.0, 블록 current), `GITIFACT_NO_UPDATE_CHECK=1`에서의 disabled 표시를 확인했다. `browser` 서버의 세션은 version 2로 `cliVersion` 0.4.0과 up-to-date 상태를 반환했고, `/api/v1/changelog?lang=ko`는 0.4.0을 첫 항목으로 6개 버전을 돌려줬으며 `/changelog` 경로는 200이었다. 사용자 요청으로 이 PC의 npm 전역 설치도 0.3.0에서 0.4.0으로 올렸다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

## 0.4.1 배포 준비

2026-09-17 사용자 요청으로 브라우저 개선을 패치 버전 0.4.1로 준비했다. 기능 목록은 패치노트가 원본이다. 설정 페이지(화면 모드와 색 조합 다섯 가지), 제품 문서 읽기 페이지, 읽기 영역 타이포그래피와 코드 구문 색, 지침 폴더 행 높이, 활동 상세의 고정 제목 겹침 수정을 포함한다. CLI 명령·서버 계약·저장 형식은 바뀌지 않았고 새 의존성도 없다. 색 조합은 stone 테마를 확장해 색 토큰만 지정한 것이라 라이선스 고지에 추가가 없다.

`pnpm check`를 통과했다. contracts 7개·core 27개·intro 3개·CLI 123개·브라우저 28개와 workspace 밖 오프라인 설치·실행을 확인했고 루트 AGENTS.md의 블록은 `pnpm cli update`로 v0.4.1 줄로 갱신했다. 색 조합과 읽기 영역은 라이트·다크 화면을 직접 띄워 확인했다. CLI 번들 SHA-256은 `9f9a9d244191cca75470154ca17a033431ac8775ec3496f23ef956c00bd8bdf6`이다. 게시 결과는 아래에 이어서 기록한다.

## 0.4.1 게시 완료

2026-09-17 릴리스 커밋 `9cb8eb8`까지 main을 푸시하고 apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. npm은 접수 후 몇 분 뒤 공개했다. latest는 0.4.1, 라이선스는 MIT다. 실제 게시와 레지스트리의 integrity는 `sha512-VKb8TctSf5tRQdYlVpoGQU2p/rj9L4qOjb6hQuA3cCeZr0yao6PWlBY3bJqKcf3g0k5IjJOYbLvaSnJjjTkhBg==`, shasum은 `6492b28254d5a4c60c5750dd76743161e471d903`이며 패키지는 68개 파일이다. 모의 실행의 integrity(`sha512-ThOARh…`)는 0.3.x 때와 같이 매니페스트 기록 순서 차이로 달랐고 파일 목록은 같았다.

레지스트리에서 새 임시 폴더에 로컬로 설치한 CLI 번들의 SHA-256이 검증 빌드 `9f9a9d24…`와 같았다. 설치본으로 새 Git 저장소의 init, `update`(실제 레지스트리 조회 결과 up-to-date·latest 0.4.1), 조회를 끈 `browser` 서버의 세션 v2(`cliVersion` 0.4.1·disabled)와 `/settings`·`/product/document`·`/changelog` 경로의 200 응답을 확인했다. 사용자가 브라우저의 새 버전 안내를 0.4.0에서 직접 시험하려고 요청해 이 PC의 npm 전역 설치는 0.4.0으로 남겼다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

## 0.4.2 배포 준비

2026-09-17 사용자 요청으로 에이전트 임시 입력 파일 관리와 브라우저 열기 안내를 패치 버전 0.4.2로 준비했다. 기능 목록은 패치노트, 설계는 agent-workflow 명세를 따른다. spec 계약의 version은 그대로이고 `inputs`·`inputRemoved` 필드와 working 옵션이 추가됐다. 저장 형식과 서버 계약은 바뀌지 않았고 새 의존성도 없다. 테스트 fixture와 패키지 검사는 TEMP·TMP·TMPDIR을 시험 폴더로 돌려 실제 사용자 임시 폴더를 쓰지 않는다.

`pnpm check`를 통과했다. contracts 7개·core 27개·intro 3개·CLI 129개(새 임시 입력 파일 검사 6개 포함)·브라우저 28개와 workspace 밖 오프라인 설치·실행을 확인했고, 패키지 검사는 설치본의 입력 경로와 성공 후 삭제도 확인한다. 루트 AGENTS.md의 블록은 `pnpm cli update`로 v0.4.2 줄로 갱신했다. CLI 번들 SHA-256은 `e43085fbe66d7cd348bd25fe4ba8b3d7dd7075092fd35fc06c9814c1ed654c94`이다. 게시 결과는 아래에 이어서 기록한다.

## 0.4.2 게시 완료

2026-09-17 릴리스 커밋 `02338b1`까지 main을 푸시하고 apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. latest는 0.4.2, 라이선스는 MIT다. 모의 실행·실제 게시·레지스트리의 integrity는 모두 `sha512-CpFExVDbFc0vnlY/6ab77wzoUzNvM0X7T7iheYdpJO5n579/uLQYYv/CdzJrlrWZ3MFazBrl/eWselK3SGruaQ==`, shasum은 `69f0c5ea9467a4cafad7aaacefa92d893e9eb98c`이며 패키지는 68개 파일이다.

레지스트리에서 새 임시 폴더에 로컬로 설치한 CLI 번들의 SHA-256이 검증 빌드 `e43085fb…`와 같았다. 설치본으로 새 Git 저장소의 init과 블록의 브라우저 안내, TEMP를 시험 폴더로 돌린 `spec working --stamp`의 inputs 경로, 그 경로로 실행한 spec save의 `inputRemoved: true`와 실제 파일 삭제, `spec working --ids` 출력을 확인했다. 이 PC의 npm 전역 설치는 사용자의 새 버전 안내 시험을 위해 0.4.0으로 남겼다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

기록 커밋 `b6e8bb0`은 셸 인용 실수로 이 절의 코드 표기가 빠진 채 푸시돼 후속 커밋에서 바로잡았다. 그 실행에서 인용이 깨진 `pnpm publish` 호출이 알 수 없는 옵션 오류로 중단됐으며 추가 게시는 없었다(레지스트리 버전 목록으로 확인).

## 0.4.3 배포 준비

2026-09-17 사용자가 0.4.0 브라우저의 새 버전 안내 창에서 제목·닫기 버튼 배치와 복사 버튼 겹침을 보고해 패치 버전 0.4.3으로 준비했다. 창에 `padding={0}`을 주고 헤더를 바로 넣어 여백이 없었고, 제목 없는 CodeBlock은 복사 버튼을 첫 줄 위에 띄웠다. Astryx 템플릿대로 `Layout`의 header·content에 배치하고 두 코드 블록에 제목을 붙였다. CLI 명령·서버 계약·저장 형식은 바뀌지 않았다. 브라우저 테스트에 제목·닫기 버튼 여백과 복사 버튼·코드 텍스트 비겹침 검사를 추가했고, 이 검사는 수정 전 빌드에서 실패함을 확인했다.

`pnpm check`를 통과했다. contracts 7개·core 27개·intro 3개·CLI 129개·브라우저 28개와 workspace 밖 오프라인 설치·실행을 확인했다. 루트 AGENTS.md의 블록은 `pnpm cli update`로 v0.4.3 줄로 갱신했다. CLI 번들 SHA-256은 `51b995df11d7b710c39f445f7b2bd7bfed196bd4d0c55b81745b3b4722332380`이다. 게시 결과는 아래에 이어서 기록한다.

## 0.4.3 게시 완료

2026-09-17 릴리스 커밋 `02622ca`까지 main을 푸시하고 apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. latest는 0.4.3, 라이선스는 MIT다. 실제 게시와 레지스트리의 integrity는 `sha512-Ef4+8bv8Hgqzd/e1i4fO8n3R+U5FGotljWduCj3BJjkO3J+LYRvEEGwj5crG1YO5myLJRxju75tD45X91AjLow==`, shasum은 `d5e3f1a89da6231eecb2c965c01a0d3c1cc517ff`이며 패키지는 68개 파일이다. 모의 실행의 integrity(`sha512-ikLAeu…`)는 이전 릴리스처럼 매니페스트 기록 순서 차이로 달랐고 파일 수는 같았다.

레지스트리에서 새 임시 폴더에 로컬로 설치한 dist 65개 파일이 검증 빌드와 모두 같았고, 브라우저 자산에 수정한 안내 창의 코드 블록 제목이 포함됐다. 설치본의 version은 0.4.3이다. 이 PC의 npm 전역 설치는 사용자의 새 버전 안내 시험을 위해 0.4.0으로 남겼다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

## 0.4.4 배포 준비

2026-09-17 사용자가 업데이트 후 바뀐 AGENTS.md 블록을 고정 메시지로 커밋하는 기능, 블록의 Markdown 구조(제목·목록·구분선), CLI가 없는 팀원의 설치 안내를 요청해 패치 버전 0.4.4로 준비했다. 커밋 방식은 사용자가 `update --commit` 옵션안을 선택했다. `update` 출력 계약은 `commit` 필드를 더해 version 2가 됐다. 저장 형식은 바뀌지 않았고 runtime dependency도 그대로라 제3자 고지 사본은 변경하지 않았다.

`pnpm check`를 통과했다. contracts 7개·core 27개·intro 3개·CLI 130개·브라우저 28개와 workspace 밖 오프라인 설치·실행을 확인했다. 첫 실행에서는 CLI 테스트 1개가 실패했으나 출력을 요약만 남겨 이름을 확인하지 못했고, CLI 테스트 단독 재실행과 `pnpm check` 재실행에서 모두 통과했다. 같은 작업 중 브라우저의 업데이트 안내 창 배치 검사도 병렬 실행에서 한 번 실패한 뒤 재실행에서 통과했다. 루트 AGENTS.md의 블록은 `pnpm cli update`로 v0.4.4 줄로 갱신했다. CLI 번들 SHA-256은 `f19dc1d51670b8e92d958b4e4af565cbe87e7d596b0b9a7a6496800a42431f1a`이다. 게시 결과는 아래에 이어서 기록한다.

## 0.4.4 게시 완료

2026-09-17 릴리스 커밋 `8c44925`까지 main을 푸시하고 apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. npm은 접수 후 몇 분 뒤 공개했다. latest는 0.4.4, 라이선스는 MIT다. 실제 게시와 레지스트리의 integrity는 `sha512-cj1i49S633kr7tMaABVQuPHMhBFJzTk3XUHYlNaIXdVLsvwJG1p1VOPOAf3Gj6r5773AtZhhJZyQTIYWFiKWXQ==`, shasum은 `d2b3b98acb9027da86b402932032ef755274499a`이며 패키지는 68개 파일이다. 모의 실행의 integrity(`sha512-7fxl4W…`)는 이전 릴리스처럼 매니페스트 기록 순서 차이로 달랐고 파일 수는 같았다.

레지스트리에서 새 임시 폴더에 로컬로 설치한 dist 65개 파일이 검증 빌드와 모두 같았고, 설치본의 `--version`은 0.4.4, `dist/i18n/ko/block.md`는 `## Gitifact Guide`로 시작한다. 이 PC의 npm 전역 설치는 변경하지 않았다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

## 0.5.0 배포 준비

2026-09-18 사용자가 소개 글 확정, 브라우저 시작 화면을 제품 개요로 변경, 검색창 한글 입력 수정, 요구사항 메뉴를 기능별 요구사항으로 변경한 뒤 0.5.0으로 배포하기로 했다. 0.4.4 뒤의 프로젝트 위키·frontmatter ID·에셋·위키 README 방침·CLAUDE.md 생성 커밋도 이 버전에 함께 담는다. 저장 규약이 schemaVersion 2로 바뀌어 0.4.x 프로젝트는 읽지 않고 전환 도구도 없으므로 마이너 버전을 올렸다. `update` 출력 계약은 version 3이다. 이 문서 아래의 0.5.0 기록은 이전 `@tryce/cli` 패키지의 것이며, npm의 `gitifact`는 0.4.4까지 게시돼 있음을 확인했다. runtime dependency가 0.4.4와 같아 제3자 고지 사본은 변경하지 않았다.

`pnpm check`를 통과했다. contracts 7개·core 29개·intro 3개·CLI 133개·브라우저 34개와 workspace 밖 오프라인 설치·실행을 확인했다. 루트 AGENTS.md의 블록은 `pnpm cli update`로 v0.5.0 줄로 갱신했다. CLI 번들 SHA-256은 `38d25063d19d86e9a203a02b67a34c27d9b0344523018bb3a694929db2d98ff4`이다. 모의 게시와 실제 게시는 아직 하지 않았다.

## 0.5.0 게시 완료

2026-09-18 릴리스 커밋 `43edb94`까지 main을 푸시하고(`ba98bbe..43edb94`, 0.4.4 뒤의 미푸시 커밋 6개 포함) apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. 게시 직전 `dist/main.js` 해시가 준비 기록과 같음을 확인했다. npm은 접수 후 몇 분 뒤 공개했다. latest는 0.5.0, 라이선스는 MIT다. 실제 게시와 레지스트리의 integrity는 `sha512-8XS63yGqza6v6f90YgzZNRv9P1lPJL2IV2JA5vbhP8TFp//nXXJlTjU/HcmIhf1UiuNQ82A+FKWnv6K4cERnTw==`, shasum은 `c0e98c4b550e054c85c56e2604262d83965d8b87`이며 패키지는 69개 파일이다. 모의 실행의 integrity(`sha512-Jgz09I…`)는 이전 릴리스처럼 매니페스트 기록 순서 차이로 달랐고 파일 수는 같았다.

레지스트리에서 새 임시 폴더에 로컬로 설치한 dist 66개 파일이 검증 빌드와 모두 같았고, 설치본의 `--version`은 0.5.0, 패치노트는 `## 0.5.0 - 2026-09-18`로 시작한다. 새 Git 저장소에서 설치본 `init`이 schemaVersion 2 설정, v0.5.0 블록, 위키 README를 만들었다. 이 PC의 npm 전역 설치는 변경하지 않았다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

## 0.5.1 배포 준비

2026-09-18 0.5.0 게시 직후 다른 프로젝트에서 도입 프롬프트("gitifact가 없으면 설치")를 받은 에이전트가 이미 설치된 0.4.4로 `init`해 schemaVersion 1 설정을 만들었다. 임시 저장소에서 재현하니 0.5.0은 그 프로젝트의 `spec working`과 `init`을 모두 UNSUPPORTED_SCHEMA로 거부해, 안내대로 새로 init할 수 없었다. 사용자가 권장안 두 가지를 골랐다. `.gitifact`에 설정만 있으면 init이 새 규약으로 교체하고(`replaced`), init이 새 버전을 확인해 알리며(project-init v5), 도입 프롬프트는 설치돼 있어도 `@latest`로 설치한다. 기록이 있는 schemaVersion 1은 계속 전환하지 않는다. runtime dependency는 0.5.0과 같아 제3자 고지 사본은 변경하지 않았다.

`pnpm check`를 통과했다. contracts 7개·core 29개·intro 3개·CLI 136개·브라우저 34개와 workspace 밖 오프라인 설치·실행을 확인했다. 첫 실행에서는 브라우저 업데이트 표시 검사가 소개 페이지 전체에서 "최신 버전" 글자를 찾다가 새 프롬프트 문장에 걸려 실패했고, 검사 범위를 사이드 탐색으로 좁혔다. 0.4.4로 init한 임시 저장소에서 새 빌드의 init이 설정을 교체하고 블록·CLAUDE.md·위키 README를 만든 뒤 `spec working`이 동작함을 확인했다. 루트 AGENTS.md의 블록은 `pnpm cli update`로 v0.5.1 줄로 갱신했다. CLI 번들 SHA-256은 `c5334d52ca6348eabd831744f6551b711658ff6798f0f4b53dc4330d3d68229a`이다. 모의 게시와 실제 게시는 아직 하지 않았다.

## 0.5.1 게시 완료

2026-09-19 릴리스 커밋 `759afec`까지 main을 푸시하고(`cd79089..759afec`) apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. 게시 직전 `dist/main.js` 해시가 준비 기록과 같음을 확인했다. npm은 접수 후 몇 분 뒤 공개했다. latest는 0.5.1, 라이선스는 MIT다. 실제 게시와 레지스트리의 integrity는 `sha512-SaCEfH6B8N2qRGy+rkCRjsAWo16AUKKUZ7Dx9ifmMdBQo4FSF3l/CnBQQrVTqAwZi29AY4xId9Te+BccsZgwtw==`, shasum은 `f14556dce4ff94e9e5f8810295e4a0afde911724`이며 패키지는 69개 파일이다. 모의 실행의 integrity(`sha512-RRXHRu…`)는 이전 릴리스처럼 매니페스트 기록 순서 차이로 달랐고 파일 수는 같았다.

레지스트리에서 새 임시 폴더에 로컬로 설치한 dist 66개 파일이 검증 빌드와 모두 같았고, 설치본의 `--version`은 0.5.1이다. 새 Git 저장소를 레지스트리의 0.4.4로 init해 schemaVersion 1 설정을 만든 뒤, 설치본 0.5.1의 init이 레지스트리 확인을 켠 채 `outcome: "replaced"`, `update.status: "up-to-date"`로 설정을 schemaVersion 2로 바꾸고 `spec working`이 동작함을 확인했다. 이 PC의 npm 전역 설치는 변경하지 않았다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

## 0.6.0 배포 준비

0.5.1 이후의 브라우저 기능과 내장 문체 지침, deprecated 명령 삭제를 담는다. 브라우저는 문서의 mermaid 다이어그램·GitHub 알림을 그리고, `mod+K` 문서 검색과 기능 목록의 설계 여부·참여자·정렬 필터를 제공하며, 제품 개요가 최근 변경 이력을 본문으로 보여 준다. 불러온 이력은 화면을 옮겨도 유지되고 체크아웃은 첫 페이지에만 실린다. `docs writing`이 위키·요구사항·설계에 공통으로 적용하는 문체 지침이다. `spec prepare/verify/commit-plan/commit-apply`는 0.5.0의 예고대로 삭제했다. 변경 내용은 [패치노트](../apps/cli/src/shared/i18n/ko/changelog.md), 작업 기록은 [개발 환경](development.md)에 있다.

`pnpm check`를 통과했다. core 29개·contracts 7개·intro 3개·CLI 123개·브라우저 51개와 workspace 밖 오프라인 설치·실행을 확인했다. CLI 테스트 감소는 삭제한 명령의 테스트 제거에 따른 것이며, 그중 기록 규칙을 보던 검사는 `spec commit` 테스트로 옮겼다. CLI 번들 SHA-256은 `2806f86a927cc221bd96df2ff54ef5dfd145be88ddb13ae997e0937278ea9cc1`이다. 게시 결과는 아래에 이어서 기록한다.

## 0.6.0 게시 완료

2026-09-19 커밋 3170bdc까지 main을 원격에 푸시하고 `apps/cli`에서 Git 검사를 유지한 pnpm publish로 게시했다. latest는 0.6.0, 라이선스는 MIT, 165개 파일이다. 레지스트리 integrity `sha512-Nok5Qr3m8VVz8pjs72qYy0d6URw4ON+iuIPEe55DXvXDgFTZwVYE+J6vyuvYtVuO6qg7OYBsm5opB65ltGpWBQ==`와 shasum `2f651350351a1f4d95878bf2ad4ea4e6247885a5`는 모의 실행 값과 같다. 게시 직후 레지스트리 조회는 404였고 약 3분 뒤 반영됐다.

새 폴더에 레지스트리에서 `gitifact@0.6.0`을 설치해 확인했다. `--version`이 0.6.0을, `docs`가 여섯 항목(writing 포함)을, `docs writing`이 문체 지침 본문을 출력한다. 새 Git 저장소에서 `init`(schemaVersion 2), `spec working --stamp`, `spec save`(S·R 발급), `spec changes`, `spec commit`(커밋 ac2f210, 작업 폴더 깨끗), `spec read`가 동작한다. 삭제한 `spec prepare`는 `unknown command 'prepare'`로 거부한다. 설치된 main.js의 SHA-256은 지정 빌드와 같은 `2806f86a927cc221bd96df2ff54ef5dfd145be88ddb13ae997e0937278ea9cc1`이다.

이 빌드를 프로젝트 사용 대상으로 지정한다. 실행은 `node apps/cli/dist/main.js` 또는 `pnpm cli`다. 직전 지정 빌드는 0.5.0의 `41223f68…`이었다.

## 0.6.1 배포 준비

0.6.0 이후의 브라우저 변경을 담는다. 이력은 `.git/gitifact/index.sqlite`의 로컬 색인(결정 0009)에 두고, 활동의 필터·검색어·건수·페이지와 제품 개요의 집계, 검색창의 지난 변경 찾기를 전체 이력 기준으로 서버가 답한다. 서버 구조는 경로 표(`http/`·`routes/`)로 정리했고 프레임워크는 넣지 않았다. 목록 그리기(Text maxLines 대신 CSS 자르기, 활동 줄 메모이제이션), 검색창 대기 중 빈 상태 깜빡임, 스톤 외 색 조합의 mermaid 색, 위키 로딩 골격, 라이트 모드 글자색·로고, 개요 카드 높이, 아바타 그림을 고쳤다. 브라우저 API 계약은 browser-specs v4(체크아웃만)와 browser-history·browser-history-summary·browser-change·browser-search v1이다. CLI와 브라우저가 한 패키지로 배포되므로 사용자 쪽 호환 문제는 없다. 변경 내용은 [패치노트](../apps/cli/src/shared/i18n/ko/changelog.md), 작업 기록은 [개발 환경](development.md)에 있다.

`pnpm check`를 통과했다. core 29개·contracts 7개·intro 3개·CLI 128개·브라우저 64개와 workspace 밖 오프라인 설치·실행을 확인했다. CLI 번들 SHA-256은 `85d89a1e1b26aa008f3b2d186914196ac2e627aaee5e0f850ad98ff232969509`이다. 게시 결과는 아래에 이어서 기록한다.

## 0.6.1 게시 완료

2026-09-19 커밋 e09a3a7까지 main을 원격에 푸시하고 `apps/cli`에서 Git 검사를 유지한 pnpm publish로 게시했다. latest는 0.6.1, 165개 파일이다. 레지스트리 integrity는 `sha512-MEsfgEGfs+NElTCD7hDLWp23SCJkEmrw99+cu/UNmlwsMDl/PHF6U/ZOyDJsb9l4M/DVdmFja4OscxuTJT2vgg==`, shasum은 `53ff883f90c7b62532eec7585dc35e3c73d388be`다. 모의 실행의 값(`sha512-9OIYe1KH…`, `1d05e41a…`)과 다르다. 0.6.0 때는 같았다. 게시 전후로 빌드·게시 스크립트는 돌지 않았고 로컬 번들 해시도 그대로였다. 레지스트리에서 설치한 파일 164개(package.json 제외)를 로컬 빌드와 하나씩 비교해 모두 같았으므로, 차이는 압축 파일을 만드는 과정에서 생긴 것이고 내용은 같다.

새 폴더에 레지스트리에서 `gitifact@0.6.1`을 설치해 확인했다. `--version`이 0.6.1을 출력하고, 새 Git 저장소에서 `init`, `spec working --stamp`, `spec save`, `spec changes`, `spec commit`이 동작하며 작업 폴더가 깨끗하다. 설치본의 `browser`가 `/api/v1/specs`(v4), `/api/v1/history`(전체 2건), `/api/v1/search`(기능·요구사항·변경 이력)에 답하고, `.git/gitifact/index.sqlite`를 만들며 표준 오류에 아무것도 쓰지 않는다(`node:sqlite` 경고 없음, Node 24.17). 설치된 main.js의 SHA-256은 지정 빌드와 같은 `85d89a1e1b26aa008f3b2d186914196ac2e627aaee5e0f850ad98ff232969509`이다.

이 빌드를 프로젝트 사용 대상으로 지정한다. 실행은 `node apps/cli/dist/main.js` 또는 `pnpm cli`다. 직전 지정 빌드는 0.6.0의 `2806f86a…`였다.

## 이전 Tryce 배포 기록

아래 패키지 이름·버전·커밋·무결성은 당시 배포의 사실이다. Gitifact 0.1.0의 게시 결과로 해석하거나 새 이름으로 일괄 치환하지 않는다.

## 0.1.0 게시 시도

2026-09-13 배포 준비 커밋 c4108d5에서 96개 테스트·오프라인 설치 검증과 publish dry-run을 통과했다. 실제 게시에서는 npm이 E403을 반환했다. 로그인 계정은 dev.goraebap이며, 서버가 2단계 인증 또는 bypass 2FA 게시 토큰을 요구했다. 계정 보안 설정은 변경하지 않았다. 게시 후 조회도 404였으므로 npm 배포·레지스트리 설치 확인은 아직 완료되지 않았다.

당시 검증 파일은 `.tmp/releases/0.1.0/tryce-0.1.0.tgz`, integrity는 `sha512-ICEs8xGotWnNKqWG1pp5J0xTgCc0+V1IxjCg1AEBCqEHQKiZx4sg5x0Fmqt6COi10t1JATR8C9TUHhaHA+I+/A==`다. 이 파일은 과거 검증 자료로 보존한다. 이후 사용자 결정에 따라 게시 기준을 `apps/cli`로 바꿨으며, 재개할 때는 위의 패키지 폴더 절차를 따른다. 인증 코드·토큰은 문서에 남기지 않는다.

같은 날 사용자가 제공한 토큰을 프로세스 환경변수로 전달해 재시도했으나 같은 2FA 요구 E403이 반환됐다. 임시 인증 설정은 제거했고 토큰 값은 저장소에 기록하지 않았다. 게시용 인증 조건을 충족한 뒤 재개해야 한다.

다음 토큰 재시도에서는 E_STAGE_REQUIRED가 반환됐다. 서버는 해당 토큰을 stage-only로 판정했으며 아직 존재하지 않는 tryce를 최초 생성하려면 direct publish 권한이 필요하다고 응답했다. 이 시도에서도 게시되지 않았고 임시 인증 설정을 제거했다.

패키지 폴더 방식으로 변경한 뒤 `apps/cli`에서 pnpm publish 모의 실행을 통과했다. 파일 15개와 integrity가 앞서 검증한 압축 파일과 일치했다. 이 확인은 문서 편집·미푸시 상태에서 패키징만 검증하기 위해 `--dry-run --json --publish-branch main --no-git-checks`로 수행했다. 실제 게시 절차의 Git 검사는 유지하며 원격 게시·인증 성공을 검증한 것은 아니다.

## @tryce/cli 이름 변경

2026-09-13 클로드의 인계에 따르면 이후 재시도에서도 E_STAGE_REQUIRED가 발생했다. 사용자가 계정 2FA를 활성화하고 npm login을 수행한 뒤에는 `E403 Package name too similar to existing packages tracer,brace`로 거부됐다. 이 경과는 인계된 결과이며 이번 작업에서 직접 재현하지 않았다. 2FA 우회 토큰의 정책 변경이 이미 시행됐다는 추정은 오류만으로 확정하지 않는다.

사용자는 공개 이름을 `@tryce/cli`로 결정했다. 개인 계정에 종속되는 `@dev.goraebap/tryce`와 유사도 검사를 다시 받을 수 있는 `tryce-cli`는 채택하지 않았다. 실행 명령 `tryce`, 버전 0.1.0, MIT, 게시 폴더 apps/cli는 유지한다. 이전 이름의 게시 시도·무결성 값은 과거 기록으로 보존한다.

현재 인증으로 `npm org ls tryce --json`을 실행했으나 `E403: You may not perform that action with these credentials.`가 반환됐다. 이 응답으로 조직 이름의 사용 가능 여부나 조직 생성 여부를 단정할 수 없다. 인증 관련 작업은 중단했으며 조직·게시 권한 확인은 사용자에게 남긴다. 로컬 패키지 준비와 원격 게시 성공을 구분한다.

이름 변경 후 고정 lockfile 설치와 pnpm check를 통과했다. 테스트 96개와 workspace 밖 오프라인 설치에서 `@tryce/cli` 패키지 이름, `tryce` 실행 명령, init·note·brief·status·스킬·브라우저 동작을 확인했다. 앱 코드와 지정된 CLI 빌드 해시는 바뀌지 않았다.

apps/cli에서 모의 게시한 결과는 `@tryce/cli@0.1.0`, 파일 15개, integrity `sha512-oiGZ2zgcZ2R9JNBrJhS6cJPBwKBP9z36lJYiWPvsI7IiVRoY8LkFbMJ1HtFHMJr5Q4owdAs6XzpjAJEddWR1kg==`다. 이번에도 문서 편집·미푸시 상태의 패키징 확인에만 `--dry-run --json --publish-branch main --no-git-checks`를 사용했다. 실제 npm 게시·Git 푸시·레지스트리 설치 확인은 수행하지 않았다.

## 0.1.0 게시 완료

2026-09-13 사용자가 조직을 생성하고 인증을 교체한 뒤 npm org ls tryce에서 dev.goraebap의 owner 권한을 확인했다. 배포 요청에 따라 main의 633e6eb까지 Git 푸시하고, apps/cli에서 Git 검사를 유지한 pnpm publish를 실행했다. `@tryce/cli@0.1.0` 공개 게시가 성공했으며 latest는 0.1.0이다.

최종 모의 실행 중 pnpm 10.33.0이 배포 매니페스트의 @tryce/core와 @tryce/contracts 키를 서로 다른 순서로 기록해 압축 파일 해시가 달라지는 것을 확인했다. 두 패키지의 매니페스트 값은 같고 나머지 14개 파일은 바이트 단위로 일치했다. 실제 게시 결과와 레지스트리의 integrity는 모두 `sha512-oiGZ2zgcZ2R9JNBrJhS6cJPBwKBP9z36lJYiWPvsI7IiVRoY8LkFbMJ1HtFHMJr5Q4owdAs6XzpjAJEddWR1kg==`로, 앞서 검증한 값과 일치했다.

게시 직후 일반 이름 조회가 잠시 404를 반환했으나 이후 npm view로 버전·MIT·latest·integrity를 확인했다. workspace 밖 새 임시 Git 프로젝트에 레지스트리 배포 파일을 설치해 무결성, version/help, init·note·brief·status·skills와 브라우저 정적 자산을 검증했다. .tmp/demo는 npm install --save-exact @tryce/cli@0.1.0으로 갱신하고 버전·brief를 확인했다. 기존 .tryce 파일의 SHA-256은 설치 전후 일치했다.

## 0.2.0 배포 준비

2026-09-13 사용자 배포 요청으로 검증된 0.2.0-dev.0을 0.2.0으로 준비했다. 신규 auto 기본값, approval 묶음 확인, 요구사항 원문·수정본 보존, 커밋 계획·실행을 포함한다. 기존 프로젝트의 모드·기준선은 자동 전환하지 않는다. README의 도입 프롬프트와 패키지 안내를 새 버전에 맞췄다.

구현 커밋 65179f8의 전체 테스트 109개 통과 결과를 기준으로 버전·안내만 변경하고 CLI를 다시 빌드했다. `pnpm test:package`로 workspace 밖 오프라인 설치, legacy 전환·요구사항 승인·note·brief·스킬·브라우저를 재검증했다. 별도 패키지 검증용 스크립트 항목을 루트에 추가했다.

apps/cli의 모의 게시 결과는 파일 15개, integrity `sha512-0ep8EQ1Y/ACY1qlWpfIekRU66bUsi/QzbHBv9UP5ZtJKDJhuFKckgvPRtZXzrRLbUAcVtAKXyftYyJVqyW0jHg==`다. 패키지·README·LICENSE·dist 외의 소스, 프로젝트 기록, 인증 파일이 포함되지 않음을 확인했다. 모의 실행에만 `--no-git-checks`를 사용했고 실제 게시에는 Git 검사를 유지한다.

## 0.2.0 게시 완료

2026-09-13 릴리스 준비 커밋 `8f3ac1b`까지 main을 푸시하고 apps/cli에서 Git 검사를 유지한 `pnpm publish --access public --tag latest --publish-branch main --json`을 실행했다. `@tryce/cli@0.2.0` 공개 게시가 성공했으며 레지스트리의 latest는 0.2.0, 라이선스는 MIT다. 실제 게시와 레지스트리의 integrity는 위 모의 실행 값과 일치했다. 기존 인증 세션을 사용했고 인증 설정은 변경하지 않았다.

레지스트리에서 새 시험 프로젝트에 설치한 CLI가 검증 빌드와 바이트 단위로 같음을 확인했다. 설치 버전, 신규 auto 초기화, note, 요구사항 초안·자동 확정, approval 전환·묶음 승인, brief를 실행해 통과했다. 이 기록은 자동화 시험용 확인이며 실제 제품 요구사항의 사용자 승인으로 해석하지 않는다.

`.tmp/demo`도 레지스트리의 0.2.0으로 갱신했다. 설치 전후 `.tryce` 파일의 SHA-256 목록이 일치했고 기존 prototype / prototype-1 상태의 brief를 확인했다. 모드·기준선·note·스킬 원본을 새 형식으로 자동 전환하지 않았다. 검증 로그와 별도 시험 프로젝트는 `.tmp/validation-archive/2026-09-13/`에 보존한다.

## 0.2.1 배포 준비

사용자가 정한 버전은 0.2.1이다. 신규 요구사항의 저장 위치를 `.tryce/spec/<영역>/tryce.json`으로 정정하고 조회·brief·이력 보존 검사·커밋 처리를 함께 맞췄다. 0.2.0이 생성한 루트 `specs/` 기록은 기존 위치에서 계속 읽고 갱신하며, 같은 영역이 양쪽에 있으면 중단한다. 자동 파일 이동은 포함하지 않는다. 새 경로를 공유하는 에이전트는 모두 0.2.1 이상을 사용해야 한다.

공용 스킬의 기본 안내는 자동모드·승인모드 중심으로 정리하고 내부 저장 형식 설명은 이전 버전 호환성 절로 분리했다. 기존 프로젝트의 요구사항 도출은 특정 문서 폴더 이동이 아니라 이용 가능한 프로젝트 맥락을 근거로 하는 흐름임을 제품 기준에 명시했다. AGENTS.md·CLAUDE.md의 자동 생성·연결은 아직 구현 범위에 포함하지 않는다. npm 게시와 원격 푸시는 수행하지 않았다.

`pnpm check`에서 타입 검사, 테스트 111개, workspace 밖 오프라인 패키지 설치·실행을 통과했다. 설치한 패키지의 요구사항 승인·brief가 새 저장 위치를 반환하고 루트 specs를 만들지 않는 것도 확인했다. 검증한 프로젝트 사용 빌드는 [개발 환경](development.md)에 기록했다.

## 0.2.1 게시 완료

2026-09-13 사용자 요청에 따라 `d7058b6`을 main에 푸시하고 `apps/cli`에서 Git 검사를 유지한 pnpm publish로 `@tryce/cli@0.2.1`을 공개 게시했다. latest는 0.2.1, 라이선스는 MIT다. 모의 실행·실제 게시·레지스트리의 integrity는 모두 `sha512-Xlc01hmqYAJQYZczaXwdAFO4y9UuRVWMm8VCNkynv1q4bz2L8c5brTtOLVzhmQB8osbfteu8tjy2DlGIo3jz7Q==`이며 패키지는 15개 파일이다.

레지스트리에서 새 시험 폴더에 설치한 CLI와 스킬의 SHA-256이 검증한 로컬 파일과 일치했다. 별도 Git 프로젝트에서 버전, init, 요구사항 초안·묶음·자동 확정, brief와 `.tryce/spec/` 경로를 확인했다. `.tmp/demo`도 0.2.1로 갱신했고 `.tryce` 전체 파일의 해시가 설치 전후 동일하며 기존 형식의 brief가 정상임을 확인했다. 시험 자료는 `.tmp/validation-archive/2026-09-13/registry-0.2.1/`에 보존한다. 이 개발 저장소는 기존 prototype-1을 유지하므로 이번 커밋은 DEV-03을 적용한 기본 Git 커밋이다.

## 0.3.0 배포 준비

2026-09-14 사용자 푸시·배포 요청으로 읽기 전용 요구사항 브라우저와 조회 성능 개선을 0.3.0에 포함한다. 브리핑·요구사항 검색과 상세·수정본 및 확인 문서·판단 note를 제공하며 자동 확정과 사용자 승인을 구분한다. 중복 workflow 검증 제거, Git 원문 배치 조회, 입력을 재확인하는 서버 캐시를 포함한다. 기존 설정·기준선·기록 형식과 읽기 전용 범위는 유지한다.

기능 커밋 f174434의 최종 타입 검사·빌드, 테스트 121개와 workspace 밖 오프라인 설치 검증을 기준으로 패키지 버전과 사용 안내를 갱신했다. 공개 npm 버전은 0.2.1이므로 새 기능을 포함한 0.3.0을 사용한다. 실제 첫 요청·재요청·변경 후 측정과 남은 목표는 [개발 환경](development.md#2026-09-14-브라우저-조회-성능)에 기록했다.

0.3.0 버전으로 CLI를 다시 빌드하고 `pnpm test:package`의 오프라인 설치·실행 검증을 통과했다. 공개 전 소스·프로젝트 기록·인증 파일이 포함되지 않는지 모의 게시로 확인하며 실제 게시는 apps/cli에서 Git 검사를 유지해 수행한다.

## 0.3.0 게시 완료

2026-09-14 릴리스 준비 커밋 `19c90f2`까지 main을 푸시하고, apps/cli에서 Git 검사를 유지한 pnpm publish로 `@tryce/cli@0.3.0`을 공개 게시했다. latest는 0.3.0, 라이선스는 MIT다. 모의 게시·실제 게시·레지스트리의 integrity는 모두 `sha512-ko1BHa/q3iYIOQGmK5iH0wZi4G2TGJr2DOtAsE6Q2pglP691Z9t9KvezYQkXI6Ppgn7/+ySVhAKUdqWZvDcNGg==`다. 파일 27개에 CLI·브라우저 자산·스킬·라이선스 고지와 패키지 안내만 포함됐으며 소스·테스트·프로젝트 기록·인증 파일은 제외됐다.

레지스트리 설치본의 dist 전체가 검증한 로컬 빌드와 바이트 단위로 일치했다. 새 시험 Git 저장소에서 version/help, auto 초기화, 요구사항 초안·묶음·자동 확정, brief/status, 실제 브라우저 project API와 정적 경로를 확인했다. 같은 입력의 관측 ID 재사용과 note 추가 후 새 관측·내용 반영도 통과했다. 확인은 Fixture의 자동화 시험이며 사용자 승인으로 기록하지 않았다.

`.tmp/demo`도 레지스트리의 0.3.0으로 갱신했다. 기존 `.tryce` 파일 8개의 SHA-256은 설치 전후 일치했고 approval / workflow-1 설정과 요구사항 3개를 기존 상태로 조회했다. 스킬 원본·모드·기준선은 변경하지 않았다. 모의·실제 게시 로그와 설치 검증 자료는 `.tmp/releases/0.3.0/`에 보관한다. 기존 인증 세션을 사용했으며 인증 파일이나 토큰은 조회·편집하지 않았다.

## 다음 릴리스의 구형 명령 폐기 예고

개발 빌드에서 req·note·mode·init --mode를 deprecated로 표시했다. 다음 공개 릴리스에 이 안내를 포함하며 현재 0.3.0 배포물은 변경하지 않았다. 구형 명령·쓰기 코드의 제거는 새 도입·전환 수단과 과거 Git 기록 조회 범위를 검증한 후 진행한다. 개발 작업 횟수만으로 제거 날짜를 확정하지 않는다. 새 명세 명령은 spec이며 spec-preview는 실험용 호환 진입점으로 남긴다.

## 0.4.0 배포 준비

Markdown 명세·변경 이유·Git 커밋 연결과 요구사항 이력·제품 기능·기여자 브라우저를 배포한다. 새 설정은 schemaVersion 1이며 기존 JSON 프로젝트를 자동 전환하지 않는다. req·note·mode는 deprecated 호환 명령으로 유지한다. 새 형식의 brief와 승인·note, 자동 마이그레이션은 지원하지 않는다.

구현 커밋 8958603에서 pnpm check 전체(172개 테스트와 패키지 설치·실행)를 통과했다. 버전·배포 안내 변경 후 패키징을 다시 검증한다. 실제 게시 결과는 별도로 기록한다.

## 0.4.0 게시 결과

2026-09-14 릴리스 커밋 4fb9c68을 main에 푸시하고 `apps/cli`에서 Git 검사를 유지한 pnpm publish로 공개 게시했다. latest는 0.4.0이다. 모의 게시와 레지스트리 integrity는 `sha512-2+YX7ZBIofy0SdOqKs6QcFvmicaslJacJf/ppJTu/GvIjLlkvngp0brbaYgADaYF6MFA49XbJpq9fKBqI6LTkg==`로 일치한다. 배포물 282개 파일은 dist·README·LICENSE·package.json 범위에 한정됐다.

레지스트리 설치본의 dist 전체가 로컬 검증 빌드와 바이트 단위로 일치했다. 새 Git 시험 프로젝트에서 버전·도움말·schemaVersion 1 초기화·명세 작성·브라우저 API와 정적 기능 경로를 확인했다. `.tmp/demo`도 0.4.0으로 갱신했고 기존 .tryce 파일의 해시는 모두 유지됐다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.

## 0.5.0 배포 준비

이유 기록과 관련 파일 커밋을 한 명령으로 하는 `spec commit`, 구형 명령 삭제, CRLF checkout 커밋 수정, 브라우저 SVG 워드마크를 배포한다. `spec prepare/verify/commit-plan/commit-apply`는 deprecated이며 0.6.0에서 제거한다. req·note·mode·brief·구형 commit·init --mode·spec-preview는 삭제했으므로 기존 JSON 프로젝트는 0.4.0 이하 CLI로 읽는다. 설계와 측정은 [MVP 전환 계획](mvp-transition.md)의 단일 커밋 명령 절과 [개발 환경](development.md)을 따른다.

로고 커밋 af6503e와 CLI 커밋 e808f68 기준으로 `pnpm install --frozen-lockfile`과 `pnpm check`를 통과했다. core 14개·contracts 4개·CLI 100개·브라우저 17개·스킬 5개와 workspace 밖 패키지 설치·실행을 확인했다. CLI 번들 SHA-256은 지정 빌드와 같은 `41223f684db38ea8d8032d6e30a6535b1dcd75ce96d2421887638acf378e1e83`이다. 구형 형식 시험용 `.tmp/demo`는 새 버전이 읽지 않으므로 더 이상 갱신·확인하지 않으며 게시 확인 절차에서 뺐다.

## 0.5.0 게시 결과

2026-09-15 준비 커밋 75db585까지 main을 푸시하고 `apps/cli`에서 Git 검사를 유지한 pnpm publish로 공개 게시했다. latest는 0.5.0, 라이선스는 MIT다. 모의 게시·실제 게시·레지스트리의 integrity는 모두 `sha512-hLeY9nUCHa1P6Eje+s7R4u4rWG7saPUK1sovRKBlZ8Ni9HlDSwA3izo1HHcWQEYfChqK/F82/G9xCWjNQ5AKMA==`다. 배포물 281개 파일은 dist·README·LICENSE·package.json 범위에 한정됐고 SVG 로고가 포함되고 Unbounded 폰트는 빠졌다.

레지스트리에서 새 폴더에 설치한 dist 278개 파일이 로컬 검증 빌드와 바이트 단위로 일치했고 main.js는 지정 빌드 해시와 같다. 새 Git 시험 프로젝트에서 version·help(삭제한 명령 없음), schemaVersion 1 초기화, spec save, spec commit dry-run·실행, spec read와 깨끗한 작업 폴더를 확인했다. 브라우저 서버의 명세 API와 로고 경로는 응답했고 제거한 project API는 404였다. 확인 스크립트와 로그는 `.tmp/releases/0.5.0/`에 보관한다. 기존 인증 세션으로 게시했으며 인증 파일과 토큰은 조회·변경하지 않았다.
