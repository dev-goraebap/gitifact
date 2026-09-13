# 개발 환경

현재 CLI의 `init`으로 설정·도입 기준선을 만들고 `note`로 프로토타입 기록을 추가·조회한다. `brief`는 작업 시작에 필요한 현재 자료와 원문 위치를 제공한다. `status`와 `browser`는 Git 상태를 조회한다. 브라우저에서 저장소·HEAD·변경 경로를 확인하고 새로고침한다. 개발용 스킬 연결은 아래 절차로 준비한다. 요구사항 기록·검사와 제품의 스킬 설치·훅은 지원 범위 밖이다.

## 사용자 프로젝트 시험과 첫 npm 배포

2026-09-13 사용자 지정으로 `tmp/demo`에 독립 Git 저장소를 두고 prototype 모드의 도입·사용 흐름을 시험한다. 상위 저장소에서는 `/tmp/demo/`를 ignore한다. 이곳은 지속해서 살펴볼 데모이며 자동 테스트의 매번 새로 만드는 임시 저장소를 대체하지 않는다. 기존 데모는 자동 삭제·재초기화하지 않는다.

현재는 demo에서 `node ../../apps/cli/dist/main.js`로 지정된 로컬 빌드를 실행한다. 스킬 설치 기능이 준비되면 pack한 설치물로 같은 흐름을 시험한다. 중첩 저장소에서 상위 workspace의 의존성이 보일 수 있으므로 운영체제 임시 폴더의 오프라인 패키지 설치 검증도 유지한다.

사용자가 요청한 공개 npm 패키지 이름은 `tryce`다. 스킬 설치·갱신·제거와 demo 사용, workspace 밖 설치 검증을 마친 뒤 첫 배포를 진행한다. 배포 직전에 이름 사용 가능 여부와 계정 게시 권한, 패키지 내용·라이선스·버전·문서를 확인한다. 현재 `@tryce/cli`는 private 개발 패키지이며 이름을 확보하거나 npm에 게시한 상태가 아니다. 공개 이름 전환과 첫 배포는 후속 배포 작업에서 함께 수행한다.

## 개발 에이전트 사용

Codex는 `.agents/skills/tryce-workflow/SKILL.md`를 원본으로 사용한다. Claude Code로 이 저장소를 작업할 때는 `pnpm skills:sync`로 로컬 복사본을 생성하고 `pnpm skills:check`로 일치를 확인한다. 사용자 전역 설정은 바꾸지 않는다. 원본 변경 후 sync를 다시 실행한다. 상세 보존·복구·제거 절차는 [스킬 연결](specs/agent-skills.md)을 따른다.

스킬에서 예시로 쓰는 `tryce`는 이 저장소에서 `pnpm cli`다. 기계 출력이 필요하면 `node apps/cli/dist/main.js`를 사용한다. 기존에 지정한 CLI 빌드를 유지한다. 개발용 스킬 동기화는 2026-09-13 임시 폴더 테스트 5개와 스킬 형식 검증을 통과했다. DEV-04는 유지한다.

## 준비와 실행

개발 기준은 Node.js 24.17.0과 pnpm 10.33.0이다. `.node-version`과 루트 `packageManager`에 고정했다. 현재 패키지는 private이며 Node.js 24 계열만 개발 대상으로 선언한다. 공개 CLI의 이름과 지원 런타임은 배포 단계에서 다시 정한다.

pnpm이 없는 환경에서는 `npx pnpm@10.33.0`을 아래 명령의 `pnpm` 대신 사용할 수 있다. 전역 도구나 사용자 설정을 바꿀 필요는 없다.

저장소 루트에서 실행한다.

```sh
pnpm install --frozen-lockfile
pnpm browser:install
pnpm check
```

`browser:install`은 Playwright 검증용 Chromium을 사용자 캐시에 내려받는다. Linux에서 브라우저 실행에 필요한 시스템 라이브러리가 없으면 해당 환경에 맞게 준비해야 한다. 현재 실행 검증 환경은 Windows다.

```sh
pnpm build
pnpm cli browser
```

현재 checkout을 읽는 서버가 127.0.0.1의 빈 포트에서 실행된다. 터미널에 표시된 URL로 접속하고 Ctrl+C로 종료한다. 브라우저는 자동으로 열지 않는다. 화면은 Git 연결을 확인하는 용도이며 클로드의 와이어프레임을 구현한 결과가 아니다.

화면 개발 중에는 두 터미널에서 각각 실행한다.

```sh
pnpm cli browser --dev --port 4317
```

```sh
pnpm dev
```

