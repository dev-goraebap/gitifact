# 시작하기

## 설치와 도입

프로젝트에서 사용하는 에이전트에게 아래 내용을 전달하세요.

```text
이 프로젝트에서 npx --yes gitifact@latest init을 실행하세요.
init이 AGENTS.md 등에 쓴 GITIFACT 블록을 읽고 이번 세션부터 따르세요.
```

## 개발 이어가기

도입 후에는 평소처럼 에이전트에게 작업을 요청하세요.

```text
게시물을 삭제할 수 있게 해주세요.
```

에이전트가 프로젝트 지침에 따라 요구사항과 설계를 정리합니다. 작업을 마친 뒤 “커밋해주세요”라고 요청하면 관련 명세와 변경 이유도 코드와 함께 기록합니다.

기존 프로젝트는 앞으로 작업하는 기능부터 기록할 수 있습니다. 전체 요구사항을 먼저 정리하고 싶다면 이렇게 요청하세요.

```text
이 프로젝트의 요구사항과 설계를 정리해주세요.
```

## 프로젝트에 맞게 위키 구성하기

개발 규칙이나 아키텍처 결정은 위키에서 관리할 수 있습니다. 문서 구조와 운영 방식도 에이전트와 대화하며 조정하세요.

```text
우리 프로젝트의 개발 규칙을 위키에 정리해주세요.
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
| 프로젝트 위키 | 개발 규칙과 아키텍처 결정 등 프로젝트 문서 |
| 활동 | 커밋된 변경의 이유와 변경 전후 내용 |
| 참여자 | Git 작성자별 참여 내역 |
| Git 상태 | 현재 작업 폴더의 변경 파일 |

요구사항·설계·위키에는 작업 중인 내용이, 활동에는 커밋된 이력이 보입니다.

## 언어 설정

브라우저 설정에서 한국어, English, 브라우저 설정 중 하나를 고를 수 있습니다. 선택은 해당 브라우저에 저장되며 프로젝트 문서의 언어는 바꾸지 않습니다.

CLI는 실행 환경의 언어를 따르고, 지원하지 않는 언어이면 영어를 사용합니다. 직접 지정하려면 `gitifact --lang ko <명령>` 또는 `gitifact --lang en <명령>`을 사용하세요. 셸의 `GITIFACT_LANG` 환경변수에 `ko`나 `en`을 지정할 수도 있습니다. 기존 프로젝트의 GITIFACT 블록은 `--lang`을 지정하지 않는 한 업데이트 후에도 원래 언어를 유지합니다.

## 업데이트

브라우저 뷰어에 새 버전 안내가 나타나면 에이전트에게 업데이트를 요청하세요.

```text
Gitifact를 업데이트해주세요.
```

npx로 사용한다면 `npx --yes gitifact@latest update`로 프로젝트 지침을 갱신하세요. 프로젝트 의존성이나 전역 설치로 관리한다면 같은 방식으로 버전을 올린 뒤 해당 설치본으로 `update`를 실행하세요. 브라우저 서버도 새 버전으로 다시 열면 됩니다.

## 직접 명령 실행하기

Node.js 24.x와 Git이 설치된 환경에서 대상 Git 저장소 안에서 실행하세요. 전역 설치는 필요하지 않습니다.

```sh
npx --yes gitifact@latest init
npx --yes gitifact@latest browser
```

`browser`가 출력한 로컬 주소를 열면 됩니다. 서버는 터미널에서 Ctrl+C로 종료합니다.

명령 표의 `gitifact`는 GITIFACT 블록에 적힌 실행 방법을 뜻합니다. 도입 후에는 블록에 지정된 버전으로 실행하세요.

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
| `gitifact init --dry-run` | 파일을 바꾸기 전에 도입 계획 확인 |
| `gitifact init` | 프로젝트에 Gitifact 도입, 에이전트 지침 설치·갱신 |
| `gitifact browser` | 브라우저 뷰어 실행 |
| `gitifact status` | 현재 Git 상태 조회 |
| `gitifact update` | 새 버전 확인과 프로젝트 지침 갱신 |
| `gitifact docs` | 에이전트 작업 지침의 주제 목록 |
| `gitifact docs spec` | 요구사항 저장 형식과 작성 규칙 |
| `gitifact docs design` | 기능 설계 작성 규칙 |
| `gitifact docs wiki` | 위키 형식과 이 프로젝트의 운영 방침 |
| `gitifact docs commit` | 변경 이유와 관련 파일을 함께 커밋하는 방법 |

### 명세 조회와 저장

| 명령 | 용도 |
| :--- | :--- |
| `gitifact spec working` | 현재 명세·위키와 저장에 필요한 정보 조회 |
| `gitifact spec save --file <입력 파일>` | 요구사항·설계·위키 저장 |
| `gitifact spec changes` | HEAD와 작업 중인 명세의 차이, 미커밋 변경 이유 조회 |
| `gitifact spec commit --file <입력 파일> --dry-run` | 파일을 바꾸지 않고 커밋 계획 확인 |
| `gitifact spec commit --file <입력 파일>` | 변경 이유 기록과 관련 파일 커밋 |
| `gitifact spec read --ref HEAD` | 특정 커밋의 명세 조회 |
| `gitifact spec diff --from <이전 커밋> --to <이후 커밋>` | 두 커밋 사이의 명세 변경 조회 |

저장·커밋 입력 형식은 `gitifact docs spec`과 `gitifact docs commit`에서 확인할 수 있습니다.

### 도입과 실행 옵션

| 옵션 | 용도 |
| :--- | :--- |
| `gitifact init --agent codex` | 특정 도구의 지침 파일에 설치. `claude`, `cursor`, `codex`, `hermes`, `all` 지원 |
| `gitifact init --skip-agents` | 에이전트 지침 파일을 수정하지 않고 도입 |
| `gitifact init --remove-agents` | 에이전트 지침의 GITIFACT 블록 제거 |
| `gitifact browser --port 4317` | 브라우저 서버의 포트 지정 |
| `gitifact browser --no-update-check` | npm 새 버전 조회 없이 브라우저 실행 |

`--remove-agents`는 에이전트 지침의 GITIFACT 블록만 제거하며, 프로젝트 기록은 유지합니다.

각 명령에 `--help`를 붙이면 사용할 수 있는 옵션을 확인할 수 있습니다.
