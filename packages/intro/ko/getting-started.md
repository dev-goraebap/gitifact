# 시작하기

## 설치와 도입

프로젝트에서 사용하는 에이전트에게 아래 내용을 전달하세요.

```text
npm install -g gitifact로 Gitifact를 설치하고 이 프로젝트에서 gitifact init을 실행하세요.
init이 AGENTS.md 등에 쓴 GITIFACT 블록을 읽고 이번 세션부터 따르세요.
```

## 개발 이어가기

도입 후에는 평소처럼 에이전트에게 작업을 요청하세요.

```text
게시물을 삭제할 수 있게 해주세요.
```

에이전트가 GITIFACT 블록의 안내에 따라 요구사항과 설계를 정리합니다. 작업을 마친 뒤 “커밋해주세요”라고 요청하면 관련 명세와 변경 이유도 코드와 함께 기록합니다.

기존 프로젝트는 앞으로 작업하는 기능부터 기록할 수 있습니다. 전체 요구사항을 먼저 정리하고 싶다면 이렇게 요청하세요.

```text
이 프로젝트의 요구사항과 설계를 정리해주세요.
```

## 프로젝트 지침 만들기

개발 규칙이나 아키텍처 결정은 작업별 프로젝트 지침으로 관리할 수 있습니다. 어떤 지침을 둘지, 어떤 작업 때 읽을지도 에이전트와 대화하며 정하세요.

```text
우리 프로젝트의 개발 규칙을 프로젝트 지침으로 정리해주세요.
```

## 문서와 변경 이력 확인하기

보고 싶은 내용을 에이전트에게 말하면 됩니다. 예를 들어 다음과 같이 요청할 수 있습니다.

- “요구사항을 확인하고 싶어요.”
- “제품 명세를 보고 싶어요.”
- “최근 변경 이력을 보여주세요.”
- “gitifact 브라우저를 열어주세요.”

브라우저 뷰어에서 다음 내용을 확인할 수 있습니다.

| 화면 | 확인할 내용 |
| :--- | :--- |
| 대시보드 | 프로젝트 규모와 최신 활동 |
| 기능별 요구사항 | 현재 요구사항과 기능별 설계 |
| 프로젝트 지침 | AGENTS.md와 개발 규칙·아키텍처 결정 등 작업별 지침 |
| 결정기록 | 커밋된 결정기록과 그 기록이 설명하는 문서의 변경 전후 내용 |
| 참여자 | Git 작성자별 참여 내역 |
| Git 상태 | 현재 작업 폴더의 변경 파일 |

요구사항·설계·지침에는 작업 중인 내용이, 결정기록에는 커밋된 이력이 보입니다.

## Gitifact에 의견 보내기

Gitifact를 쓰다가 만난 버그나 바라는 개선은 에이전트에게 말하면 됩니다.

```text
Gitifact에 이 버그를 이슈로 남겨주세요.
```

에이전트가 제목과 본문 초안을 보여 주고, 확인하면 Gitifact 저장소에 이슈를 보냅니다. GitHub CLI(`gh`)에 로그인되어 있으면 내 계정으로 바로 만들고, 아니면 내용을 채운 이슈 작성 페이지 주소를 알려 줍니다. 본문 끝에는 Gitifact·운영체제·Node 버전만 붙고 프로젝트 파일은 보내지 않습니다.

## 언어 설정

브라우저 설정에서 한국어, English, 브라우저 설정 중 하나를 고를 수 있습니다. 선택은 해당 브라우저에 저장되며 프로젝트 문서의 언어는 바꾸지 않습니다.

CLI는 실행 환경의 언어를 따르고, 지원하지 않는 언어이면 영어를 사용합니다. 직접 지정하려면 `gitifact --lang ko <명령>` 또는 `gitifact --lang en <명령>`을 사용하세요. 셸의 `GITIFACT_LANG` 환경변수에 `ko`나 `en`을 지정할 수도 있습니다. GITIFACT 블록의 언어는 `.gitifact/config.json`의 `language`에 기록되며, `--lang`을 지정하지 않는 한 업데이트 후에도 유지됩니다.

## 업데이트

새 버전이 나오거나 팀원이 프로젝트를 새 버전으로 올리면 gitifact 명령의 출력 앞에 안내가 한 줄 나옵니다. 에이전트는 이 안내를 보면 지금 업데이트할지 나중에 할지 묻습니다. 원할 때 직접 요청해도 됩니다.

```text
Gitifact를 업데이트해주세요.
```

업데이트는 `npm install -g gitifact@<새 버전>`으로 설치한 뒤 `gitifact update`를 실행합니다. `update`는 에이전트 지침의 GITIFACT 블록과 `.gitifact/config.json`의 프로젝트 기준 버전(`cli`)을 새 버전으로 바꿉니다. 이 두 파일을 커밋하면 팀원도 다음 명령에서 안내를 받습니다. 나중에 하려면 `gitifact update --later`로 그 버전의 안내를 24시간 쉴 수 있습니다. 프로젝트 의존성으로 관리한다면 같은 방식으로 버전을 올린 뒤 해당 설치본으로 `update`를 실행하세요. 브라우저 서버도 새 버전으로 다시 열면 됩니다.