Vite 주소는 `http://127.0.0.1:5173`이다. `/api`를 CLI 서버로 전달한다. API 포트를 바꾸려면 Vite 실행 환경의 `TRYCE_API_PORT`도 맞춘다. 통합 실행은 `--dev` 없이 사용한다. 상세 계약은 [로컬 브라우저 서버](specs/browser-server.md)를 따른다.

```sh
pnpm build
pnpm cli --help
pnpm cli --version
pnpm cli status --format text
```

CLI는 현재 인자 없이 실행하면 도움말을 표시한다. 도움말·버전 출력은 stdout과 종료 코드 0을 사용하고, 지원하지 않는 명령·옵션은 stderr와 종료 코드 1로 거부한다. 이후 제품 검사 결과의 종료 코드 계약은 별도로 명세한다.

status의 기본 형식은 JSON이다. 성공은 stdout·종료 코드 0, 조회 실패는 stderr·종료 코드 1을 사용한다. 기계가 출력을 읽을 때는 pnpm의 실행 안내가 섞이지 않도록 빌드한 실행 파일을 직접 호출한다.

```sh
node apps/cli/dist/main.js status
```

다른 프로젝트에서는 빌드한 `apps/cli/dist/main.js`의 절대 경로로 실행한다. 실행 위치의 checkout을 조회한다. 파일 변경이 없거나 충돌이 있어도 tryce 검사는 항상 미실행으로 표시한다. 상세 계약은 [저장소 상태 조회](specs/repository-status.md)를 따른다.

CLI를 수정하는 동안 `pnpm dev:cli`를 실행하면 core·contracts를 먼저 빌드하고 세 패키지의 변경을 함께 감시한다. 별도 터미널에서 `pnpm cli`로 실행한다. watcher가 CLI 명령을 자동 실행하지는 않는다.

## 명령과 검증 범위

| 명령 | 수행 내용 |
| :--- | :--- |
| `pnpm build` | core·contracts 타입 선언과 JS, CLI 번들, 브라우저 정적 파일 생성 |
| `pnpm typecheck` | 공통 패키지 선언 생성 후 네 패키지의 소스와 브라우저 설정·테스트 타입 검사 |
| `pnpm test` | 전체 빌드 후 CLI·패키징·브라우저 테스트 |
| `pnpm test:built` | 현재 제품 빌드 결과로 테스트 실행. CLI 내부 모듈은 테스트용으로 별도 컴파일 |
| `pnpm check` | 타입 검사, 빌드, 테스트를 순서대로 실행 |

Node.js 기본 test runner로 core 집계·실패 전파, 출력 계약, Git 파서와 재시도, CLI의 stdout/stderr·종료 코드·저장소 무변경을 검사한다. Git 통합 시험은 임시 저장소에서 수행한다. 별도의 패키징 검사에서는 CLI를 pack하고 새 임시 폴더에 오프라인 설치한 뒤 도움말·버전·status를 확인한다. 내부 workspace 패키지는 게시하지 않으며 CLI의 실행 의존성은 번들에 포함한다.

Playwright는 Vite preview의 실제 빌드 결과를 Chromium에서 검사한다. Astryx 테마와 버튼, 키보드 활성화, 경로 이동·새로고침·뒤로 가기, 없는 경로의 안내와 복귀를 확인한다. 검증 서버는 127.0.0.1:4173을 사용하며 기존 서버를 재사용하지 않는다. 포트가 사용 중이면 기존 프로세스를 임의로 종료하지 말고 충돌 원인을 확인한다.

core의 관측 모델과 contracts의 `repository-status` 버전 1은 개발용으로 구현했다. 부분 staging과 충돌 집계, 잘못된 계약·object ID·경로의 거부를 고정 입력으로 확인한다. 이것을 요구사항·승인·영속 형식의 검증 성공으로 확대하지 않는다.

## 도구 선택과 생성물

직접 의존성은 정확한 버전으로 선언하고 `pnpm-lock.yaml`에 전체 해석 결과를 보관한다. 현재 조합은 TypeScript 7.0.2, React 19.3.0, Vite 8.3.0, Astryx core·neutral 0.6.0이다. 전체 버전은 각 `package.json`에서 확인한다.

