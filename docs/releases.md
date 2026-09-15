# npm 배포

공개 패키지는 `apps/cli`의 `gitifact` 하나다. 설치는 `npm install -g gitifact`, 실행 명령은 `gitifact`다. 루트 workspace와 공통 패키지·브라우저는 private으로 유지한다. 첫 배포 버전은 0.1.0, 사용자가 선택한 라이선스는 MIT다. Node.js 24.x와 Git이 필요하며 현재 실행 검증 환경은 Windows다.

## 준비와 게시

저장소 루트에서 의존성을 설치하고 빌드·테스트한다. 아래 명령은 Git Bash에서도 그대로 사용한다.

```sh
pnpm install --frozen-lockfile
pnpm check
```

검증한 변경을 커밋하고 게시 브랜치 `main`을 원격과 맞춘 뒤, 패키지 폴더에서 게시한다. pnpm은 브랜치·작업 폴더·원격 상태를 검사한다. Git 푸시는 별도로 요청받은 범위에서 수행한다.

```sh
cd apps/cli
pnpm publish --dry-run --json --publish-branch main
pnpm publish --access public --tag latest --publish-branch main
```

게시 기준은 `apps/cli/package.json`이다. `files: ["dist"]`로 빌드 결과를 포함하며 README·LICENSE·package.json도 함께 묶인다. `dist`를 독립 패키지 폴더로 만들거나 `.tmp`에 게시용 압축 파일을 먼저 둘 필요는 없다. pnpm을 사용해 `workspace:` 의존성을 게시 가능한 버전으로 변환한다. [pnpm publish](https://pnpm.io/cli/publish), [workspace 패키지 게시](https://pnpm.io/workspaces#publishing-workspace-packages).

모의 실행에서 파일 목록·버전·integrity를 확인하고 게시까지 소스·설정·빌드 결과를 바꾸지 않는다. 변경했다면 검증부터 다시 수행한다. 게시 이후 같은 이름·버전을 덮어쓰지 않고 수정 버전을 발급한다. 게시 권한·추가 인증이 필요하면 npm이 제공하는 절차를 따른다. 자격 증명을 저장소나 로그에 기록하지 않는다. [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

압축 파일에는 번들 CLI, 브라우저 정적 자산, 스킬 원본, 사용 안내, MIT 라이선스와 제3자 고지만 포함한다. 실행 의존성을 번들해 내부 private 패키지의 게시를 요구하지 않는다. 소스·테스트·프로젝트 기록·인증 파일은 배포하지 않는다. npm 설치 시 실행하는 lifecycle script도 없다.

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
