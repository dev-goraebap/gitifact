# npm 배포

공개 패키지는 `apps/cli`의 `tryce` 하나다. 루트 workspace와 공통 패키지·브라우저는 private으로 유지한다. 첫 배포 버전은 0.1.0, 사용자가 선택한 라이선스는 MIT다. Node.js 24.x와 Git이 필요하며 현재 실행 검증 환경은 Windows다.

## 준비와 게시

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm --filter tryce pack --pack-destination .tmp/releases/0.1.0
npm publish ./.tmp/releases/0.1.0/tryce-0.1.0.tgz --dry-run --json
npm publish ./.tmp/releases/0.1.0/tryce-0.1.0.tgz --access public --tag latest
```

예시 경로의 버전은 해당 릴리스에 맞춘다. 검증한 압축 파일을 그대로 게시한다. 게시 이후 같은 이름·버전을 덮어쓰지 않고 수정 버전을 발급한다. 게시 권한·추가 인증이 필요하면 npm이 제공하는 절차를 따른다. 자격 증명을 저장소나 로그에 기록하지 않는다. [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

압축 파일에는 번들 CLI, 브라우저 정적 자산, 스킬 원본, 사용 안내, MIT 라이선스와 제3자 고지만 포함한다. 실행 의존성을 번들해 내부 private 패키지의 게시를 요구하지 않는다. 소스·테스트·프로젝트 기록·인증 파일은 배포하지 않는다. npm 설치 시 실행하는 lifecycle script도 없다.

빌드는 runtime dependency의 라이선스 본문을 모아 `dist/THIRD_PARTY_NOTICES.txt`를 만든다. 배포 패키지에 빠진 Astryx·StyleX 고지는 [출처가 고정된 사본](../apps/cli/licenses/README.md)을 사용한다. 버전을 바꾸면 해당 사본과 고지를 다시 검토한다.

## 게시 확인

```sh
npm view tryce@0.1.0 version license dist.integrity
```

레지스트리 integrity를 검증한 압축 파일과 비교하고, 새 시험 폴더에 레지스트리에서 설치해 버전·help와 실제 Git 프로젝트 명령을 실행한다. `.tmp/demo`의 기존 기록을 보존하며 의존 패키지를 갱신한다. 로컬 검증·원격 게시·설치 확인의 성공 여부를 각각 기록한다.

Git 커밋과 npm 게시를 구분한다. 검증한 변경은 커밋하며, Git 원격 푸시는 별도로 요청받은 범위에서 수행한다.

## 0.1.0 게시 시도

2026-09-13 배포 준비 커밋 c4108d5에서 96개 테스트·오프라인 설치 검증과 publish dry-run을 통과했다. 실제 게시에서는 npm이 E403을 반환했다. 로그인 계정은 dev.goraebap이며, 서버가 2단계 인증 또는 bypass 2FA 게시 토큰을 요구했다. 계정 보안 설정은 변경하지 않았다. 게시 후 조회도 404였으므로 npm 배포·레지스트리 설치 확인은 아직 완료되지 않았다.

인증 준비 후 같은 검증 파일로 게시를 재개한다. 파일은 `.tmp/releases/0.1.0/tryce-0.1.0.tgz`, integrity는 `sha512-ICEs8xGotWnNKqWG1pp5J0xTgCc0+V1IxjCg1AEBCqEHQKiZx4sg5x0Fmqt6COi10t1JATR8C9TUHhaHA+I+/A==`다. 인증 코드·토큰은 문서에 남기지 않는다.

같은 날 사용자가 제공한 토큰을 프로세스 환경변수로 전달해 재시도했으나 같은 2FA 요구 E403이 반환됐다. 임시 인증 설정은 제거했고 토큰 값은 저장소에 기록하지 않았다. 게시용 인증 조건을 충족한 뒤 재개해야 한다.
