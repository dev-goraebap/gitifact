# Gitifact 이름 전환

## 확정 사항

제품 이름은 Gitifact다. 공개 npm 패키지는 조직 없는 `gitifact`, 새 패키지의 첫 버전은 0.1.0이다. 설치 명령은 `npm install -g gitifact`, 실행 명령은 `gitifact`로 맞춘다. 사용자가 패키지 이름을 사용할 수 있음을 확인했으며 실제 게시 직전에도 확인한다.

Git 원격은 `https://github.com/dev-goraebap/gitifact.git`로 교체한다. 현재 origin은 이전 tryce 저장소다. 이번 요청은 remote 변경과 새 패키지 배포의 인계이며 `.git` 삭제나 기존 커밋 이력 재작성은 포함하지 않는다. 새 remote에 이미 이력이 있으면 확인하고 강제 푸시하지 않는다.

로고는 브라우저의 `apps/browser/public/gitifact-logo.svg`와 README의 `docs/assets/gitifact-logo.svg`로 연결했다. README·CLI 안내는 전환 후 이름을 사용하며 배포 준비 중임을 표시한다. 실제 코드와 저장 규약은 아직 이전 이름이다.

## 구현할 변경

| 영역 | 현재 | 전환 대상 |
| --- | --- | --- |
| 공개 패키지·실행 파일 | @tryce/cli, tryce | gitifact@0.1.0, gitifact |
| 패키지 메타데이터 | tryce repository/homepage/bugs | gitifact 저장소 URL |
| 내부 workspace | tryce-workspace, @tryce/core·contracts·browser | Gitifact 이름으로 통일하되 private 유지 |
| 스킬 | tryce-workflow | gitifact-workflow, 설치·복사본·빌드·지침 연결 동시 수정 |
| 저장 경로·기록 마커 | .tryce, tryce-spec·req·design·ref | .gitifact, gitifact-*를 목표로 전환 절차 구현·검증 |
| Git 연결 | Tryce-Req·Tryce-Design | 새 쓰기 이름과 과거 읽기 규칙 함께 검토 |
| 실행 연동 | TRYCE_* 환경 변수, X-Tryce-Session, 잠금·임시 파일 접두어 | GITIFACT_* 등 대응 이름으로 생산자·소비자 함께 수정 |
| 화면·자산 | 페이지 제목·설명·접근성 이름·CSS 접두어 | Gitifact, 사용하지 않는 이전 자산 정리 |
| 테스트·배포 | 이전 패키지 경로·bin·스킬·fixture | 새 이름으로 실제 설치·실행 검증 |

저장 경로와 마커의 구체적 변환은 아직 구현하지 않았다. 기존 S-ID·R-ID·H-ID와 이유 원문·도입 기준선은 보존한다. 단순 문자열 치환으로 사용자 본문이나 이미 커밋된 기록을 바꾸지 않는다. 구형 형식 판별 문자열과 과거 읽기용 이름은 현재 브랜드 표시와 구분한다. 전환 후 과거 명세가 전부 새로 생성된 것으로 보이거나 이력을 읽지 못하는지 시험한다.

과거 릴리스 버전·커밋 SHA·integrity·과거 저장소의 커밋 고정 링크는 당시 사실이다. 새 저장소가 같은 커밋을 보유하는지 확인하지 않고 URL만 바꾸지 않는다. MIT 라이선스 본문과 기존 저작권 귀속을 임의로 바꾸지 않는다.

## 검증과 배포

독립 저장소에서 새 도입, 기존 명세 전환, 설계·요구사항·이유 연결, 저장과 커밋, 과거 이력, 스킬 사용자 수정본 보존을 검증한다. 기존 기록용 CLI는 전환 검증과 지정이 끝날 때까지 유지한다. 현재 작업 폴더에는 별도 브라우저 작업이 있으므로 무관한 변경을 덮어쓰지 않는다.

workspace 의존성과 lockfile을 맞추고 pnpm check 및 패키지 외부 설치 시험을 수행한다. 새 패키지가 private 내부 패키지의 레지스트리 게시를 요구하지 않는지 확인한다. 새 번들 해시와 프로젝트 사용 빌드를 개발 환경 문서에 지정한다.

배포는 루트나 .tmp가 아닌 apps/cli에서 한다. `name: gitifact`, `version: 0.1.0`, `bin.gitifact`, 공개 설정, 새 repository URL과 패키지 내용을 확인한다. 사용자 제공 인증 정보는 로컬 인계 문서에 적힌 경로에서 사용하며 저장소·배포물에 포함하지 않는다. [배포 절차](releases.md)에 따라 모의 실행과 게시, 레지스트리 버전·무결성 확인, 외부 프로젝트 설치·실행을 각각 확인한다.

이번 문서 정리 단계에서는 remote·인증 설정·패키지 이름·코드를 변경하거나 커밋·푸시·게시하지 않았다. 구현 완료 후 README와 CLI 안내의 준비 중 표시를 실제 게시 결과에 맞춰 갱신한다.