- CLI는 [Commander](https://github.com/tj/commander.js)로 입력을 처리하고 [esbuild](https://esbuild.github.io/getting-started/)로 ESM 실행 파일을 만든다. CommonJS 의존성이 Node 내장 모듈을 사용할 수 있도록 `createRequire`를 연결한다.
- 출력 계약은 Zod 4.6.4로 런타임 검증한다. contracts는 Node 전용 모듈을 가져오지 않으며 브라우저에서도 같은 검증기를 사용할 수 있다.
- Router의 Vite 플러그인과 별도 생성 스크립트는 같은 `tsr.config.json`을 읽는다. 생성 스크립트는 router-generator의 ESM API를 사용한다. 설치한 router-cli에서 확인된 CommonJS 순환 참조 경고를 피하고 생성기 버전을 일치시킨다.
- `routeTree.gen.ts`는 Git에서 제외한다. 타입 검사·빌드 전에 다시 생성하며 개발 중에는 Vite 플러그인이 갱신한다.
- 패키지 설치 스크립트는 esbuild만 허용한다. 확인한 Astryx core 0.6.0의 postinstall은 에이전트 문서 초기화를 권하는 안내이므로 실행하지 않는다. 실제 CSS와 테마는 배포 파일을 사용한다.
- `node_modules`, `dist`, 브라우저 테스트 결과와 압축 패키지는 Git에서 제외한다. pnpm lockfile은 제외하지 않는다.

빌드는 공통 패키지·브라우저·CLI 순서로 수행한다. CLI에 브라우저 자산을 포함하므로 설치한 패키지만으로 서버를 실행할 수 있다. 패키징 검증은 설치된 CLI의 HTML·JS·CSS·직접 URL과 실제 API 새로고침까지 포함한다.

## 검증 기록과 다음 작업

2026-09-13 Windows / Node.js 24.17.0 / pnpm 10.33.0 / Git 2.53.0.windows.1에서 `pnpm check`가 통과했다. core 3개, contracts 4개, CLI 32개, Chromium 6개와 별도의 오프라인 패키지 설치 검증을 수행했다. Chromium에서는 실제 CLI 서버의 임시 Git 저장소 조회·새로고침·직접 URL을 확인했다. 제어한 API 응답으로 로딩·실패 후 이전 결과 유지·세션과 계약 불일치도 확인했다. frozen lockfile 설치는 앞선 환경 구축에서 확인했다.

Git 통합 시험에는 unborn·detached HEAD, 부분 staging, 삭제·타입 변경·intent-to-add, rename 추론 해제, 충돌, linked worktree, submodule, SHA-256, Git 부재·손상과 전체 파일 내용 보존을 포함한다. 탭·줄바꿈 등 Windows 파일명 제약이 있는 경로는 파서 fixture로 검증했다. 권한 오류 분류와 조회 중 경합·출력 제한은 제어한 입력으로 검증했으며 macOS·Linux에서의 실제 실행과 요구사항 기록 형식 호환성은 미실행이다.

개발 예외 DEV-01로 문서를 직접 작성하고 DEV-02로 기본 도구의 검사를 사용했다. 요구사항 기록·검사 범위에서는 이 예외를 유지한다. 초기화만 별도의 검증·지정 대상으로 다룬다.

통합 서버의 실제 화면과 새로고침을 별도로 확인했다. Vite 개발 프록시의 실제 화면 검증은 5173 포트가 이미 사용 중이어서 수행하지 못했다. 기존 프로세스는 종료하지 않았다. 개발 Origin 허용·거부는 HTTP 테스트로 검증했다.

첫 조회의 입력·출력과 Git 스냅샷 경계는 [저장소 상태 조회 명세](specs/repository-status.md), HTTP·세션·캐시는 [로컬 브라우저 서버](specs/browser-server.md)에 정리했다. 도입 기준선은 init-1에 정의했고, 요구사항 기록·검사·brief에 필요한 나머지 영속 형식은 후속 명세에서 정의한다. 관련 기준은 [아키텍처](architecture/README.md)와 [제품 기준](bref.md)을 따른다.

설정과 도입 기준선 생성은 [프로젝트 초기화](specs/project-init.md), 저장 형식과 호환성은 [init-1](specs/project-format.md)을 따른다. 최초 생성에는 `pnpm cli init --mode prototype` 또는 `--mode normal`을 사용한다. `--dry-run`은 계획만 확인하고, 기존 설정 확인은 `pnpm cli init`으로 실행한다. 최초 생성 후 설정을 커밋할지는 별도 Git 작업으로 결정한다.

## 초기화 검증과 프로젝트 사용 빌드

2026-09-13 Windows에서 init 추가 후 pnpm check가 통과했다. core 5개, contracts 4개, CLI 44개, Chromium 6개와 오프라인 패키지 설치·초기화·재실행을 검증했다.

init은 실제 임시 저장소에서 dry-run 무변경, 일반·unborn·detached·SHA-256, 부분 staging 보존, ignore·설정 삭제·잘못된 형식·junction 거부, 동시 생성, linked worktree·clone·submodule을 확인했다. 확정 전후 프로세스 종료와 재실행, 남은 임시 파일 보존도 확인했다. 쓰기 도중 실패와 입력 변경은 제어한 시점에 주입했다. 실제 디스크 부족·전원 손실·ACL 접근 거부, 외부 프로세스의 지속적인 경로 교체, macOS·Linux 실행은 미검증이다.

프로젝트 초기화 사용 빌드로 로컬 apps/cli/dist/main.js (CLI 0.0.0, SHA-256 0fd72559bc07b90d46af076e1bf1c114e3964f0bcd600a84c3594c3c3aee56ab)를 지정한다. 지원 범위는 init-1의 최초 생성·재실행과 Git 관측이다. 빌드를 다시 만들면 같은 검증 없이 자동으로 새 프로젝트 쓰기 도구로 지정하지 않는다. 요구사항 기록·check·스킬·훅에는 이 지정이 적용되지 않는다.

지정한 빌드로 이 저장소에 `init --mode prototype`을 적용했다. 기준선은 `9fbe58b582f9d5a158d575405f2d912cf6b10e0d`이고 생성 파일은 [.tryce/config.json](../.tryce/config.json) 하나다. 재실행에서 이미 초기화됨 결과, 설정 바이트·Git index·HEAD 보존을 확인했다. 초기화 직후 설정은 미커밋 상태였으며, 기존 docs를 요구사항이나 승인 기록으로 자동 변환하지 않았다. DEV-01은 일반 문서·미지원 기록에, DEV-02는 요구사항 검사에 계속 적용한다. DEV-04의 스킬·연동 준비도 유지한다.

## 프로토타입 기록 실행

첫 활성화는 `pnpm cli note enable --dry-run`으로 계획을 확인한 뒤 `pnpm cli note enable`로 수행한다. init-1 원본을 보존하고 format만 prototype-1로 전환한다. 모드와 기준선은 유지한다. 명세는 [프로토타입 기록](specs/prototype-notes.md)을 따른다.

```sh
pnpm cli note add --type discovery --message "확인한 동작과 근거" --author Codex
pnpm cli note add --type constraint --file ./constraint.txt
pnpm cli note list --format text
pnpm cli note show N-<UUID> --format text
```

본문을 보완하려면 새 기록에서 `--ref`로 연결하고, 정정하려면 `--supersedes`로 이전 기록을 지정한다. 기존 기록은 그대로 남는다. list는 현재 작업 폴더의 전체 기록을 읽으며 아직 커밋되지 않은 파일도 포함한다. 자동 stage·commit은 하지 않는다.

`.tryce/.notes.lock`이 남아 있으면 다른 작업이 실행 중인지 확인한다. 중단된 작업의 잠금임을 확인한 경우에만 해당 파일을 수동 정리하고 재실행한다. 실패 후 성공 여부가 불확실하면 list로 생성된 기록을 확인한다. 같은 본문으로 add를 재실행하면 별도 기록이 된다.

## 기록 기능 검증과 사용 빌드

2026-09-13 Windows에서 pnpm check가 통과했다. core 7개, contracts 5개, CLI 52개, Chromium 6개로 총 70개 테스트와 오프라인 설치·note enable/add/show/list 검증을 수행했다. 별도 임시 저장소에서 이전 초기화 전용 CLI가 prototype-1을 UNSUPPORTED_FORMAT으로 거부하고 설정을 보존하는 것도 확인했다.

새 기록 사용 빌드는 apps/cli/dist/main.js (CLI 0.0.0, SHA-256 3c6e8eba78b86b47cac1e2491e8214d55bb618eb2c2d35f65b5205e5854fab35)다. 이전 초기화 전용 빌드를 대신해 init-1·prototype-1 조회, 초기화, note 형식 도입·추가·조회에 사용한다. 요구사항·승인·check·스킬·훅에는 이 지정이 적용되지 않는다.

실제 파일·Git 저장소를 사용해 전환 원본 보존, dry-run 무변경, 재실행, 원문과 정정 참조 보존, 없는 참조·손상·삭제·ignore·junction 거부, 부분 staging·linked worktree 보존, 경쟁 쓰기 거부를 확인했다. 전환 원본 보존 후 실제 자식 프로세스 종료와 남은 잠금의 명시적 정리·재개도 시험했다. 입력 변경·일반 실패는 제어한 시점에 주입했다. 실제 디스크 부족·ACL 오류·전원 손실·지속적인 외부 경로 교체·macOS·Linux 실행은 미검증이다.

지정한 빌드로 이 저장소에 note enable을 적용했다. 원본은 [config.init-1.b47160756686330516d729c6e605c7a2d5d885610a2531bb0a6813e50a501f13.json](../.tryce/config.init-1.b47160756686330516d729c6e605c7a2d5d885610a2531bb0a6813e50a501f13.json)에 보존했고, format만 prototype-1로 바꿨다. prototype 모드와 기준선, Git index·HEAD를 유지했다. 실제 근거가 있는 발견·제약·기각 이유 세 개를 note add로 작성하고 list·show로 재조회했다. 활성화 직후 기록과 전환 파일은 미커밋 상태였다.

자체 적용한 기록:

- [discovery: N-633cb083-c215-46e9-bcd3-923a5da45aed](../.tryce/notes/N-633cb083-c215-46e9-bcd3-923a5da45aed.json)
- [constraint: N-ebaf0e3d-74e6-4beb-85ce-314d37854b36](../.tryce/notes/N-ebaf0e3d-74e6-4beb-85ce-314d37854b36.json)
- [rejected: N-478d7df1-01b8-42af-9c68-9dc7ad512cbd](../.tryce/notes/N-478d7df1-01b8-42af-9c68-9dc7ad512cbd.json)

DEV-01은 검증·지정한 note의 발견·제약·기각 이유 작성 범위에서 축소한다. 일반 문서와 미지원 요구사항·승인 기록에는 유지한다. DEV-02의 요구사항 검사, DEV-04의 스킬·연동 준비도 유지한다.

## 세션 브리핑 실행

```sh
pnpm cli brief --format text
pnpm cli brief --all
```

기본 JSON은 기계 입력용이며 text는 사람이 확인할 때 사용한다. 기본 출력은 기록 20개·본문 240 Unicode 코드 포인트, Git 변경 20개, 문서 위치 30개다. total·included·omitted와 본문 생략 표시를 확인하고, 필요한 원문은 note show 또는 brief --all로 읽는다. 전체 지원 범위와 제한은 [세션 브리핑 명세](specs/session-brief.md)를 따른다.

설정·기록·문서 중 일부를 읽지 못하면 stderr의 JSON에 부분 report와 오류를 제공하고 종료 코드 1을 반환한다. Git 상태 자체가 바뀌거나 읽히지 않으면 report는 null이다. 초기화 전 상태와 note 미활성화는 명시한 정상 관측 상태이며 자동으로 초기화하지 않는다. 요구사항 검사·미결 질문 추출·과거 이력 분석은 아직 미실행·미지원이다.

## 브리핑 검증과 사용 빌드

2026-09-13 Windows에서 pnpm check가 통과했다. core 9개, contracts 6개, CLI 59개, Chromium 6개로 총 80개 테스트와 오프라인 설치 검증을 수행했다. 설치한 CLI의 brief --all이 프로젝트 모드·실제 note·생략 0·검사 미실행을 반환하는 것도 확인했다.

프로젝트 사용 빌드는 apps/cli/dist/main.js (CLI 0.0.0, SHA-256 bd2c7abf2353ed951d56eb90e5bf6805f4c122294af4ccc06b1accaa4f27006e)로 갱신한다. 검증한 init·note·Git 관측과 brief에 사용한다. 요구사항 검사·스킬·훅에는 이 지정이 적용되지 않는다.

brief의 정렬·Unicode 발췌·생략 집계·목록 밖 정정 관계, 초기화 전 상태, init-1, prototype-1, 손상·삭제·미지원 형식·잠금, Git·설정·기록 변경 중 조회, linked worktree, 문서 junction 거부, stdout/stderr·부분 보고서와 전체 파일 보존을 확인했다. 문서 본문·모든 지침 탐색·과거 이력·실제 권한 차단·지속적인 외부 경로 교체·macOS·Linux 실행은 미검증 또는 지원 범위 밖이다.

자체 적용에서 brief --all이 prototype 모드, 기존 기준선, 기록 4개와 문서 위치 13개를 반환하는 것을 확인했다. brief 실행 전후 .tryce와 Git 파일 지문이 같았다. 부분 실패 처리의 실제 검증 결과를 [발견 기록](../.tryce/notes/N-4840375c-a0e2-469f-a371-868aeae6927a.json)으로 남겼다. AGENTS.md의 작업 시작 절차를 brief로 연결했고, DEV-02는 지원한 현재 자료 브리핑 범위에서 축소했다. 요구사항 검사·미결 질문 추출·과거 이력 분석의 예외는 유지한다. 이 자체 적용 단계에서는 커밋·푸시를 수행하지 않았다.