> [!IMPORTANT]
> 0.8.3부터 `.gitifact/config.json`에 `cli`와 `language`를 적습니다. 0.8.2 이하 CLI는 이 설정을 읽지 못하고 `INVALID_CONFIG`로 멈추므로, 팀원 모두 0.8.3 이상으로 올린 뒤 업데이트하세요.

0.7로 기록한 프로젝트(저장 규약 schemaVersion 2)는 0.8.0에서 문서 구조가 바뀌어 한 번 옮겨야 합니다. 업데이트하면 에이전트가 이를 알리고, 동의하면 `gitifact guide show migrate`의 절차로 기존 ID와 변경 이유를 그대로 둔 채 문서를 옮깁니다.

## 직접 명령 실행하기

Node.js 24.x와 Git이 설치된 환경에서 전역으로 설치하고, 대상 Git 저장소 안에서 실행하세요.

```sh
npm install -g gitifact
gitifact init
gitifact browser
```

`browser`가 출력한 로컬 주소를 열면 됩니다. 서버는 터미널에서 Ctrl+C로 종료합니다.

에이전트는 전역 `gitifact`를 씁니다. 명령이 없으면 `.gitifact/config.json`의 `cli` 버전으로 `npm install -g gitifact@<버전>` 설치를 제안합니다.

> [!NOTE]
> 설치하지 않고 `npx gitifact@<버전> <명령>`으로도 실행할 수 있습니다. 다만 호출마다 약 1.7초가 더 걸리고 에이전트는 명령을 자주 부르므로 전역 설치를 권장합니다.

### 프로젝트에 설치하기

Node.js 프로젝트에서 팀이 같은 버전을 관리하려면 개발 의존성으로 추가할 수 있습니다. 기존 프로젝트의 패키지 관리자를 사용하세요. npm을 쓴다면:

```sh
npm install --save-dev --save-exact gitifact@latest
npx gitifact init
npx gitifact browser
```

`package.json`과 잠금 파일에 버전이 기록됩니다. 이후에는 프로젝트 설치본을 사용하도록 에이전트 지침에 적어두세요.

### 자주 쓰는 명령

| 명령 | 용도 |
| :--- | :--- |
| `gitifact init --dry-run` | 파일을 바꾸기 전에 도입 계획 확인 |
| `gitifact init` | 프로젝트에 Gitifact 도입, 에이전트 지침 설치·갱신 |
| `gitifact browser` | 브라우저 뷰어 실행 |
| `gitifact update --check` | 파일 변경 없이 새 버전 확인 |
| `gitifact update` | 설치한 버전으로 GITIFACT 블록과 프로젝트 기준 버전 갱신 |
| `gitifact update --later` | 안내된 새 버전을 24시간 동안 안내하지 않음 |
| `gitifact guide list` | 에이전트 작업 지침의 주제 목록 |
| `gitifact guide show spec` | 요구사항 파일 형식과 작성 규칙 |
| `gitifact guide show design` | 기능 설계 작성 규칙 |
| `gitifact guide show instructions` | 프로젝트 지침 형식과 AGENTS.md 색인 |
| `gitifact guide show records` | 결정기록을 쓰는 때와 형식 |
| `gitifact guide show commit` | 결정기록과 관련 파일을 함께 커밋하는 방법 |

### 문서 조회와 커밋

요구사항·설계·지침은 `.gitifact/` 아래의 Markdown 파일이며 직접 고칩니다. 새 문서는 CLI로 만들어 ID를 받습니다.

| 명령 | 용도 |
| :--- | :--- |
| `gitifact specs list` | 기능·요구사항·설계 목록(본문 없이 ID·제목·설명). `--uncovered`·`--changed-since`·`--q` 등으로 거른다 |
| `gitifact instructions list` | AGENTS.md와 프로젝트 지침 목록 |
| `gitifact specs show <ID>` | 문서 원문과 그 문서를 가리키는 설계. `--ref <커밋>`으로 과거 원문 |
| `gitifact records list --doc <ID>` | 문서의 결정기록과 커밋 |
| `gitifact specs new requirement <기능>/<이름>` | ID를 발급하고 뼈대를 채운 새 문서 생성 |
| `gitifact check` | 모든 문서의 형식·ID·참조 검사 |
| `gitifact changes list` | HEAD 이후 바뀐 문서, 커밋하지 않은 결정기록, 기록 없는 변경 |
| `gitifact changes commit --file <입력 파일> --dry-run` | 파일을 바꾸지 않고 커밋 계획 확인 |
| `gitifact changes commit --file <입력 파일>` | 고른 문서·결정기록·관련 파일 커밋 |

커밋 입력 형식은 `gitifact guide show commit`에서 확인할 수 있습니다.

### 도입과 실행 옵션

| 옵션 | 용도 |
| :--- | :--- |
| `gitifact init --agent codex` | 특정 도구의 지침 파일에 설치. `claude`, `cursor`, `codex`, `hermes`, `all` 지원 |
| `gitifact init --skip-agents` | 에이전트 지침 파일을 수정하지 않고 도입 |
| `gitifact init --remove-agents` | 에이전트 지침의 GITIFACT 블록 제거 |
| `gitifact browser --port 4317` | 브라우저 서버의 포트 지정 |

`--remove-agents`는 에이전트 지침의 GITIFACT 블록만 제거하며, 프로젝트 기록은 유지합니다.

각 명령에 `--help`를 붙이면 사용할 수 있는 옵션을 확인할 수 있습니다.
