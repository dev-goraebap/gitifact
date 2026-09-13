# npm 배포

공개 패키지는 `apps/cli`의 `tryce` 하나다. 루트 workspace와 공통 패키지·브라우저는 private으로 유지한다. 첫 배포 버전은 0.1.0, 사용자가 선택한 라이선스는 MIT다. Node.js 24.x와 Git이 필요하며 현재 실행 검증 환경은 Windows다.

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
npm view tryce@0.1.0 version license dist.integrity
```

레지스트리 integrity를 게시 모의 실행 결과와 비교하고, 새 시험 폴더에 레지스트리에서 설치해 버전·help와 실제 Git 프로젝트 명령을 실행한다. `.tmp/demo`의 기존 기록을 보존하며 의존 패키지를 갱신한다. 로컬 검증·원격 게시·설치 확인의 성공 여부를 각각 기록한다.

Git 커밋과 npm 게시를 구분한다. 검증한 변경은 커밋하며, Git 원격 푸시는 별도로 요청받은 범위에서 수행한다.

## 0.1.0 게시 시도

2026-09-13 배포 준비 커밋 c4108d5에서 96개 테스트·오프라인 설치 검증과 publish dry-run을 통과했다. 실제 게시에서는 npm이 E403을 반환했다. 로그인 계정은 dev.goraebap이며, 서버가 2단계 인증 또는 bypass 2FA 게시 토큰을 요구했다. 계정 보안 설정은 변경하지 않았다. 게시 후 조회도 404였으므로 npm 배포·레지스트리 설치 확인은 아직 완료되지 않았다.

당시 검증 파일은 `.tmp/releases/0.1.0/tryce-0.1.0.tgz`, integrity는 `sha512-ICEs8xGotWnNKqWG1pp5J0xTgCc0+V1IxjCg1AEBCqEHQKiZx4sg5x0Fmqt6COi10t1JATR8C9TUHhaHA+I+/A==`다. 이 파일은 과거 검증 자료로 보존한다. 이후 사용자 결정에 따라 게시 기준을 `apps/cli`로 바꿨으며, 재개할 때는 위의 패키지 폴더 절차를 따른다. 인증 코드·토큰은 문서에 남기지 않는다.

같은 날 사용자가 제공한 토큰을 프로세스 환경변수로 전달해 재시도했으나 같은 2FA 요구 E403이 반환됐다. 임시 인증 설정은 제거했고 토큰 값은 저장소에 기록하지 않았다. 게시용 인증 조건을 충족한 뒤 재개해야 한다.

다음 토큰 재시도에서는 E_STAGE_REQUIRED가 반환됐다. 서버는 해당 토큰을 stage-only로 판정했으며 아직 존재하지 않는 tryce를 최초 생성하려면 direct publish 권한이 필요하다고 응답했다. 이 시도에서도 게시되지 않았고 임시 인증 설정을 제거했다.

패키지 폴더 방식으로 변경한 뒤 `apps/cli`에서 pnpm publish 모의 실행을 통과했다. 파일 15개와 integrity가 앞서 검증한 압축 파일과 일치했다. 이 확인은 문서 편집·미푸시 상태에서 패키징만 검증하기 위해 `--dry-run --json --publish-branch main --no-git-checks`로 수행했다. 실제 게시 절차의 Git 검사는 유지하며 원격 게시·인증 성공을 검증한 것은 아니다.
