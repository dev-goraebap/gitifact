# npm 배포

공개 패키지는 `apps/cli`의 `@tryce/cli` 하나다. 설치는 `npm install -g @tryce/cli`, 실행 명령은 `tryce`다. 루트 workspace와 공통 패키지·브라우저는 private으로 유지한다. 첫 배포 버전은 0.1.0, 사용자가 선택한 라이선스는 MIT다. Node.js 24.x와 Git이 필요하며 현재 실행 검증 환경은 Windows다.

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
npm view @tryce/cli@0.2.1 version license dist.integrity
```

레지스트리 integrity를 실제 게시 결과와 비교하고, 새 시험 폴더에 레지스트리에서 설치해 버전·help와 실제 Git 프로젝트 명령을 실행한다. 모의 실행과 해시가 다르면 게시 전에 파일 내용과 배포 매니페스트를 비교해 원인을 확인한다. `.tmp/demo`의 기존 기록을 보존하며 의존 패키지를 갱신한다. 로컬 검증·원격 게시·설치 확인의 성공 여부를 각각 기록한다.

Git 커밋과 npm 게시를 구분한다. 검증한 변경은 커밋하며, Git 원격 푸시는 별도로 요청받은 범위에서 수행한다.

게시에는 npm의 `tryce` 조직과 해당 계정의 게시 권한이 필요하다. 조직 생성·계정·보안 설정은 사용자가 관리한다. 사용자가 게시나 푸시를 요청하면 기존 인증 세션으로 직접 실행한다. 인증 오류 또는 OTP 입력 요청이 나오면 중단하고 코드·메시지를 사용자에게 전달한다. 토큰 생성·등록·삭제, 인증 파일 편집·토큰 값 조회, 실제 게시의 `--no-git-checks` 사용은 하지 않는다. 조직 이름을 사용할 수 없으면 대체 이름을 임의로 선택하지 않는다.

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
