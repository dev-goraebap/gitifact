<!-- gitifact-design: S-7ymbd7bqzf -->

# 제품·지침 문서 설계

## 개요

제품 설명과 구현 지침을 기능 명세와 같은 저장소 안에서 Markdown으로 관리한다. 기능 명세(spec)가 "무엇을 만드는가"라면 제품 설명(product)은 "누구를 위해 왜 만드는가", 지침 문서(guides)는 "어떻게 만드는가"를 담는다. 제품 설명은 한 파일이고 지침은 폴더 트리다. 세 폴더는 같은 ID·이력·커밋 규칙을 공유한다.

## 구조와 데이터
<!-- gitifact-ref: R-y5tidh72gk -->

`.gitifact/product/PRODUCT.md`와 `.gitifact/guides/**/*.md`를 읽는다. 제품 폴더의 다른 Markdown은 오류다. 같은 폴더의 이미지는 파싱 대상이 아니지만 제품 설명과 함께 커밋할 수 있으며, 그 허용 규칙(파일 이름과 확장자)은 core가 정의해 커밋 선택 검사와 서버 제공이 함께 쓴다. 그 밖의 파일은 선택할 수 없다. 지침의 하위 폴더 깊이는 8까지이며 폴더·파일 이름은 기능 폴더와 같은 소문자·숫자·하이픈 규칙을 따른다. 각 파일은 첫 줄의 HTML 주석 형태 ID 마커(`gitifact-product: P-난수` 또는 `gitifact-guide: G-난수`), 빈 줄, `# 제목`, 본문 순서다. 본문 안의 다른 gitifact 주석은 코드 블록 밖에서 거부한다. `.md`가 아닌 파일은 무시한다.

문서 변경 이유는 폴더별 `history.jsonl`(`.gitifact/product/history.jsonl`, `.gitifact/guides/history.jsonl`)에 둔다. 기록 형식은 기능의 history.jsonl과 같고 대상 배열이 `documents`다. 한 이유는 한 종류의 문서만 대상으로 하며, 요구사항과 문서를 함께 바꿨으면 이유를 각각 남긴다.

제품 설명은 개요·대상 사용자·원칙·범위 밖처럼 제품을 소개하는 절로 구성하고 기술 구조나 요구사항 세부는 담지 않는다. 지침 문서는 아키텍처·코드 스타일·데이터 흐름·레이아웃·디자인 시스템처럼 영역별로 나눈다.

## 저장 흐름
<!-- gitifact-ref: R-y5tidh72gk, R-hjteu77gki -->

spec working이 명세와 함께 두 폴더의 문서를 반환한다. spec save의 operations에 제품용 `set-product`(title·body)·`delete-product`와 지침용 `create-doc`(path·title·body), `update-doc`(id·title·body), `move-doc`(id·path), `delete-doc`(id)를 추가한다. set-product는 PRODUCT.md를 만들거나 갱신하며 기존 P-ID를 유지한다. path는 지침 폴더 안 상대 경로이며 `.md`로 끝난다. core가 문서를 다시 렌더링해 파싱하는 왕복 검사로 본문이 제목·ID를 바꾸지 못하게 한다. 파일 어댑터의 잠금·복구·stamp 대조는 명세와 같다.

지침 블록과 `gitifact docs workflow`는 요구사항·설계를 정리하기 전에 product 문서 전체와 작업 영역의 guides 문서를 읽도록 안내한다. 포함 규칙 메타데이터는 두지 않는다. 문서가 없는 프로젝트에서는 없다고 보고 진행한다.

## 이력과 비교
<!-- gitifact-ref: R-rtualqkge6 -->

커밋 전후 비교는 문서 ID 단위다. 경로가 바뀌면 이동, 제목·본문이 바뀌면 변경이다. spec commit의 reasons에 `{requirements: [], documents: [P-… 또는 G-…], reason}`을 받고 해당 폴더의 history.jsonl에 H-ID로 추가한다. 커밋 메시지 트레일러는 `Gitifact-Doc: <ID>`다. 커밋된 이유의 수정·삭제는 거부한다. 활동 피드의 항목은 kind가 `product`·`guide`이며 변경 전후 스냅샷을 요구사항과 같은 구조로 담는다.

## 화면
<!-- gitifact-ref: R-oh4oevufr3 -->

왼쪽 메뉴의 첫 항목은 제품(`/product`)이다. PRODUCT.md의 제목·본문을 중앙 컬럼에 그대로 렌더링하고 ID·최근 변경·변경 이력 링크만 곁들인다. 본문의 상대 경로 이미지는 `/api/v1/product/assets/<파일명>`으로 바꿔 서버가 제품 폴더의 이미지 파일만 이름으로 제공한다. 지침(`/guides`)은 상단에 검색과 열·목록 보기 전환을 두고 본문은 열 보기(기본)다. 두 보기 모두 다른 화면과 같은 중앙 컬럼 안에 있다. 열 보기는 폴더를 왼쪽에서 오른쪽으로 펼치고 남는 공간을 일러스트로 채우며, 목록 보기는 현재 폴더의 하위 폴더와 문서를 한 표로 보여주고 폴더 행으로 들어간다. 검색 중에는 전체 트리를 평면으로 보여준다. 어느 보기에서든 문서를 고르면 `/guides/$id` 상세 페이지로 이동하고, 상세의 뒤로가기는 그 문서의 폴더로 돌아간다. 활동 페이지의 명세 종류 필터에 제품·지침을 더한다.

## 주요 설계 결정

- 경로가 아니라 파일 안의 ID로 식별한다. 이름 변경과 폴더 이동에도 이력이 이어지게 하려는 선택이며, 손으로 만든 파일에는 ID를 발급하는 저장 명령을 거친다.
- 제품과 지침을 별도 폴더로 둔다. 에이전트에게 "제품 설명은 항상, 지침은 영역에 맞게"처럼 다른 읽기 지시를 줄 수 있어야 하기 때문이다. 지침 아래 하위 폴더로 두는 안은 기각했다.
- 제품 설명은 한 파일이다. 여러 문서를 폴더로 탐색하는 첫 구현은 제품 소개라는 목적에 비해 무거워 사용자 요청으로 단일 페이지로 바꿨다. 이미지는 같은 폴더에 두고 서버가 파일 이름으로만 제공한다.
- 이름은 product와 guides다. brief는 한 장짜리 요약을 연상시키고 이전 명령 이름과 겹쳐 쓰지 않았다. brand는 제품 설명의 일부라 폴더 이름으로는 좁다.
- 포함 규칙 메타데이터를 두지 않는다. frontmatter를 쓰지 않는 현재 규약과 맞추고, 관련 여부는 폴더·제목으로 판단한다.

## 자체 적용

이 저장소는 docs/architecture와 docs/bref.md를 `.gitifact/guides`(아키텍처·CLI·브라우저·기능 설계 문서·프론트엔드 3건)와 `.gitifact/product/PRODUCT.md`로 옮기고 원본을 삭제했다. 옮기면서 날짜별 경위는 빼고 현재 규칙만 남겼다. 날짜별 작업 기록(development·releases·adoption 등)은 docs에 그대로 둔다.
