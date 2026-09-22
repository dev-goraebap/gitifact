---
id: D-4kgfn4hrs6
title: 서버 구조와 API
description: 로컬 서버의 요청 검사와 경로 표, API 계약, 조회 캐시
order: 30
requirements:
  - R-5eehizubwl
  - R-tkl3lrrlpu
  - R-fqlesmxflt
---

## 서버 구조

`apps/cli/src/server/`는 역할별로 나눈다. `browser-server.ts`는 시작·종료와 연결만 맡는다. `http/guard.ts`는 모든 요청의 공통 검사(Host·Origin·교차 사이트·경로 탈출·본문 거부·보안 헤더), `http/router.ts`는 경로 표 디스패치, `http/respond.ts`는 JSON·오류 응답, `http/static-files.ts`는 앱 파일이다. 경로는 `routes/`의 세 표(project: 세션·상태·패치노트, record: 체크아웃·이력·요약·변경·검색, asset: 저장소 에셋)이고, 한 줄에 메서드·경로·세션 필요 여부·쿼리 스키마·처리 함수를 둔다. 라우터가 경로 → 메서드(405와 Allow) → 쿼리(중복 키·스키마, 400) → 세션(409) 순으로 거른 뒤 처리 함수를 부르고, 처리 함수가 던진 HttpError는 그 상태로, 그 밖의 오류는 503과 이유로 답한다. `checkout/`은 작업 폴더 체크아웃과 작성자 집계다. 커밋별 변경 계산(commit-changes)·0.7 이력 읽기(legacy-changes)·SQLite 파일(database)·작업 폴더 문서(documents)·이력 질의(history)·검색 글 다듬기(search-text)는 CLI 명령과 함께 쓰는 `apps/cli/src/adapters/cache/`에 있다.

express·Fastify 같은 프레임워크는 넣지 않았다(2026-09-19 사용자 결정). 느린 원인은 HTTP가 아니라 git 프로세스와 파일 읽기였고, 라우팅·JSON은 1ms도 안 걸린다. 보안 검사는 제품 고유라 프레임워크를 써도 직접 짜야 하며, CLI는 런타임 의존성 없이 파일 하나로 번들된다. 라우팅 정리는 경로 표와 계약의 zod 스키마로 충분했다.

## API와 조회 캐시

Query 키에는 origin·서버 세션·worktree를 포함한다. API 요청은 세션 헤더를 보내며 응답 형식과 세션을 검증한다. 명세 조회의 staleTime은 무한이고 갱신은 헤더의 새로고침 버튼뿐이다. 5초였을 때는 명세 화면 다섯이 이 조회 하나를 함께 쓰는 탓에 화면을 옮길 때마다 불러온 페이지가 전부 다시 요청됐다. 더보기를 두 번 누른 뒤 활동으로 돌아오면 3회·약 2초가 들었고 더 불러올수록 늘었다. 지금은 0회다.

API와 계약은 다음과 같다. 모두 세션 헤더가 필요하고 응답은 계약 형식과 세션을 검증한다.

| 경로 | 계약 | 내용 |
| :--- | :--- | :--- |
| `/api/v1/specs` | browser-specs v5 | 체크아웃(현재 기능과 그 요구사항·설계 문서, 위키, 참여자, 미커밋 여부, 읽지 못한 파일) 전체 |
| `/api/v1/history?head&offset&limit&kind&document&feature&id&author&q` | browser-history v3 | 조건에 맞는 변경 한 페이지와 전체 건수 |
| `/api/v1/history/summary?head` | browser-history-summary v2 | 종류별 건수, 최근 3주 커밋별 건수, 최신 커밋 셋 |
| `/api/v1/change?key` | browser-change v2 | 변경 하나의 목록 정보와 전후 본문 |
| `/api/v1/commit/files?commit` | browser-commit-files v1 | 커밋이 첫 부모 대비 바꾼 소스 파일(`.gitifact` 밖)의 경로·상태·줄 수, 500개까지와 전체 수 |
| `/api/v1/commit/file?commit&path` | browser-commit-file v1 | 그 목록의 파일 하나의 양쪽 원문. 이진 파일과 512KB 넘는 쪽은 원문 대신 표시만 |
| `/api/v1/search?q&head` | browser-search v1 | 체크아웃과 지난 변경의 검색 결과 |

소스 변경은 `server/commit/commit-files.ts`가 Git에서 바로 읽는다. 목록은 커밋마다 `rev-list --parents`로 첫 부모를 찾아 `diff --name-status`와 `diff --numstat`(루트 커밋은 `diff-tree --root`)를 한 번씩 부르고, 이름 변경은 `-M`으로 옛 경로를 함께 싣는다. 커밋은 바뀌지 않으므로 목록을 서버 메모리에 200커밋까지 두고 캐시(SQLite)에는 넣지 않는다. 01 7장의 계획은 캐시에 두는 것이었으나, 서랍을 열 때 커밋 하나만 읽으면 되고 캐시 표를 늘리면 형식 번호가 바뀌어 전체 재생성(이 저장소에서 8.6초)이 일어나 기각했다. 파일 하나는 목록에 있는 경로만 받고 `cat-file blob`으로 양쪽을 읽는다. Git이 줄 수를 세지 않은 파일, NUL이 있거나 UTF-8이 아닌 파일은 이진으로 보고 원문을 보내지 않는다. 없는 커밋과 그 커밋이 바꾸지 않은 경로는 404다.

v3까지는 체크아웃이 이력의 첫 페이지에 실렸고 화면은 불러온 페이지만 거르고 셌다. 필터가 불러온 범위에만 걸려, `.gitifact` 커밋이 10개인 프로젝트는 첫 페이지에 이력 325건·1.9MB가 한 번에 오는 반면 커밋이 많은 프로젝트는 필터가 오래된 변경을 찾지 못했다. 2026-09-19 사용자가 "DB를 쓸 때처럼 전체를 대상으로 검색·페이징해야 한다"고 해 v4에서 체크아웃과 이력을 나눴다. 0.8.0에서 문서 하나가 파일 하나인 모양으로 바꾸며 specs v5·history v3·summary v2·change v2가 되었고, 기능마다 requirements.md·design.md 하나를 싣던 이전 판은 지웠다. 체크아웃은 현재 문서뿐이라(문서 파일 하나 1MB, 파일 2만 개까지 읽는다) 통째로 보내고 화면이 거른다. 이력은 끝이 없어 서버가 거르고 세며 50건씩 준다. 목록 이벤트의 before·after는 id·title·specId·path만 담고 본문은 change로 받는다. 이력 쿼리는 HEAD를 받으므로 같은 HEAD의 답은 바뀌지 않고, 브라우저는 HEAD·조건별로 세션 동안 보관한다. 쿼리 스키마도 계약 패키지에 두어 서버와 브라우저가 같은 규칙을 쓴다. FSD의 entities는 조회를, 화면별 pages 슬라이스는 화면 구성을, `widgets/records-page`는 명세 화면이 함께 쓰는 틀과 검색 상태를 담당한다.
