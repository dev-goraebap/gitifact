# 시작하기

## 설치와 도입

프로젝트에서 사용하는 에이전트에게 아래 내용을 전달하세요.

```text
이 프로젝트에서 npx gitifact@latest init을 실행하세요.
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
| 제품 개요 | 프로젝트 규모와 최신 활동 |
| 기능별 요구사항 | 현재 요구사항과 기능별 설계 |
| 프로젝트 지침 | AGENTS.md와 개발 규칙·아키텍처 결정 등 작업별 지침 |
| 활동 | 커밋된 변경의 이유와 변경 전후 내용 |
| 참여자 | Git 작성자별 참여 내역 |
| Git 상태 | 현재 작업 폴더의 변경 파일 |

요구사항·설계·지침에는 작업 중인 내용이, 활동에는 커밋된 이력이 보입니다.

## 언어 설정

브라우저 설정에서 한국어, English, 브라우저 설정 중 하나를 고를 수 있습니다. 선택은 해당 브라우저에 저장되며 프로젝트 문서의 언어는 바꾸지 않습니다.

CLI는 실행 환경의 언어를 따르고, 지원하지 않는 언어이면 영어를 사용합니다. 직접 지정하려면 `npx gitifact --lang ko <명령>` 또는 `npx gitifact --lang en <명령>`을 사용하세요. 셸의 `GITIFACT_LANG` 환경변수에 `ko`나 `en`을 지정할 수도 있습니다. 기존 프로젝트의 GITIFACT 블록은 `--lang`을 지정하지 않는 한 업데이트 후에도 원래 언어를 유지합니다.

## 업데이트

에이전트는 새 세션에서 업데이트를 확인하고, 새 버전이 있으면 업데이트할지 묻습니다. 원할 때 직접 요청해도 됩니다.

```text
Gitifact를 업데이트해주세요.
```

npx로 사용한다면 `npx gitifact@latest update`로 에이전트 지침의 GITIFACT 블록을 갱신하세요. 프로젝트 의존성이나 전역 설치로 관리한다면 같은 방식으로 버전을 올린 뒤 해당 설치본으로 `update`를 실행하세요. 브라우저 서버도 새 버전으로 다시 열면 됩니다.

0.7로 기록한 프로젝트(저장 규약 schemaVersion 2)는 0.8.0에서 문서 구조가 바뀌어 한 번 옮겨야 합니다. 업데이트하면 에이전트가 이를 알리고, 동의하면 `npx gitifact guide show migrate`의 절차로 기존 ID와 변경 이유를 그대로 둔 채 문서를 옮깁니다.

## 직접 명령 실행하기

Node.js 24.x와 Git이 설치된 환경에서 대상 Git 저장소 안에서 실행하세요. 전역 설치는 필요하지 않습니다.

```sh
npx gitifact@latest init
npx gitifact browser
```

`browser`가 출력한 로컬 주소를 열면 됩니다. 서버는 터미널에서 Ctrl+C로 종료합니다.

에이전트는 GITIFACT 블록에 적힌 버전을 사용합니다.

### 프로젝트에 설치하기

Node.js 프로젝트에서 팀이 같은 버전을 관리하려면 개발 의존성으로 추가할 수 있습니다. 기존 프로젝트의 패키지 관리자를 사용하세요. npm을 쓴다면:

```sh
npm install --save-dev --save-exact gitifact@latest
npx gitifact init
npx gitifact browser
```

`package.json`과 잠금 파일에 버전이 기록됩니다. 이후에는 프로젝트 설치본을 사용하도록 에이전트 지침에 적어두세요. 전역 명령이 편하다면 `npm install -g gitifact@latest`로 설치해 사용할 수도 있습니다.

### 자주 쓰는 명령

| 명령 | 용도 |
| :--- | :--- |
| `npx gitifact init --dry-run` | 파일을 바꾸기 전에 도입 계획 확인 |
| `npx gitifact init` | 프로젝트에 Gitifact 도입, 에이전트 지침 설치·갱신 |
| `npx gitifact browser` | 브라우저 뷰어 실행 |
| `npx gitifact update --check` | 파일 변경 없이 새 버전 확인 |
| `npx gitifact@latest update` | 최신 버전으로 에이전트 지침 파일의 GITIFACT 블록 갱신 |
| `npx gitifact guide list` | 에이전트 작업 지침의 주제 목록 |
| `npx gitifact guide show spec` | 요구사항 파일 형식과 작성 규칙 |
| `npx gitifact guide show design` | 기능 설계 작성 규칙 |
| `npx gitifact guide show instructions` | 프로젝트 지침 형식과 AGENTS.md 색인 |
| `npx gitifact guide show commit` | 변경 이유와 관련 파일을 함께 커밋하는 방법 |

### 문서 조회와 커밋

요구사항·설계·지침은 `.gitifact/` 아래의 Markdown 파일이며 직접 고칩니다. 새 문서는 CLI로 만들어 ID를 받습니다.

| 명령 | 용도 |
| :--- | :--- |
| `npx gitifact docs list` | 기능·요구사항·설계·지침 목록(본문 없이 ID·제목·설명) |
| `npx gitifact docs search <검색어>` | 문서 본문 검색 |
| `npx gitifact docs show <ID>` | 문서 원문과 그 문서를 가리키는 설계. `--ref <커밋>`으로 과거 원문 |
| `npx gitifact docs history <ID>` | 문서의 변경 이유와 커밋 |
| `npx gitifact docs new requirement <기능>/<이름>` | ID를 발급하고 뼈대를 채운 새 문서 생성 |
| `npx gitifact docs check` | 모든 문서의 형식·ID·참조 검사 |
| `npx gitifact changes list` | HEAD 이후 바뀐 문서와 아직 이유가 없는 문서 |
| `npx gitifact changes commit --file <입력 파일> --dry-run` | 파일을 바꾸지 않고 커밋 계획 확인 |
| `npx gitifact changes commit --file <입력 파일>` | 변경 이유 기록과 관련 파일 커밋 |

커밋 입력 형식은 `npx gitifact guide show commit`에서 확인할 수 있습니다.

### 도입과 실행 옵션

| 옵션 | 용도 |
| :--- | :--- |
| `npx gitifact init --agent codex` | 특정 도구의 지침 파일에 설치. `claude`, `cursor`, `codex`, `hermes`, `all` 지원 |
| `npx gitifact init --skip-agents` | 에이전트 지침 파일을 수정하지 않고 도입 |
| `npx gitifact init --remove-agents` | 에이전트 지침의 GITIFACT 블록 제거 |
| `npx gitifact browser --port 4317` | 브라우저 서버의 포트 지정 |

`--remove-agents`는 에이전트 지침의 GITIFACT 블록만 제거하며, 프로젝트 기록은 유지합니다.

각 명령에 `--help`를 붙이면 사용할 수 있는 옵션을 확인할 수 있습니다.
