# 로컬 브라우저 연결

`tryce browser`는 실행 위치의 checkout을 읽고 로컬 서버와 브라우저 정적 파일을 제공한다. [repository-status 버전 1](repository-status.md)을 그대로 사용하며 요구사항 검사를 추가하지 않는다. 현재 구현한 첫 브라우저 연결의 계약이다.

## 실행과 배포

`tryce browser [--port <0..65535>] [--dev]`를 제공한다. 기본 포트는 0으로 OS가 빈 포트를 선택한다. 주소는 `127.0.0.1`에 고정하며 실제 URL을 stdout에 한 줄로 출력한다. 브라우저 앱을 자동 실행하지 않는다. Ctrl+C로 서버와 진행 중인 Git 조회를 정리한다. 포트 충돌은 오류로 반환하고 다른 프로세스를 종료하지 않는다.

시작할 때 현재 checkout을 한 번 읽는다. 실패하면 서버를 열지 않고 stderr에 오류를 표시한다. 성공한 저장소·worktree 식별자는 실행 동안 고정한다. 이후 조회에서 다른 저장소가 발견되면 REPOSITORY_CHANGED로 거부한다. 브랜치 전환은 허용한다.

빌드 순서는 공통 패키지 → browser → cli다. CLI 빌드가 browser의 정적 산출물을 `dist/browser`에 수집한다. 런타임은 설치된 CLI 기준의 자산만 읽으며 사용 프로젝트나 workspace 소스를 정적 파일로 제공하지 않는다. 서버는 시작할 때 자산 목록을 확보하고 그 파일만 제공한다.

## HTTP 계약

| 요청 | 응답 |
| :--- | :--- |
| GET `/api/v1/session` | browser-session 버전 1: sessionId와 저장소·worktree key |
| GET `/api/v1/status` | 마지막 조회 결과. Git을 실행하지 않음 |
| POST `/api/v1/status/refresh` | Git 재조회 후 repository-status 버전 1 결과 |

API에는 query parameter와 body를 받지 않는다. status 요청에는 `X-Tryce-Session` 헤더로 현재 sessionId를 보낸다. 실행마다 UUID가 달라지므로 같은 포트를 재사용한 다른 서버의 결과가 기존 캐시에 들어오지 않는다. 식별자는 외부 인증 수단이나 영속 프로젝트 ID가 아니다.

Git 조회 성공은 HTTP 200, 실패는 HTTP 503과 기존 실패 DTO다. 마지막 결과가 실패이면 이후 GET도 실패를 반환한다. 서버는 성공처럼 꾸민 빈 목록을 제공하지 않는다. 라우팅·세션 오류는 browser-http-error 버전 1로 구분한다: 잘못된 입력 400, 허용하지 않는 출처 403, 없는 경로 404, 허용하지 않는 메서드 405, 이전 세션 409, 서버 종료 중 503.

동시에 들어온 refresh 요청은 진행 중인 조회 하나를 공유한다. 요청 하나가 끊겼다고 다른 창이 기다리는 조회를 취소하지 않는다. 서버 종료 시에는 공통 AbortSignal로 Git 조회와 연결을 정리한다. 파일·index·설정·`.tryce`를 쓰지 않는다.

## 출처와 정적 파일

Host는 서버 자신의 주소와 일치해야 한다. Origin이 있으면 같은 origin만 허용하고 refresh는 Origin을 필수로 확인한다. API의 cross-site 요청은 거부하며 CORS를 열지 않는다. `--dev`일 때만 Vite의 `http://127.0.0.1:5173` Origin을 추가로 허용한다. Vite는 `/api`를 명시한 로컬 서버로 프록시하고 Host를 대상 서버에 맞춘다.

API 응답은 no-store다. 자산과 SPA 페이지는 별도로 처리한다. 없는 API나 자산에 index.html을 반환하지 않으며 HTML 탐색 요청만 SPA fallback을 받는다. 경로 조작이나 symlink로 사용자 파일을 제공하지 않는다. 페이지에 CSP·nosniff·프레임 차단 헤더를 적용하고 Git 경로는 React 텍스트로 표시한다.

## 브라우저 상태

페이지는 session을 읽은 뒤 해당 세션·저장소·worktree·계약 버전을 포함한 Query key로 status를 조회한다. 상태 GET의 staleTime은 5초, 자동 retry는 끈다. 사용자가 명시적으로 다시 연결하거나 갱신할 수 있다. 필터와 과거 시점 조회는 아직 추가하지 않는다.

상태 새로고침은 POST mutation이다. 실행 중 버튼 중복 입력을 막고 진행 표시를 제공한다. 성공 후 이전 GET을 취소하고 같은 key의 조회를 무효화한다. 실패하면 기존 데이터와 확인 시각을 유지하고 오류를 표시한다. 다른 세션이나 잘못된 계약의 응답을 기존 데이터로 합치지 않는다.

현재 UI는 Git 연결을 확인하는 최소 화면이다. 저장소·HEAD, 네 변경 집계, 경로 목록, 마지막 관측 시각, 검사 미실행을 표시한다. 초기 로딩·연결 실패·빈 결과·갱신 중·갱신 실패·호환 불가를 구분한다. 별도로 진행하는 와이어프레임의 전체 디자인을 대체하지 않는다.

## 검증

서버는 GET의 비실행, refresh·중복 합치기·실패·종료, Host/Origin/세션, 입력·경로 차단, 포트 충돌을 시험한다. 브라우저는 실제 임시 Git 저장소를 읽고 파일 변경 후 갱신을 확인하며, mock으로 로딩·오류·이전 데이터 유지·계약 불일치를 시험한다. mock도 같은 계약 검증을 통과해야 한다.

패키징한 CLI를 workspace 밖에 설치해 HTML·JS·CSS·직접 URL·API를 확인한다. 검증 결과와 제한은 [개발 환경](../development.md)에 기록한다. DEV-01·02는 기록·요구사항 검사 기능이 없으므로 유지한다.
