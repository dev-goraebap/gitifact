# 개발 환경

## 2026-09-19 문서의 다이어그램과 알림 렌더링

브라우저가 ```mermaid 펜스를 코드로, `> [!NOTE]` 알림을 `[!NOTE]` 글자가 그대로 남은 인용문으로 보여 주던 것을 고쳤다. 저장소의 `.md`에는 아직 둘 다 쓰인 곳이 없으니 앞으로 쓰기 위한 준비다. 범위는 사용자가 골랐다. mermaid를 지연 로딩으로 담고 알림까지 함께 고치는 안을 택했고, 알림 등 경량 항목만 고치는 안과 mermaid만 넣는 안은 기각했다.

구현은 `shared/ui/document`에 모았다. Astryx Markdown의 `components.code`·`components.blockquote`를 우리 렌더러로 바꾸되, mermaid가 아닌 펜스는 CodeBlock, 표지가 없는 인용은 Blockquote 그대로다. Astryx는 이 슬롯을 바꾸면 감싸개 클래스까지 내주므로 블록 간격은 CSS 모듈이 대신 준다. mermaid는 `import('mermaid')`로만 불러 자기 청크에 두고, 색은 그리기 직전에 그 자리의 테마 토큰 계산값을 읽어 넘기며 화면 모드·색 조합이 바뀌면 다시 그린다. `securityLevel: 'strict'`·`htmlLabels: false`이고 문법 오류는 그 자리에만 원문과 이유를 보여 준다. 설계는 브라우저 design.md의 문서 읽기 절, 결정과 대가는 위키 ADR 0008에 있다.

mermaid는 12.0.0으로 시작했다가 11.17.2로 내렸다. 12.0.0은 라벨 폭을 글자와 무관하게 늘 120px로 계산해 모든 노드 상자가 같은 크기가 되고 긴 라벨이 잘린다. 한글·영문 모두, 앱 밖의 mermaid 단독 페이지에서도 같게 나와 상류 문제로 확인했다. 11.17.2는 같은 입력을 제대로 잰다. 회귀를 막는 테스트(라벨보다 좁은 상자를 잡고, 길이가 다른 두 라벨의 상자가 같으면 실패)를 브라우저 테스트에 넣었다. fastdom·strictdom이 라이선스 파일 없이 README에 MIT 전문을 두어 notices 생성기가 멈췄으므로, 그 절을 `apps/cli/licenses/`에 보관하고 대응을 등록했다.

크기: `apps/browser/dist` 1.5MB → 4.9MB, `apps/cli/dist` 2.8MB → 6.2MB. 늘어난 쪽은 대부분 mermaid가 다이어그램 종류별로 나눠 둔 청크(elk 1.4MB, cytoscape 0.4MB, katex 0.3MB)이고, 쓰지 않는 종류는 내려받지 않지만 패키지에는 실린다. 종류를 골라 담아 줄이는 것은 하지 않았다. THIRD_PARTY_NOTICES는 mermaid의 전이 의존성까지 자동으로 담겼다(186KB).

사용자가 다이어그램 페이지에서 화면이 좌우로 흔들린다고 알려 와 원인을 찾았다. mermaid는 그림을 문서에 넣어 크기를 재는데, 기본값인 `<body>`에 재면 문서가 잠깐 뷰포트보다 150px 커져 세로 스크롤바가 생겼다 사라지고 그만큼 본문이 옆으로 밀린다. 재는 자리를 화면 밖 고정 위치의 요소 하나로 지정해 없앴다. 그 요소를 `visibility:hidden`으로 숨기면 폭이 0으로 측정되므로 숨기지 않는다. 재현 테스트를 먼저 실패시켜 확인했다(문서가 스크롤되면 실패). 이때 테스트가 `vite preview`로 빌드 산출물을 띄운다는 점을 놓쳐 한동안 수정 전후가 같게 나왔다.

검증: `pnpm check` 통과(core 29·contracts 7·intro 3·CLI 136·브라우저 41). 브라우저에 `test/markdown.spec.ts` 7건을 더했다 — mermaid 렌더링과 다른 펜스 유지, 문법 오류 대체, 원문의 click·HTML 라벨이 실행되지 않음, 알림 다섯 종류와 일반 인용 구분, 알림 안의 링크·강조 유지, 라벨보다 넓은 노드 상자, 그리는 동안 문서가 스크롤되지 않음. 실제 CLI 서버로 띄운 위키 페이지에서 라이트·다크와 라벨 잘림을 확인했다(`.tmp/markdown-rendering/`). 표기 안내 페이지 `rules/markdown-notation.md`를 위키에 더했다. 커밋·푸시는 하지 않았다.

## 2026-09-18 위키 운영 방침을 README로, 지침 내재화

재정의(`.gitifact/overrides/`, `docs --eject`)를 없애고 workflow·spec·design·commit을 CLI 내장 지침 하나씩으로 되돌렸다. 위키만 프로젝트별로 달라져야 해서, 위키 운영 방침을 `.gitifact/wiki/README.md` 자체로 두고 `docs wiki`가 형식 뒤에 README를 싣게 했다. `init`은 처음 도입할 때 기본 방침(아키텍처 결정 기록을 쌓는다)으로 README를 만든다. 결정은 위키 ADR 0003(0002를 대체)에 있다.

이 저장소 위키는 기본 방침에 "개발 규칙은 `rules/`에서 관리한다"를 더한 README, `rules/`(옛 references 6건과 새 검증·문서 문체), `adr/`로 재편했다. ARCHITECTURE.md의 결정은 ADR 0004~0007로 옮기고 페이지를 지웠다. ADR 상태는 표준값(`Proposed`·`Accepted`·`Deprecated`·`Superseded by NNNN`)을 쓴다.

## 2026-09-18 위키·frontmatter·에셋·지침 재정의 (schemaVersion 2)

다른 프로젝트에서 온 보고(Codex로 AGENTS.md만 두고 도입한 뒤 Claude Code 참여자가 블록을 못 읽음)를 계기로 도입 경로를 고치고, 이어서 사용자와 논의한 저장 규약 개선을 한 번에 적용했다. 결정과 기각한 대안은 각 기능의 설계 문서에 있다.

- product·guides 두 폴더와 `P-`·`G-` ID를 `.gitifact/wiki/`와 `W-` ID 하나로 대체했다. 진입 페이지는 `README.md`다. 전환 도구는 두지 않는다(정식 버전 전, 사용자 결정).
- 파일 단위 ID는 frontmatter로 옮겼다. 절 단위 `gitifact-req`·`gitifact-ref` 주석은 그대로다. 설계 frontmatter의 `sources`가 참고 문서 목록이다. 0.4.x의 첫 줄 주석은 이력 조회를 위해 읽기만 한다.
- `.gitifact/assets/`(ID 없는 일반 파일)와 `spec working`의 경고(깨진 상대 링크, 에셋 크기·확장자·미참조, 빈 재정의)를 추가했다. 어떤 경고도 저장·커밋을 막지 않는다.
- 브라우저가 문서의 상대 링크를 그릴 때 해석한다. 저장소의 다른 파일은 열지 않고 경로만 복사한다.
- `docs <topic>`이 형식 부분과 운영 지침을 이어 출력하고, `--eject`로 `.gitifact/overrides/<topic>.md`에 복사한 운영 지침이 내장본을 대신한다.
- `update` 출력 계약 v3(`agentDocs.missing`), `browser-specs` 계약 v2, 저장 규약 schemaVersion 2. schemaVersion 1은 이유를 밝히며 거부한다.

이 저장소의 기록은 일회성 스크립트(DEV-01)로 전환했다. 이어서 위키를 README·ARCHITECTURE·references·adr 구성으로 재편하고 다섯 topic을 모두 `.gitifact/overrides/`로 빼냈으며, 위키 재정의 지침에 이 구성과 톤앤매너를 적었다. 재편 스크립트가 두 페이지의 첫 문단을 떨어뜨린 것을 발견해 복구했다. 명세 16개 파일의 첫 줄 주석을 frontmatter로 바꾸고, PRODUCT.md와 guides 7건을 `spec save`의 create-doc으로 위키에 다시 저장해 새 ID를 받았으며 로고를 assets로 옮기고 옛 폴더를 지웠다. 옛 history.jsonl의 이유는 Git 이력에 남는다.

검증: `pnpm check` 통과. core 29·contracts 7·intro 3·CLI 132·브라우저 30·패키지 설치 검사. 브라우저의 업데이트 대화상자 제목 위치 테스트가 전체 실행에서 한 번 0.14px 차이로 실패했으나 단독 3회 반복은 통과했다(열림 애니메이션 타이밍, 이번 변경과 무관).

## 2026-09-17 제품 소개 글 원본

README와 브라우저 소개 본문이 이미 10줄 어긋나 있었다(제품명 표기 `gitifact`/`Gitifact`, 저장소 상대 링크와 앱 경로). 영어 추가와 gitifact.xyz 랜딩 사이트(Cloudflare 정적 배포, 사이트가 언어 전환 담당)를 앞두고 원본을 `packages/intro/<lang>/intro.md` 하나로 정했다. 브라우저는 `@gitifact/intro/ko/intro.md?raw`로 가져오고, 사이트도 같은 패키지를 쓸 예정이다. 사이트 앱이 원본을 소유하는 안과 브라우저의 about.md를 원본으로 두는 안은 앱끼리 소스를 import하게 돼 기각했다. 본문은 PRODUCT.md와 표기가 같은 브라우저 쪽을 기준으로 삼았다.

영문 README가 없는 동안 README.md는 한국어 소개를 복사해 둔다(사용자 결정). 첫 구현은 로고를 README 머리로만 두었는데, 로고가 가장 중요하다는 사용자 지적에 따라 로고 블록을 원본에 넣고 로고 파일도 `docs/assets/`에서 `packages/intro/assets/`로 옮겼다. 브라우저는 원시 HTML을 렌더링하지 않고 CSP가 외부 이미지를 막으므로 그 블록을 번들한 로고의 Markdown 이미지로 바꾸며, 라이트·다크 화면을 캡처해 README와 같은 폭·가운데 배치를 확인했다. 복사본은 `packages/intro`의 테스트가 파일 전체 일치를 확인하며, README를 짧은 영문 안내와 사이트 링크로 바꿀 때 이 테스트를 지운다. 생성 스크립트는 곧 버릴 코드라 기각했다. 소개 글의 링크는 절대 URL만 쓰고 브라우저 소개 페이지가 제품 개요·요구사항 두 링크만 `/product`·`/features`로 바꾸며, 스모크 테스트가 이를 확인한다. README 비교와 링크 치환 검사는 일부러 틀리게 바꿔 실패하는 것을 확인했다. 브라우저 안의 `/product`는 Gitifact가 아니라 현재 열린 프로젝트의 제품 개요를 보여 주는 기존 동작을 그대로 유지했다.

## 2026-09-17 언어별 문구 구조

사용자 요청으로 1.0.0 전 영어 추가에 대비해 문구 배치를 정리했다. 계획 원문은 `.tmp/plans/i18n-structure.md`다. 영어 문안은 쓰지 않았고 언어는 한국어 하나다. CLI·core·브라우저 모두 `src/shared/i18n/ko/`에 문구를 두고, 한 줄 문구는 `messages.json`, CLI의 지침 다섯 편·GITIFACT 블록·패치노트와 브라우저 소개 본문은 Markdown이다. 규칙은 CLI 지침의 문구 절에 있다.

JSON import는 옮기기 전에 네 경로에서 확인했다. `resolveJsonModule`을 켠 뒤 CLI esbuild 번들에 인라인되고, `tsc -p tsconfig.test.json`이 JSON을 `.test-build`로 복사해 Node가 `with { type: 'json' }`로 실행하며, core `tsc`(declaration)가 dist로 복사하고, Vite 번들에 포함됐다. 카탈로그 형식은 사용자가 계획안의 JSON을 택했고 TS 모듈 대안은 기각했다.

옮기며 발견한 것 세 가지를 고쳤다. 브라우저 서버의 명세 이력은 구형 JSON 경계를 오류 메시지의 `기존 JSON` 포함 여부로 판정해 번역 시 조용히 깨질 구조였다. `LegacyBaselineError` 하위 클래스로 판정하고 테스트가 없던 경계에 테스트를 붙였다. 이름 전환 커밋 `ac54359`이 `apps/cli/README.md`의 `@tryce/cli@0.4.0`을 존재하지 않는 `gitifact@0.4.0`으로 치환한 것을 되돌렸다. `agent-block.ts`의 "파일 접근 없음" 주석이 블록 파일을 읽게 된 뒤 사실과 달라 고쳤다.

출력이 바뀌지 않았는지 따로 확인했다. CLI는 변경 전 빌드와 `--help`·`init --help`·`docs`·오류 경로 여섯 가지를 비교해 설명이 없던 `spec changes/working/save/read/diff`에 붙인 설명 외에는 같았다. 브라우저는 변경 전후 빌드를 mock API로 띄워 14개 경로의 본문 텍스트와 aria-label·title·placeholder 600줄이 같았다. 요구사항 본문 문법 `기대 동작:`을 찾는 정규식 두 곳은 화면 문구가 아니어서 옮기지 않았다.

README·소개 페이지의 공개 버전 문장과 0.3.x 설명 문단을 지우고 npm·패치노트 안내로 바꿨다. 0.2.0 스킬 파일 정리 안내는 패치노트 0.3.0 항목으로 옮겼다. 패키지 검사가 설치본 패치노트의 첫 버전과 package.json 버전의 일치, README 두 개와 소개 본문에 `gitifact@숫자`가 없음을 확인한다.

최종 `pnpm check`가 통과했다. core 27개·contracts 5개·CLI 117개·브라우저 23개와 workspace 밖 오프라인 설치·실행을 확인했다. 추가한 검사는 패치노트 파서·계약, 블록 헤더의 언어 토큰 유무 양쪽 파싱, 블록 요청 예시와 workflow 원문 대조, 패키지별 문구 호출의 자리 이름·미사용 키, read error 코드와 repository-status 계약 대조, 구형 JSON 경계다. 대조·자리 검사는 일부러 틀리게 바꿔 실패하는 것도 확인했다.

커밋은 단계별 여섯 개이며 `spec commit`으로 R-b2q2g4sgsd에 연결했다. 사용한 CLI는 작업 중 다시 빌드한 `apps/cli/dist/main.js`이고, 위 지정 해시(`e8f6f054…`)와 다른 번들이다. 명세 저장·커밋 동작은 바꾸지 않았고(문구 출처만 바뀜) 해당 테스트와 패키지 검사가 통과했지만, 이 빌드를 사용 대상으로 새로 지정하지는 않았다. 푸시·npm 게시는 하지 않았다.

## 2026-09-17 브라우저 정리와 제품 개요 대시보드

사용자 요청으로 브라우저를 손봤다. 메뉴는 제품 개요·요구사항(이전 제품 기능)·지침·활동·참여자·Git 상태 순서이고 소개 페이지는 Gitifact 소개로 README와 같은 내용을 중앙 컬럼에 보여준다. 조회 시각은 각 페이지 하단 문장 대신 헤더의 새로고침 버튼 왼쪽에 두고 "로컬 읽기 전용" 문구는 뺐다. 미커밋 명세 안내 문장은 활동·요구사항 목록에서 빼고 Git 상태 메뉴의 경고 점과 Git 상태 페이지의 배너로 옮겼다. 판정은 명세 응답의 `working`(캐시)과 Git 상태 응답의 `.gitifact/` 아래 변경 경로를 함께 본다. 셸이 명세 API를 직접 호출하도록 만든 첫 구현은 gitifact 저장소가 없는 프로젝트에서 Git 페이지에 503 오류를 남겨 되돌렸다.

지침은 페이지 제목·검색·목록 보기를 없애고 콘텐츠 영역 전체를 열 보기로 쓰며, 문서를 고르면 남는 공간에 미리보기와 상세 보기 버튼이 나온다. 제품 개요는 Astryx dashboard 템플릿의 구성을 따라 요약 타일·기능별 요구사항·변경 종류·참여자별 커밋·최근 활동을 PRODUCT.md 본문 앞에 둔다. 사용자가 보낸 플레이그라운드 링크의 코드는 붙여넣기 과정에서 손상되어 복원하지 못했고(deflate 스트림이 첫 블록에서 깨짐) 템플릿 원본을 기준으로 구성했다. recharts는 번들에 더하지 않고 인라인 SVG와 ProgressBar로 그렸으며, 계열 색 순서(파랑·주황·보라·초록)는 dataviz 검증 스크립트로 인접 쌍 색각 분리를 확인했다. 다크 테마에서 보라의 표면 대비가 3:1에 못 미쳐 범례에 값과 비율을 직접 적는다. PRODUCT.md 첫 블록의 로고 이미지는 화면에서만 생략하고 문서는 바꾸지 않았다.

명세는 지정 CLI의 spec save로 브라우저 지침·브라우저 설계·R-xqf3xsumye·R-oh4oevufr3·문서 설계를 갱신했다. 브라우저 Playwright 21개(대시보드 집계·지침 미리보기·미커밋 표시·직접 진입 3건 추가)와 실제 CLI 서버 검사가 통과했다. 전체 `pnpm check` 결과는 아래 검증 절과 커밋 기록을 따른다. 커밋·푸시는 하지 않았다.

## 2026-09-16 사용자 스토리 작성 규칙

배포 원본 gitifact-workflow에 사용자 역할·목표·이유로 요구사항 본문을 시작하는 규칙과 Markdown·save 예시를 반영했다. 수용 조건의 조건·기대 동작 형식은 유지한다. 우리 개발 지침을 사용자의 프로젝트에 전달하는 방식에 의존하지 않으며, 사용자 제품의 맥락을 따르고 근거 없는 동기를 만들지 않도록 안내한다. 새 작성과 요청받은 개정 범위에 적용하며 CLI 파서에 문형 검사를 추가하지 않았다.

자체 명세 7개 기능의 요구사항 24개를 같은 방식으로 정리했다. 기존 본문의 확정 규칙은 범위와 제약 절에 보존했고 기존 수용 조건도 유지했다. 작성 방식에 관한 수용 조건 한 건과 관련 설계 두 문서를 보완했다. 지정 CLI의 spec save로 저장했으며 ID·제목·기존 본문 제약·수용 조건 보존 24건과 참조 경고 없음, diff 형식을 확인했다.

스킬 형식 검사, skills:sync/check, 동기화·사용자 수정본 보존 검사 5개, CLI 빌드와 test:package를 통과했다. 패키지 검사는 workspace 밖 임시 프로젝트의 설치 스킬이 현재 원본과 같은지와 수정본 동기화·제거 후 원본 보존을 확인한다. 번들 해시는 직전 지정값(e8f6f054…)과 같고 배포 스킬 자산만 갱신됐다. 독립 에이전트의 작성 행동 시험과 전체 pnpm check는 이번 문서·스킬 변경에서 실행하지 않았다. 공개 패키지 게시와 커밋은 하지 않았다. DEV-01로 이 검증 기록을 직접 작성했다.

## 2026-09-16 제품·지침 문서

`.gitifact/product`와 `.gitifact/guides`를 기능 명세와 같은 기록으로 다루는 기능을 추가했다. 범위와 결정은 [제품·지침 문서 명세](../.gitifact/spec/documents/requirements.md)와 설계를 따른다. spec save에 set-product·delete-product와 create-doc·update-doc·move-doc·delete-doc, spec commit의 reasons에 documents 대상, 브라우저에 제품(PRODUCT.md 한 페이지)·지침(열 보기·목록 보기) 메뉴를 넣었다. 처음에는 제품도 폴더 탐색이었으나 사용자 요청으로 한 파일·한 페이지로 바꿨다. 스킬은 요구사항·설계 전에 제품 문서 전체와 관련 지침을 읽도록 안내한다.

같은 날 이 저장소의 docs/architecture와 docs/bref.md를 `.gitifact/guides`(지침 7건)와 `.gitifact/product/PRODUCT.md`로 옮기고 원본을 삭제했다. 날짜별 경위는 옮기지 않고 현재 규칙만 담았으며 옛 문서의 변경 경위는 Git 이력에 남아 있다. AGENTS.md·CLAUDE.md·README의 연결을 새 위치로 바꿨다.

커밋 전 `pnpm check`를 통과했다. 타입 검사·전체 빌드, core 19개·contracts 4개·CLI 110개·브라우저 19개·스킬 5개와 workspace 밖 패키지 오프라인 설치·실행을 확인했다. 제품·지침 커밋의 훅 거부 후 두 이유 파일·index·HEAD·문서 원문 보존과 정상 재시도를 검사하는 테스트를 추가하고, 해당 파일의 5개 검사를 별도로 통과했다. 전체 check는 추가 전 테스트 집합을 실행했으며 CLI 검증 범위는 합계 111개다.

검증한 로컬 개발 빌드를 제품·지침 문서의 저장·조회·비교·커밋과 기존 기능의 프로젝트 사용 대상으로 지정한다. 실행은 `node apps/cli/dist/main.js` 또는 `pnpm cli`, SHA-256은 `e8f6f054f5f811c6da65681958fdacd46efc930ac36f87ef6384f5245714b74e`다. 버전 문자열은 0.2.0이지만 공개 npm의 같은 버전과 다른 번들이며 게시하지 않았다. DEV-01로 이 검증·지정 기록을 직접 작성했고, 제품·지침 문서 쓰기는 이제 지정 빌드를 사용한다.


## 2026-09-15 Gitifact 전환 사용 빌드

제품 이름을 Gitifact로 바꾸고 공개 패키지를 `gitifact@0.1.0`(실행 명령 `gitifact`)으로 전환했다. 내부 workspace는 `@gitifact/core`·`@gitifact/contracts`·`@gitifact/browser`, 스킬은 `gitifact-workflow`, 저장 경로는 `.gitifact`, 마커는 `gitifact-spec/req/design/ref`, 트레일러는 `Gitifact-Req`·`Gitifact-Design`, 잠금·임시 파일 접두어는 `gitifact-*`, 환경 변수는 `GITIFACT_API_PORT`, 세션 헤더는 `X-Gitifact-Session`이다. 범위와 결정은 [이름 전환 계획](gitifact-transition.md)을 따른다.

새 `gitifact migrate [--dry-run]`이 `.tryce`를 `.gitifact`로 옮기고 줄 첫머리 마커만 바꾼다. CLI는 과거 커밋의 `.tryce` 경로와 `tryce-*` 마커를 읽기만 지원하고, 설계 본문의 이전 참조 마커는 파싱 결과에서 현재 이름으로 정규화해 전환 전후 비교가 비지 않게 한다. 작업 폴더에 `.tryce`만 있으면 모든 명세 명령이 MIGRATION_REQUIRED로 전환을 안내한다. 이전 Tryce 실행의 잠금 파일 이름도 계속 검사한다.

이 빌드를 프로젝트 사용 대상으로 지정한다. 실행은 `node apps/cli/dist/main.js` 또는 `pnpm cli`, 번들 SHA-256은 `9bbe7721595c08c0aa3f7b71427fae34b12f957a25d3e992f312934a9474bfc5`이다. 2026-09-15 0.2.0 배포 준비에서 같은 검증(`pnpm check`·`pnpm test:package`)을 통과한 번들 `667985b8966a625ae6b401d779eb7f6798ea8ff6775a65891a285a493e6727ea`로 지정을 갱신했다. 명세 명령의 동작은 0.1.0과 같고 브라우저만 바뀌었다. 이전 지정 빌드(3ce78ded…)는 `.tryce`만 쓰므로 이 저장소를 전환한 뒤에는 사용하지 않는다.

최종 소스의 `pnpm check`가 통과했다. core 16개·contracts 4개·CLI 106개(새 migrate 3개 포함)·브라우저 16개·스킬 5개와 workspace 밖 오프라인 패키지 설치·실행(`node_modules/gitifact`, `gitifact --version`, init·spec save/commit/read·skills·status·browser)을 확인했다. 새 시험은 전환 전 거부, dry-run 무변경, 마커 재작성과 코드 블록·이유 파일 보존, 전환 커밋의 이유·트레일러 없음, 과거 커밋 읽기와 전환 전후 diff 비어 있음, 전환 뒤 변경의 활동 피드 표시, 구형 JSON·잡파일·이전 잠금·저장소 없음 거부, 두 저장 경로가 섞인 커밋 거부를 검사한다. 첫 전체 check에서 브라우저 검사 1건이 CLI 검사와 동시 실행 중 시간 초과로 실패했고 단독 실행과 재실행에서는 통과했다.

이 저장소의 `.tryce`는 이 빌드의 migrate로 전환해 spec commit으로 커밋했다. 상세는 [자체 도입 기록](adoption.md)과 Git 이력을 따른다.

## 2026-09-15 설계 문서 지원 사용 빌드

기능별 design.md 저장·조회·비교·커밋과 브라우저 설계 탭·명세 이력을 구현했다. 저장·표시 규칙은 [기능 설계 문서](architecture/design-documents.md)를 따른다. 스킬은 새 기능의 요구사항과 설계를 함께 작성하도록 안내하며 기존 기능에는 설계를 일괄 생성하지 않는다. tasks.md는 미지원이다.

이 개발 빌드를 프로젝트 사용 대상으로 지정한다. 실행은 `node apps/cli/dist/main.js` 또는 `pnpm cli`, 번들 SHA-256은 `3ce78ded9ce020e7e290e123f62cff4e95306bf5982c47f2dd4dee5ba2bca413`이다. 아래 날짜별 이전 지정 대신 이 절을 따른다. 패키지 버전은 아직 0.5.0이며 이 변경의 npm 배포는 하지 않았다. 설계 파일을 읽는 데는 이 기능을 지원하는 빌드가 필요하다.

검증은 타입 검사·전체 빌드, core 16개·contracts 4개·CLI 103개·브라우저 20개·스킬 5개, workspace 밖 패키지 설치·실행을 통과했다. 최초 pnpm check는 CLI 테스트 두 건의 Git 시간 초과로 중단됐다. CLI 전체를 동시 실행 4개로 다시 검사해 103개 모두 통과했고, test:built에도 같은 제한을 적용했다. 제품 Git 제한 시간을 늘리거나 검증을 끄지 않았다. 마지막 스킬 예시·날짜 표시 수정 뒤 타입 검사·빌드·브라우저·스킬·패키지 검사를 다시 통과했다.

새 검사는 설계 문법·소유 ID·참조 경고·고아 파일 거부, SHA-1/SHA-256의 설계 생성·수정·이동·삭제, 이유 연결과 이전 이유 보존, dry-run 무변경, 오래된 입력·훅 거부 후 파일과 index 보존을 확인한다. 실제 Git에서 읽은 설계 전후와 요구사항/설계 혼합 커밋을 확인했고, 브라우저는 탭 URL·이동한 참조·누락 참조·필터·모바일 표시를 검사했다. 기존 CRLF·필터·부분 staging·worktree·실패 복구 검사도 함께 통과했다.

설계 지원 명령의 검증·지정 전에는 기존 지정 CLI로 요구사항을 개정했다. 첫 자체 설계는 지정 후 spec save로 [Git 기록 연결](../.tryce/spec/git-history/design.md)에 작성했다. working의 누락 참조 경고는 없으며 changes는 요구사항 7건과 설계 생성 1건을 반환한다. 실제 프로젝트 API와 설계 탭 표시도 확인했다. 아직 미커밋이므로 설계는 제품 기능에 보이고 영구 이력에는 나타나지 않는다. DEV-01은 기능 설계 규약과 이 검증 문서 작성에만 적용했다. 커밋·푸시·배포는 별도 요청 시 진행한다.

같은 Windows 환경에서 small 커밋 벤치마크를 각 3회 실행했다. 첫 실행을 제외한 중앙값은 명세+코드가 기존 2.08초 / 새 빌드 1.85초, 코드만은 1.99초 / 1.84초였으며 Git 호출은 각각 26회·25회로 같았다. 이 측정은 기존 요구사항 시나리오에 대한 추가 비용 확인이며 대규모 설계 문서 성능을 의미하지 않는다. 차이는 실행 편차를 포함한다. 원자료는 .tmp/design-development의 baseline-quiet.json과 design-quiet.json이다. 실제 프로젝트의 첫 명세 API 조회는 약 1.0초였고, 별도의 장기·대규모 설계 이력 측정은 하지 않았다.

### 기존 기능 설계 작성

사용자의 전체 기능 설계 작성 요청으로 나머지 다섯 기능에도 지정 CLI의 spec save로 design.md를 작성했다. 총 여섯 기능의 설계가 같은 폴더의 요구사항을 참조한다. 에이전트 작업 흐름, 명세 관리, 도입, 브라우저, 기여자의 현재 구현 구조와 처리 흐름·오류·제한을 기록했다. 영속 색인, 분리·통합 관계 데이터, 일반 마이그레이션 등 미구현 항목은 구현된 것으로 쓰지 않았다. 기능 명세 요구사항에 남은 설계 제외 문구도 확정된 범위에 맞췄다. 이전 절의 한 문서·미커밋 상태는 최초 확인 시점의 기록이다.

## MVP 관련 파일 커밋 실행 개발 빌드

2026-09-14 기본 커밋 정책을 관련 명세·이유·코드·테스트의 단일 커밋으로 정리하고 `spec-preview commit-plan/commit-apply --experimental`을 연결했다. 분리 정책에서는 명세·이유를 먼저 커밋하고 코드 커밋에서 실제 R-ID를 참조한다. 명세만 또는 코드만 변경하는 작업도 지원한다. 원문·정책·index를 계획에 묶고 실행 직전 다시 검사한다. 실행 입력과 제한은 [MVP 전환 계획](mvp-transition.md)의 관련 파일 커밋 실행 절을 따른다.

기존 staging과 intent-to-add가 있으면 보존하고 보류한다. 별도 index에서 선택 파일만 staging하며 Git 훅·서명을 따른다. 실제 커밋 tree·부모·R-ID 참조를 검증한 뒤 index를 반영한다. HEAD가 바뀌지 않은 실패는 소유한 잠금을 정리해 재시도할 수 있고, HEAD 변경 후 결과가 불확실하면 원래·임시 index와 복구 자료를 보존하고 중복 실행을 막는다. 강제 종료 후 자동 복구·일부 미커밋 명세만 선택·기존 staging의 자동 병합은 미지원이다.

첫 시험에서 정책 파일의 경로를 커밋 선택 경로처럼 제한한 오류를 발견해 역할을 구분했다. 빈 Git template로 만든 시험 저장소에는 hooks 폴더도 없으므로 테스트 준비를 수정했다. 이후 관련 7개 테스트가 통과했고, 마지막으로 index 복사본을 사용해 관계없는 플래그를 보존하도록 보강했다.

최종 소스의 `pnpm check`가 통과했다. core 19개·contracts 7개·CLI 114개·브라우저 9개·스킬 5개로 총 154개 테스트와 외부 오프라인 패키지 설치·실행을 확인했다. SHA-1/SHA-256 함께 커밋, 명세/코드 분리와 R-ID 참조, 기존 staging·intent-to-add·index 플래그 보존, 명세·코드·지침 변경 감지, 훅 실패 후 재시도, 훅이 커밋 내용을 바꾼 경우 복구 자료 보존을 검증했다. 문서 로컬 링크 69개와 diff 형식도 확인했다. 새 커밋 실행의 linked worktree·강제 종료·실제 서명 키 동작은 별도 시험하지 않았다.

`.tmp/spec-commit-demo/`는 실제 CLI로 명세·이유·구현·테스트를 한 커밋에 담은 독립 저장소다. R-4ktb7euauo, 시험 커밋 `40cf3d8cb94b40c43688fdb2b14a52714526bdc2`를 만들었고 빈 제목 거부·정상 제목 저장 테스트 2개가 통과했다. 커밋 후 데모 작업 폴더가 깨끗하며 입력·결과·commit.txt를 보존했다. 루트 Tryce의 Git 커밋이 아니다.

개발 번들 SHA-256은 `7db4c31ca11e7d5c28f6649737b9adebe91e0a51eb9c6fe1e8187da82ce17801`다. 새 기록용 프로젝트 사용 버전으로 지정하지 않았다. 기존 .tryce·기준선·0.3.0 지정 CLI는 유지한다. DEV-01로 정책·설계·검증 문서를 직접 갱신했으며 루트 커밋·푸시·npm 배포는 하지 않았다.

## MVP 커밋 이유 준비 개발 빌드

2026-09-14 `spec-preview changes/prepare/verify --experimental`을 추가했다. HEAD와 현재 명세의 최종 차이를 구하고, 확인된 이유를 스펙별 history.jsonl에 준비한다. 여러 초안 수정은 한 최종 차이로 비교한다. 커밋된 이유의 원문 바이트는 보존하고 미커밋 이유만 다시 구성한다. 같은 준비의 반복은 H-ID를 재사용하며 원복한 요구사항에는 이유를 추가하지 않는다.

changes는 미커밋 이유를 pendingReasons로 함께 반환한다. prepare에는 이를 확인해 유지할 이유를 포함한 최종 reasons 전체를 전달한다. 이유가 없는 변경은 withoutReason으로 표시한다. prepare의 verification 객체로 원문·HEAD가 그대로인지 검사하고, verify --staged로 index 원문 일치까지 확인할 수 있다. staging·커밋 실행·기존 형식 전환은 수행하지 않는다. 입력 예시와 보존·제거 범위는 [MVP 전환 계획](mvp-transition.md)의 커밋 이유 준비 절을 따른다.

`pnpm check`에서 core 19개·contracts 7개·CLI 107개·브라우저 9개·스킬 5개, 총 147개 테스트와 외부 오프라인 패키지 설치가 통과했다. 이후 pendingReasons 응답을 보강했고 CLI 타입 검사·재빌드, 관련 8개 테스트와 `pnpm test:package`를 다시 통과했다. 최종 보완 뒤 전체 check를 다시 반복한 것은 아니다. 문서 로컬 링크 68개와 diff 형식 검사도 통과했다.

`.tmp/spec-prepare-demo/`에 실제 개발 CLI와 독립 Git 저장소로 만든 예시를 남겼다. 최초 기능을 커밋하고 요구사항을 두 번 고친 뒤 최종 이유를 준비·staging 검증·커밋했다. 비교 결과는 R-qssyoe6f3p의 수정 1건과 새 이유 1건이며 history.jsonl은 초기 이유와 최종 수정 이유 두 줄이다. 입력·결과·committed-diff.json을 함께 보존했다. 루트 Tryce의 커밋이 아니다.

개발 번들 SHA-256은 `f91c67bbaef688cbee76602cf9d2958f80aae896574b39d601c21951eff2e8cd`다. 실제 프로젝트 기록용 0.3.0 지정은 유지한다. Git 통합 작업 중 준비, 전체 기능·과거 이유 삭제, merge·squash 이유 연결과 검증 후 커밋까지의 원자적 실행은 아직 지원하지 않는다. 강제 종료 후 자동 복구도 기존 실험 단계의 제한을 유지한다. DEV-01로 설계·시험 결과를 문서에 기록했으며 루트 .tryce 전환·커밋·푸시·npm 배포는 하지 않았다.

## MVP 초안 편집 개발 빌드

2026-09-14 `spec-preview working/save --experimental`을 추가했다. Markdown 생성·요구사항 추가·수정·이동·문서 제목 변경을 지원한다. 입력과 제한은 [MVP 전환 계획](mvp-transition.md)의 초안 생성·수정·이동 구현 절을 따른다. 기존 프로젝트 형식은 거부하며 Git index·HEAD·설정·history.jsonl을 수정하지 않는다.

새 테스트로 SHA-1/SHA-256 저장소의 생성·수정·이동과 ID 유지, staging 보존, 오래된 입력·중복·본문 구조 삽입 거부를 확인했다. 두 번째 파일 저장 실패 시 CRLF 원문 복구와 외부 편집이 있으면 이를 보존하고 복구 자료를 남기는 경로를 검사했다. 강제 종료·전원 장애의 자동 복구와 새 기능의 linked worktree 시험은 아직 하지 않았다. 다중 파일 반영은 파일별 rename이므로 실험 단계에서 중단 시 수동 복구가 필요할 수 있다.

최종 소스의 `pnpm check`가 통과했다. core 19개·contracts 7개·CLI 99개·브라우저 9개·스킬 5개, 총 139개 테스트와 workspace 밖 오프라인 패키지 설치·실행을 확인했다. 기존 기록 기능의 회귀 검사도 포함한다.

참고용 `.tmp/spec-write-demo/`는 새 독립 Git 저장소에서 실제 CLI로 만든 결과다. 초기 파일은 initial/requirements.md, 현재 원문은 repo/.tryce/spec/my-profile/requirements.md다. 가상의 본인 프로필 이미지 변경을 사원 관리에 잘못 배치했다가 내 프로필로 이동하며 R-k7tz7ladmc를 유지했다. 입력·결과 JSON도 함께 남겼다. 임시 자료 없이도 추적된 테스트에서 같은 시나리오를 실행할 수 있다.

개발 번들 SHA-256은 `fe2c4f702b500491594f68c71aa72b1bb559473eaae0243bfc2e96f8e4b996c6`다. 실제 프로젝트의 기존 기록용 0.3.0 사본과 해시를 다시 확인했고 해당 지정은 유지한다. 이번 설계 문서는 DEV-01로 직접 갱신했다. 루트 .tryce 전환·커밋·푸시·npm 배포는 하지 않았다.

## MVP 읽기·비교 개발 빌드

2026-09-14 Markdown 검토 형식의 spec-preview 명령을 개발 소스에 추가했다. 실행 범위와 문법은 [MVP 전환 계획](mvp-transition.md)의 첫 읽기·비교 구현 절을 따른다. 새 빌드는 실험용 조회를 포함하며 기존 프로젝트 쓰기 도구로 자동 지정하지 않는다.

기존 지정 CLI 0.3.0 바이트는 `.tmp/record-cli-0.3.0/main.mjs`에 보존했고 SHA-256 `45f28813c9b8020d5949ff19cad8e5d6236781ad891853640674ba117c68297a`를 확인했다. 이 checkout의 기존 기록·커밋 작업에는 `node .tmp/record-cli-0.3.0/main.mjs`를 사용한다. 임시 사본이 없는 새 checkout은 기존 지정 릴리스와 해시를 확인해 준비하며 새 개발 빌드를 대신 신뢰하지 않는다. 현재 apps/cli/dist/main.js는 새 개발 빌드다.

검증: `pnpm check`가 core 16개·contracts 7개·CLI 92개·브라우저 9개·스킬 5개와 외부 오프라인 패키지 설치를 통과했다. 실행 중 보강한 링크·서브모듈 거부와 전체 조회 크기 제한은 이후 CLI 타입 검사·재빌드, spec-preview 관련 9개 테스트와 `pnpm test:package`를 다시 실행해 확인했다. 추가 UTF-8·링크 시험도 통과했다. 전체 조회 크기 상한의 경계값과 대규모 성능은 별도 시험이 필요하다. 최종 변경 이후 전체 check를 다시 반복한 것은 아니다.

기존 이동 fixture를 실제 새 CLI로 읽어 R-b6fq2ry4ns의 moved 한 건과 이유 연결을 확인했다. 문서 로컬 링크 66개와 diff 형식 검사도 통과했다. 최종 개발 번들 SHA-256은 `c4395fd0b6f67e07e5c8ecf6c22f68294b6e813352149650fb92839eeb1d0600`이며 쓰기용 지정·npm 게시·루트 커밋·푸시는 하지 않았다. 미확정 새 형식의 설계 기록은 DEV-01로 전환 계획에 남겼다.

> 기존 기록용 CLI는 위에 보존한 0.3.0 바이트를 사용한다. 아래의 이전 버전 설명·테스트 결과는 당시 실행 기록이며 새 목표를 의미하지 않는다. [MVP 전환 계획](mvp-transition.md)의 실험용 조회·편집·커밋 이유 준비를 제외한 새 커밋 실행 통합과 전환은 아직 구현하지 않았다. 기존 specs 링크는 삭제 전 Git 버전에 고정했다.


현재 프로젝트 사용 CLI는 0.3.0이다. `init`·`mode`로 설정과 정책을 관리하고 `note`·`req`로 판단과 요구사항을 기록한다. `brief`는 현재 자료와 원문 위치를 제공하며 `commit plan/apply`로 관련 기록을 커밋한다. `status`·`browser`는 Git 상태를 조회하고 `skills install/sync/remove`는 스킬 원본 설치와 로컬 복사본 관리를 지원한다. 전체 Git 이력 검사·훅·브라우저 편집은 미지원이다. 이 저장소의 자동모드 전환과 초기 요구사항 범위는 [자체 도입 기록](adoption.md)을 따른다. 아래 날짜별 검증 기록은 당시 상태를 보존한다.

## 사용자 프로젝트 시험과 첫 npm 배포

현재 demo는 2026-09-14 auto/approval 시나리오 시험을 마친 approval 모드다. 설치 CLI는 0.3.0이고 스킬은 `64125cb`의 개선본을 별도 적용했다. 실행은 `node node_modules/@tryce/cli/dist/main.js`, demo 기능 테스트는 `node --test`다. 실제 결과와 미검증 범위는 [자체 도입 기록](adoption.md#2026-09-14-로컬-demo-시나리오)을 따른다. 아래는 최초 설치 당시 기록이다.

2026-09-13 사용자 지정으로 `.tmp/demo`에 독립 Git 저장소를 두고 prototype 모드의 도입·사용 흐름을 시험한다. 상위 저장소에서는 `.tmp/`를 ignore한다. 이곳은 지속해서 살펴볼 데모이며 자동 테스트의 매번 새로 만드는 임시 저장소를 대체하지 않는다. 기존 데모는 자동 삭제·재초기화하지 않는다.

demo는 첫 공개 게시 후 npm 레지스트리의 `@tryce/cli@0.1.0`으로 갱신했다. 이전에는 `.tmp/skills-package/tryce-cli-0.0.0.tgz`를 오프라인 설치해 사용했다. demo에서 `npm run tryce -- brief --format text`처럼 설치한 CLI를 실행한다. 개발 빌드 직접 실행과 구분한다. 중첩 저장소에서 상위 workspace의 의존성이 보일 수 있으므로 운영체제 임시 폴더의 오프라인 패키지 설치 검증도 유지한다.

사용자가 확정한 공개 npm 패키지 이름은 `@tryce/cli`다. 스킬 설치·갱신·제거와 demo 사용, workspace 밖 설치 검증을 마친 뒤 첫 배포를 진행한다. 배포 직전에 이름 사용 가능 여부와 계정 게시 권한, 패키지 내용·라이선스·버전·문서를 확인한다. 공개 CLI 이름을 `tryce`, 첫 버전을 `0.1.0`, 라이선스를 MIT로 지정했다. 실제 게시·설치 확인은 [배포 절차](releases.md)에 따라 수행하고 결과를 별도로 기록한다.

## 개발 에이전트 사용

Codex는 `.agents/skills/gitifact-workflow/SKILL.md`를 원본으로 사용한다. Claude Code로 이 저장소를 작업할 때는 `pnpm skills:sync`로 로컬 복사본을 생성하고 `pnpm skills:check`로 일치를 확인한다. 사용자 전역 설정은 바꾸지 않는다. 원본 변경 후 sync를 다시 실행한다. 상세 보존·복구·제거 절차는 [스킬 연결](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/agent-skills.md)을 따른다.

스킬에서 예시로 쓰는 `gitifact`는 이 저장소에서 `pnpm cli`다. 기계 출력이 필요하면 `node apps/cli/dist/main.js`를 사용한다. 기존에 지정한 CLI 빌드를 유지한다. 개발용 스킬 동기화는 2026-09-13 임시 폴더 테스트 5개와 스킬 형식 검증을 통과했다. DEV-04는 유지한다.

## 준비와 실행

개발 기준은 Node.js 24.17.0과 pnpm 10.33.0이다. `.node-version`과 루트 `packageManager`에 고정했다. 공개 패키지는 @tryce/cli이며 실행 명령은 tryce다. 나머지 workspace 패키지는 private이다. 0.1.0은 Node.js 24 계열을 지원 범위로 선언한다.

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

현재 checkout을 읽는 서버가 127.0.0.1의 빈 포트에서 실행된다. 터미널에 표시된 URL로 접속하고 Ctrl+C로 종료한다. 브라우저는 자동으로 열지 않는다. 화면은 browser-design-v2의 구조를 적용한 읽기 전용 브리핑·요구사항·판단 기록·Git 상태를 제공한다. 전체 추적 그래프·건강 검사·스킬 탐색은 아직 제공하지 않는다.

화면 개발 중에는 두 터미널에서 각각 실행한다.

```sh
pnpm cli browser --dev --port 4317
```

```sh
pnpm dev
```

Vite 주소는 `http://127.0.0.1:5173`이다. `/api`를 CLI 서버로 전달한다. API 포트를 바꾸려면 Vite 실행 환경의 `GITIFACT_API_PORT`도 맞춘다. Vite만 켜고 CLI 서버가 없으면 화면은 열리지만 세션 요청이 502로 실패해 불러오지 못했다는 상태가 뜬다. 통합 실행은 `--dev` 없이 사용한다. 상세 계약은 [로컬 브라우저 서버](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/browser-server.md)를 따른다.

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

다른 프로젝트에서는 빌드한 `apps/cli/dist/main.js`의 절대 경로로 실행한다. 실행 위치의 checkout을 조회한다. 파일 변경이 없거나 충돌이 있어도 tryce 검사는 항상 미실행으로 표시한다. 상세 계약은 [저장소 상태 조회](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/repository-status.md)를 따른다.

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
- 2026-09-15부터 루트 `.gitattributes`로 모든 텍스트 파일을 LF로 저장·checkout한다. 운영체제나 core.autocrlf와 관계없이 명세·코드의 바이트를 같게 유지하기 위해서다. 추가 시점에 추적 텍스트 218개가 이미 LF로 커밋돼 있어 정규화 커밋은 필요 없었다. 바이너리 PNG·woff2는 binary로 명시했다. 미커밋 변경을 보존하려고 기존 작업 폴더를 다시 checkout하지 않았으므로 일부 파일은 커밋 전까지 CRLF로 남을 수 있다. init이 사용자 프로젝트에 같은 파일을 만들지는 결정하지 않았다.

빌드는 공통 패키지·브라우저·CLI 순서로 수행한다. CLI에 브라우저 자산을 포함하므로 설치한 패키지만으로 서버를 실행할 수 있다. 패키징 검증은 설치된 CLI의 HTML·JS·CSS·직접 URL과 실제 API 새로고침까지 포함한다.

## 검증 기록과 다음 작업

2026-09-13 Windows / Node.js 24.17.0 / pnpm 10.33.0 / Git 2.53.0.windows.1에서 `pnpm check`가 통과했다. core 3개, contracts 4개, CLI 32개, Chromium 6개와 별도의 오프라인 패키지 설치 검증을 수행했다. Chromium에서는 실제 CLI 서버의 임시 Git 저장소 조회·새로고침·직접 URL을 확인했다. 제어한 API 응답으로 로딩·실패 후 이전 결과 유지·세션과 계약 불일치도 확인했다. frozen lockfile 설치는 앞선 환경 구축에서 확인했다.

Git 통합 시험에는 unborn·detached HEAD, 부분 staging, 삭제·타입 변경·intent-to-add, rename 추론 해제, 충돌, linked worktree, submodule, SHA-256, Git 부재·손상과 전체 파일 내용 보존을 포함한다. 탭·줄바꿈 등 Windows 파일명 제약이 있는 경로는 파서 fixture로 검증했다. 권한 오류 분류와 조회 중 경합·출력 제한은 제어한 입력으로 검증했으며 macOS·Linux에서의 실제 실행과 요구사항 기록 형식 호환성은 미실행이다.

개발 예외 DEV-01로 문서를 직접 작성하고 DEV-02로 기본 도구의 검사를 사용했다. 요구사항 기록·검사 범위에서는 이 예외를 유지한다. 초기화만 별도의 검증·지정 대상으로 다룬다.

통합 서버의 실제 화면과 새로고침을 별도로 확인했다. Vite 개발 프록시의 실제 화면 검증은 5173 포트가 이미 사용 중이어서 수행하지 못했다. 기존 프로세스는 종료하지 않았다. 개발 Origin 허용·거부는 HTTP 테스트로 검증했다.

첫 조회의 입력·출력과 Git 스냅샷 경계는 [저장소 상태 조회 명세](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/repository-status.md), HTTP·세션·캐시는 [로컬 브라우저 서버](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/browser-server.md)에 정리했다. 도입 기준선은 init-1에 정의했고, 요구사항 기록·검사·brief에 필요한 나머지 영속 형식은 후속 명세에서 정의한다. 관련 기준은 [아키텍처](architecture/README.md)와 [제품 기준](bref.md)을 따른다.

설정과 도입 기준선 생성은 [프로젝트 초기화](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/project-init.md), 저장 형식과 호환성은 [init-1](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/project-format.md)을 따른다. 최초 생성에는 `pnpm cli init --mode prototype` 또는 `--mode normal`을 사용한다. `--dry-run`은 계획만 확인하고, 기존 설정 확인은 `pnpm cli init`으로 실행한다. 최초 생성 후 설정을 커밋할지는 별도 Git 작업으로 결정한다.

## 초기화 검증과 프로젝트 사용 빌드

2026-09-13 Windows에서 init 추가 후 pnpm check가 통과했다. core 5개, contracts 4개, CLI 44개, Chromium 6개와 오프라인 패키지 설치·초기화·재실행을 검증했다.

init은 실제 임시 저장소에서 dry-run 무변경, 일반·unborn·detached·SHA-256, 부분 staging 보존, ignore·설정 삭제·잘못된 형식·junction 거부, 동시 생성, linked worktree·clone·submodule을 확인했다. 확정 전후 프로세스 종료와 재실행, 남은 임시 파일 보존도 확인했다. 쓰기 도중 실패와 입력 변경은 제어한 시점에 주입했다. 실제 디스크 부족·전원 손실·ACL 접근 거부, 외부 프로세스의 지속적인 경로 교체, macOS·Linux 실행은 미검증이다.

프로젝트 초기화 사용 빌드로 로컬 apps/cli/dist/main.js (CLI 0.0.0, SHA-256 0fd72559bc07b90d46af076e1bf1c114e3964f0bcd600a84c3594c3c3aee56ab)를 지정한다. 지원 범위는 init-1의 최초 생성·재실행과 Git 관측이다. 빌드를 다시 만들면 같은 검증 없이 자동으로 새 프로젝트 쓰기 도구로 지정하지 않는다. 요구사항 기록·check·스킬·훅에는 이 지정이 적용되지 않는다.

지정한 빌드로 이 저장소에 `init --mode prototype`을 적용했다. 기준선은 `9fbe58b582f9d5a158d575405f2d912cf6b10e0d`이고 생성 파일은 [.tryce/config.json](../.tryce/config.json) 하나다. 재실행에서 이미 초기화됨 결과, 설정 바이트·Git index·HEAD 보존을 확인했다. 초기화 직후 설정은 미커밋 상태였으며, 기존 docs를 요구사항이나 승인 기록으로 자동 변환하지 않았다. DEV-01은 일반 문서·미지원 기록에, DEV-02는 요구사항 검사에 계속 적용한다. DEV-04의 스킬·연동 준비도 유지한다.

## 프로토타입 기록 실행

첫 활성화는 `pnpm cli note enable --dry-run`으로 계획을 확인한 뒤 `pnpm cli note enable`로 수행한다. init-1 원본을 보존하고 format만 prototype-1로 전환한다. 모드와 기준선은 유지한다. 명세는 [프로토타입 기록](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/prototype-notes.md)을 따른다.

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

지정한 빌드로 이 저장소에 note enable을 적용했다. 원본은 [config.init-1.b47160756686330516d729c6e605c7a2d5d885610a2531bb0a6813e50a501f13.json](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/.tryce/config.init-1.b47160756686330516d729c6e605c7a2d5d885610a2531bb0a6813e50a501f13.json)에 보존했고, format만 prototype-1로 바꿨다. prototype 모드와 기준선, Git index·HEAD를 유지했다. 실제 근거가 있는 발견·제약·기각 이유 세 개를 note add로 작성하고 list·show로 재조회했다. 활성화 직후 기록과 전환 파일은 미커밋 상태였다.

자체 적용한 기록:

- [discovery: N-633cb083-c215-46e9-bcd3-923a5da45aed](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/.tryce/notes/N-633cb083-c215-46e9-bcd3-923a5da45aed.json)
- [constraint: N-ebaf0e3d-74e6-4beb-85ce-314d37854b36](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/.tryce/notes/N-ebaf0e3d-74e6-4beb-85ce-314d37854b36.json)
- [rejected: N-478d7df1-01b8-42af-9c68-9dc7ad512cbd](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/.tryce/notes/N-478d7df1-01b8-42af-9c68-9dc7ad512cbd.json)

DEV-01은 검증·지정한 note의 발견·제약·기각 이유 작성 범위에서 축소한다. 일반 문서와 미지원 요구사항·승인 기록에는 유지한다. DEV-02의 요구사항 검사, DEV-04의 스킬·연동 준비도 유지한다.

## 세션 브리핑 실행

```sh
pnpm cli brief --format text
pnpm cli brief --all
```

기본 JSON은 기계 입력용이며 text는 사람이 확인할 때 사용한다. 기본 출력은 기록 20개·본문 240 Unicode 코드 포인트, Git 변경 20개, 문서 위치 30개다. total·included·omitted와 본문 생략 표시를 확인하고, 필요한 원문은 note show 또는 brief --all로 읽는다. 전체 지원 범위와 제한은 [세션 브리핑 명세](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/session-brief.md)를 따른다.

설정·기록·문서 중 일부를 읽지 못하면 stderr의 JSON에 부분 report와 오류를 제공하고 종료 코드 1을 반환한다. Git 상태 자체가 바뀌거나 읽히지 않으면 report는 null이다. 초기화 전 상태와 note 미활성화는 명시한 정상 관측 상태이며 자동으로 초기화하지 않는다. 요구사항 검사·미결 질문 추출·과거 이력 분석은 아직 미실행·미지원이다.

## 브리핑 검증과 사용 빌드

2026-09-13 Windows에서 pnpm check가 통과했다. core 9개, contracts 6개, CLI 59개, Chromium 6개로 총 80개 테스트와 오프라인 설치 검증을 수행했다. 설치한 CLI의 brief --all이 프로젝트 모드·실제 note·생략 0·검사 미실행을 반환하는 것도 확인했다.

프로젝트 사용 빌드는 apps/cli/dist/main.js (CLI 0.0.0, SHA-256 bd2c7abf2353ed951d56eb90e5bf6805f4c122294af4ccc06b1accaa4f27006e)로 갱신한다. 검증한 init·note·Git 관측과 brief에 사용한다. 요구사항 검사·스킬·훅에는 이 지정이 적용되지 않는다.

brief의 정렬·Unicode 발췌·생략 집계·목록 밖 정정 관계, 초기화 전 상태, init-1, prototype-1, 손상·삭제·미지원 형식·잠금, Git·설정·기록 변경 중 조회, linked worktree, 문서 junction 거부, stdout/stderr·부분 보고서와 전체 파일 보존을 확인했다. 문서 본문·모든 지침 탐색·과거 이력·실제 권한 차단·지속적인 외부 경로 교체·macOS·Linux 실행은 미검증 또는 지원 범위 밖이다.

자체 적용에서 brief --all이 prototype 모드, 기존 기준선, 기록 4개와 문서 위치 13개를 반환하는 것을 확인했다. brief 실행 전후 .tryce와 Git 파일 지문이 같았다. 부분 실패 처리의 실제 검증 결과를 [발견 기록](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/.tryce/notes/N-4840375c-a0e2-469f-a371-868aeae6927a.json)으로 남겼다. AGENTS.md의 작업 시작 절차를 brief로 연결했고, DEV-02는 지원한 현재 자료 브리핑 범위에서 축소했다. 요구사항 검사·미결 질문 추출·과거 이력 분석의 예외는 유지한다. 이 자체 적용 단계에서는 커밋·푸시를 수행하지 않았다.

## CLI 스킬 배포 검증과 사용 빌드

2026-09-13 pnpm check가 통과했다. core 9개, contracts 6개, CLI 67개, Chromium 6개, 개발 동기화 5개로 총 93개 테스트와 workspace 밖 오프라인 설치 검증을 수행했다. 패키지에는 스킬 원본이 포함되며 설치된 CLI로 install·원본 편집·sync·remove와 원본 보존을 확인했다.

이후 제품 잠금·미지원 매니페스트 보존, linked worktree 격리, 저널 게시 후 사용자 수정 보존의 테스트 3개를 추가 실행해 통과했다. 전체 실행 93개와 추가 3개로 총 96개를 검증했으며 추가 시험을 위해 제품 코드는 바꾸지 않았다. .tmp/demo에서도 같은 설치물로 dry-run·install·sync·remove·재설치, 설정 보존과 원본 잔존, 로컬 파일 ignore, note 작성·brief 조회를 확인했다.

프로젝트 사용 빌드는 apps/cli/dist/main.js (CLI 0.0.0, SHA-256 167e607bae031fa561c9bd3f0f292ce9eeed430a249cbba5dd9fb7aea777c6cc)로 갱신한다. 검증한 기존 init·note·brief·Git 관측과 skills install/sync/remove를 지원한다. 같은 해시의 설치 패키지를 .tmp/demo 시험에 사용한다. 상세 규약과 실패 복구는 [프로젝트 스킬 배포](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/skill-distribution.md)를 따른다.

현재 개발 저장소의 Claude 복사본은 기존 개발 스크립트가 관리한다. CLI 매니페스트로 자동 채택하지 않으며 pnpm skills:sync 절차를 유지한다. DEV-04는 이 이전 연결과 미지원 upgrade·전체 eject·훅에 남는다. 새 사용자 프로젝트에는 CLI 명령을 사용한다. 실제 에이전트의 자동 선택과 macOS·Linux 실행은 미검증이다.

## 0.1.0 배포 후보 검증

2026-09-13 공개 이름 tryce와 MIT 라이선스를 반영한 pnpm check가 통과했다. core 9개, contracts 6개, CLI 70개, Chromium 6개, 개발 동기화 5개로 총 96개 테스트와 workspace 밖 오프라인 설치·실행 검증을 수행했다. 고정 lockfile 설치도 통과했다.

프로젝트 사용 빌드를 CLI 0.1.0, SHA-256 d55b21a1a9deaf8c5147b4ad619bc0334a2b61a3486c460e30450f9e7f9ce74f로 갱신한다. 이전 지정 빌드의 기능 범위를 유지한다. 당시 .tmp/releases/0.1.0/tryce-0.1.0.tgz의 파일 목록과 npm publish dry-run을 확인했다. 이후 게시 방식은 apps/cli 패키지 폴더에서 pnpm publish를 실행하도록 바꿨다. 준비 명령과 게시 여부는 [배포 절차](releases.md)를 따른다.

같은 날 공개 패키지 이름을 @tryce/cli로 변경한 뒤 고정 lockfile 설치와 pnpm check를 다시 통과했다. 테스트 96개 및 workspace 밖 오프라인 설치·실행을 확인했고, 지정한 CLI 빌드의 해시는 유지됐다. 패키지 이름과 README가 달라져 배포 integrity는 갱신했다. 새 값과 미확인 조직 권한은 [배포 절차](releases.md)에 기록한다.

## 자동모드·승인모드와 요구사항 기록 검증

2026-09-13 개발 버전 `0.2.0-dev.0`에서 `pnpm check`가 통과했다. core 11개, contracts 7개, CLI 80개, Chromium 6개, 스킬 동기화 5개로 총 109개 테스트와 workspace 밖 오프라인 패키지 설치·실행을 확인했다. 최종 패키지에는 검증한 CLI 바이트와 최신 스킬 원본이 그대로 포함된다. 스킬 형식 검사, 로컬 복사본 일치, 변경 문서 링크도 확인했다. npm 게시와 원격 푸시는 수행하지 않았다.

검증 범위는 신규 auto 기본값, 두 모드의 note, legacy 전환 원문·기준선·note 보존, 반복 모드 변경과 승인 비소급, 묶음 확인·수정 후 재확인, 과거 승인 원문 보존, HEAD·index에 보존된 기록의 변경 거부다. 오래된 계획과 지침 변경, 기존 staging 보존, 무관한 작업 파일 제외, 훅 실패 후 복구 자료 보존, Git 필터의 기록 변경 거부, linked SHA-256 worktree에서 다른 checkout의 index 보존도 확인했다. 배포된 0.1.0 바이너리가 workflow-1을 거부하고 설정 바이트를 보존하는 별도 호환성 시험도 통과했다.

초기 통합 실행에서 발견한 기존 brief 한국어 표시 회귀와 commit 계획의 읽기 명령이 index를 갱신하는 문제를 수정한 뒤 전체 검증을 다시 통과했다. 검증 로그·패키지·호환성 시험 저장소는 `.tmp/validation-archive/2026-09-13/`에 둔다. 이 임시 자료 없이도 추적된 테스트로 검증할 수 있다.

프로젝트 사용 빌드는 `apps/cli/dist/main.js`, CLI `0.2.0-dev.0`, SHA-256 `daeb1e1bf4ac8867eed8ee281bd089c7f1d2f449a1f04976214aa6e46344e92d`로 지정한다. 기존 init·note·brief·Git 관측·스킬 기능과 [workflow-1](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/workflow-format.md)의 mode·req·commit 기능을 지원한다. 실행은 `node apps/cli/dist/main.js`이며 다시 빌드한 바이너리의 해시가 다르면 이 지정을 자동 승계하지 않는다.

현재 개발 저장소의 config는 prototype-1로 유지한다. 요구사항·승인·커밋 기능은 workflow-1에서 검증됐으며 기존 프로젝트에 적용하려면 사용할 모드를 명시적으로 선택해야 한다. 그래서 이 저장소의 새 기능 설계 문서는 DEV-01로 작성했고, 이번 변경의 Git 커밋에는 DEV-03을 적용한다. 기존 note는 지정된 0.1.0 빌드로 [판단 기록](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/.tryce/notes/N-be88a17d-ef33-4923-8120-1853df1c26a0.json)을 추가했다. Claude 복사본의 기존 개발 동기화에는 DEV-04를 유지한다.

실제 에이전트가 새 세션의 대화에서 스킬을 자율적으로 선택하고 적절한 시점에 질문·기록·커밋하는 종단 시험은 아직 수행하지 않았다. 사용자 지침의 자연어 의미와 승인자의 신원은 CLI가 인증하지 않는다. 요구사항 GUI, 구현·검증 완료 판정, superseded·cut 상태 전이, 모든 사건 트레일러와 전체 이력 검사, 장기 기록의 파일 분할, macOS·Linux 실행은 후속 범위다.

## 0.2.0 릴리스 빌드

2026-09-13 배포 요청에 따라 버전과 사용 안내를 0.2.0으로 갱신했다. 제품 로직은 직전 109개 테스트를 통과한 구현과 같고, 재빌드한 패키지의 오프라인 설치·실행을 `pnpm test:package`로 다시 확인했다. 프로젝트 사용 빌드의 버전은 `0.2.0`, SHA-256은 `87f82d21243a9c56b1577ca76cc988efdbf2a61c07745245c6a7f7e4913de9a5`로 갱신한다. 지원 범위와 기존 프로젝트 모드, 미검증 항목은 앞 절을 유지한다. 게시·레지스트리 설치 여부는 [배포 기록](releases.md)을 따른다.

## 0.2.1 요구사항 저장 위치 정정

2026-09-13 `pnpm check`를 통과했다. core 11개, contracts 7개, CLI 82개, Chromium 6개, 스킬 동기화 5개로 총 111개 테스트와 workspace 밖 오프라인 패키지 설치·실행을 확인했다. 신규 `.tryce/spec/` 생성·조회·brief·커밋, 기존 `specs/` 기록의 조회·추가·커밋, 양쪽 경로 중복 거부, ignore·삭제·과거 원문 변경·링크·Git 필터 보호를 검증했다. 초기화 전 `.tryce`가 없는 조회에서 발생한 회귀를 수정한 뒤 전체 검증을 다시 통과했다. 공용 스킬 형식과 로컬 복사본 일치도 확인했다.

프로젝트 사용 빌드를 `apps/cli/dist/main.js`, CLI `0.2.1`, SHA-256 `179e6530b386fb13a1de44bdf73d8e8feac614ea3723d5fde3f00cde451606e0`로 지정한다. 이 저장소의 prototype-1 설정·기준선은 유지한다. 사용자 경로 정정은 지정된 0.2.0의 note 명령으로 기록했고, 설계 문서 수정에는 DEV-01, 기존 Claude 개발 복사본 동기화에는 DEV-04를 적용했다. 새 세션 에이전트의 자율 동작, AGENTS.md·CLAUDE.md 연결 절차, 실제 프로젝트 맥락의 일괄 요구사항 도출은 이번 실행 검증에 포함하지 않는다.

## 2026-09-14 읽기 전용 요구사항 브라우저

Gentask 프론트엔드 지침을 [전용 문서](architecture/frontend/README.md)에 정리하고 Astryx CLI 0.6.0을 개발 의존성에 추가했다. apps/browser에서 npx @astryxdesign/cli init을 실행하고 생성된 AGENTS.md, 레이아웃·템플릿·컴포넌트 API를 확인했다. core·neutral 0.6.0과 StyleX 0.19.0은 기존 호환 설치를 유지했다.

브리핑, 요구사항 검색·영역·상태 필터, 상세·수정본·확인 문서, 판단 note, 기존 Git 상태를 실제 API에 연결했다. 작은 화면의 상세는 목록을 대신하며 닫으면 필터와 키보드 초점을 복원한다. Astryx 한국어 카탈로그와 시스템 라이트·다크 테마를 사용한다. 저장 형식은 바꾸지 않았고 쓰기·승인·전체 이력 검사 API는 추가하지 않았다.

검증은 Windows에서 수행했다.

- pnpm typecheck 및 최종 frontend 타입 검사·빌드 통과.
- pnpm check 첫 실행: core 11개, contracts 7개, browser 9개 통과. CLI 84개 중 새 본문 보존 테스트의 공백 기대값 1개만 실패했다. 원문 보존이 맞으므로 기대값의 trim을 제거했다.
- 수정 후 browser-project/browser-server 테스트 9개 통과. HTTP의 세션·출처·메서드·query 차단, 과거 승인 문서·현재 초안 상태·전체 note 본문, 조회 전후 파일 fingerprint 보존을 확인했다.
- 최종 Playwright 9개 통과. URL·뒤로 가기·검색·확정 문서, 연결 오류·다른 worktree·이전 데이터, 모바일 초점 복원·다크·위험한 Markdown URL/HTML, 실제 CLI 서버를 검사했다.
- skills:test 5개 및 test:package 통과. 패키지를 workspace 밖에 설치해 기존 형식 전환·요구사항 확인·note·brief·skills·Git·브라우저 자산과 API를 실행했다. 확인자는 모의 Fixture이며 실제 사용자 승인이 아니다.
- 실제 Tryce 데이터로 1440×1000 데스크톱과 390×844 모바일 화면을 확인했다. 루트의 요구사항 15개와 판단 이력을 조회했다.

전체 check를 두 번째로 반복한 것은 아니며 실패를 고친 관련 검사와 뒤에 남은 스킬·패키징 검사를 별도로 완료했다. 전체 Git 추적·완료 판정·새 독립 에이전트 세션의 행동은 검증 범위에 포함하지 않는다.

이 검증 범위에서 apps/cli/dist/main.js의 CLI 0.2.1 개발 빌드(SHA-256: 9cf6fc8692e21a765c04f313c8a072e7487c12548d67643572abda848762a845)를 프로젝트 사용 빌드로 지정한다. npm에 게시한 0.2.1과 다른 미배포 빌드다. 기존 기록·확인·커밋 규약은 유지하며 쓰기 전에 위 해시를 확인한다. 이번 작업의 루트 기록과 커밋에는 이전 지정 빌드(179e6530b386fb13a1de44bdf73d8e8feac614ea3723d5fde3f00cde451606e0)를 보관해 사용했다. 다음 빌드는 다시 검증·지정하기 전까지 자동으로 신뢰하지 않는다.

## 2026-09-14 브라우저 조회 성능

project 응답의 요약과 상세가 하나의 검증된 요구사항 집합을 사용하도록 변경했다. Git 위치 조회를 묶고 HEAD/index의 원문을 최대 32개씩 cat-file로 읽는다. 성공한 관측은 서버 메모리에 한 개 보관하며 설정·기록의 실제 내용, Git 상태·index, 잠금과 문서 목록을 재확인한 뒤 재사용한다. 변경이나 오류가 있으면 이전 성공 결과를 버리고 다시 읽는다. 캐시 파일이나 새로운 영속 형식은 만들지 않는다.

Windows / Node.js 24.17.0에서 요구사항 16개·note 21개인 Tryce를 측정했다. 이전 project 요청은 21.6초였고 최종 빌드의 실제 HTTP 측정은 다음과 같다. 서버 시작 시간은 프로젝트 요청 시간에 포함하지 않았다.

| 대상·상황 | 측정 |
| :--- | :--- |
| Tryce CLI 서버 시작 | 824ms |
| Tryce 첫 project 요청 | 1,498ms |
| Tryce 변경 없는 재요청 3회 | 656 / 493 / 483ms |
| 독립 복제 저장소 첫 요청 | 1,991ms |
| 복제 저장소 note 추가 후 | 2,079ms |
| 복제 저장소 HEAD/index 변경 후 | 1,815ms |

첫 요청 2초 목표에 도달했다. 재요청 300ms·변경 후 1초 목표는 아직 달성하지 못했으며 추가 Git 관측과 전체 파일 재확인 비용이 남는다. 모든 저장소나 부하 조건에서의 보장값은 아니다. 독립 복제 저장소에서 변경 후 새 관측 ID와 note 수 증가를 확인했다. 원래 Tryce의 파일을 변경 시험 대상으로 사용하지 않았다.

읽기 전용 측정은 `pnpm build` 후 `node scripts/benchmark-browser.mjs`로 재현한다. 다른 checkout은 마지막 인자로 경로를 지정한다. 개발 상세와 캐시 범위는 [로컬 브라우저 서버](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/browser-server.md#조회-비용과-결과-재사용)를 따른다.

최종 소스에서 `pnpm typecheck`, `pnpm build`, `pnpm test:built`를 순서대로 실행했다(`pnpm check`와 같은 구성). core 11개, contracts 7개, CLI 89개, Chromium 9개, 스킬 5개가 통과했다. 캐시의 동일 입력 재사용·동시 요청 공유, 수정 시각과 크기를 유지한 내용 변경, index에만 다른 원문이 있는 경우, HEAD·note·설정·문서 목록 변경, 잠금·손상과 조회 중 경합을 검사했다. 별도 SHA-1/SHA-256 fixture의 40개 blob으로 배치 경계와 한글·줄바꿈 원문 보존을 확인했다. 실제 4317 서버에서도 새 요구사항의 목록·상세와 자동 확정 표시를 확인했고 페이지 실행 오류는 없었다.

workspace 밖 오프라인 패키지 설치와 형식 전환·승인·note·brief·스킬·status·browser 실행도 통과했다. 이번 루트 기록과 커밋은 이전 지정 빌드(9cf6fc8692e21a765c04f313c8a072e7487c12548d67643572abda848762a845)를 `.tmp/browser-performance/record-cli.mjs`에 보관해 사용했다. 검증을 마친 새 프로젝트 사용 빌드는 `apps/cli/dist/main.js`, CLI 0.2.1, SHA-256 `2d9513ad202a3c7a5533c7e7dafcfcd6779725ff80feaaa006684591bad12b2f`다. npm 게시 버전과 다른 로컬 개발 빌드이며 이번 작업에서 게시하지 않았다.

## 2026-09-14 0.3.0 릴리스 빌드

브라우저와 성능 개선을 포함한 기능 검증은 위 기록을 따른다. 버전·README 변경 후 CLI를 다시 빌드하고 `pnpm test:package`를 통과했다. 프로젝트 사용 빌드는 `apps/cli/dist/main.js`, CLI 0.3.0, SHA-256 `45f28813c9b8020d5949ff19cad8e5d6236781ad891853640674ba117c68297a`로 지정한다. 이번 릴리스 기록과 커밋에는 직전 지정 빌드(2d9513ad202a3c7a5533c7e7dafcfcd6779725ff80feaaa006684591bad12b2f)를 `.tmp/releases/0.3.0/record-cli.mjs`에 보관해 사용한다. 실제 npm 게시·설치 결과는 [배포 기록](releases.md)에 남긴다.

## 2026-09-14 MVP 스킬 개편 검증

tryce-workflow에 요구사항 분류·점진적 도출·Markdown 초안 정리·최종 변경 준비·관련 코드와의 커밋 흐름을 반영했다. 새 형식에는 note와 승인 묶음을 만들지 않고, 기존 형식은 선택한 모드와 기록을 보존한다. 정책 부재를 자동 커밋 권한으로 보던 안내를 제거하고 README 도입 프롬프트에도 명시했다.

설치·동기화가 SKILL.md 한 파일을 소유·배포하므로 단일 파일을 유지했다. 참조 파일을 분리하면 현재 패키지와 복사본에 누락될 수 있다. 기존 skills install은 config.json이 필요하므로 설정 없는 새 실험 형식의 설치 수단으로 안내하지 않는다. 새 형식의 설치·마이그레이션과 공개 도입 프롬프트 전환은 후속 작업이다.

스킬 형식 검사, skills:sync/check, 동기화 테스트 5개, CLI 빌드와 test:package가 통과했다. 패키지 검증은 외부에 설치된 스킬이 현재 원본과 바이트 단위로 같은지도 확인한다. 격리된 .tmp/skill-workflow-demo에서 새 CLI의 save → changes → prepare → commit-plan/apply를 실행해 명세·이유·코드·테스트 네 파일의 커밋과 깨끗한 작업 상태를 확인했다. 빈 제목 거부·정상 제목 저장 테스트 2개도 통과했다.

이는 명령 실행 검증이며 독립 에이전트의 스킬 선택·인터뷰·분류 판단을 검증한 것은 아니다. 전체 pnpm check는 이번 스킬 변경에서 다시 실행하지 않았다. 실제 프로젝트의 구형 기록·기준선·지정 쓰기 CLI는 유지했다. DEV-01로 전환 판단을 이 문서에 직접 기록했으며 신규 note나 승인은 생성하지 않았다. 루트 커밋·푸시·npm 게시는 수행하지 않았다.

## 2026-09-14 spec-1 프로젝트 사용 빌드 (이전 검증 기록)

프로젝트 사용 빌드를 `apps/cli/dist/main.js`, SHA-256 `abfb982da1d4dee1d7617d237070471f94f6562180011541223753433be8751c`로 지정한다. 실행은 `node apps/cli/dist/main.js` 또는 `pnpm cli`다. 패키지 버전 문자열은 아직 0.3.0이며 공개 npm의 같은 버전과 다른 개발 빌드다. 다시 빌드하면 해시와 검증 범위를 확인한다.

지정 범위는 spec-1 초기화·스킬 설치·명세 working/save/read/diff/changes/prepare/verify/commit-plan/commit-apply다. 임시 저장소에서 새 설정 초기화·재실행·staging 보존·스킬 설치·명세 및 코드 커밋, 실패 후 초기화 재시도, 구형 기록 교체와 삭제 커밋을 검증했다. 프로젝트의 일회성 전환은 DEV-01이며 범용 마이그레이션 명령을 제공한다는 의미가 아니다.

req·note·mode·init --mode는 도움말에 deprecated로 표시한다. 기존 JSON 출력·오류 계약을 깨지 않도록 실행 중 별도 경고 문자열은 추가하지 않는다. spec-preview는 실험용 호환 이름으로 유지한다. brief와 브라우저는 아직 spec-1 미지원이므로 현재 맥락은 spec working과 원문·Git으로 확인한다. 신규 형식의 공개 설치 프롬프트는 개발 빌드용으로 구분했다.

검증 결과: pnpm check에서 타입 검사·core 19개·contracts 7개·브라우저 9개가 통과했다. CLI 119개 중 기본 init을 auto로 기대하던 기존 테스트 2개가 실패했고, 새 기본값과 명시적 구형 init으로 기대값을 바꾼 뒤 두 테스트를 다시 실행해 통과했다. 이후 별도 전환·삭제 커밋 테스트 1개도 통과해 CLI 검사 범위는 총 120개다. 스킬 동기화 5개·스킬 형식·패키지 외부 오프라인 설치·문서 링크 69개 검사를 완료했다. 전체 check를 두 번째로 실행한 것은 아니다.

우리 프로젝트의 spec working·changes는 6개 명세·19개 최종 추가를 반환한다. 원본 백업을 남기지 않는 전환을 적용했으며 현재 명세는 미커밋이다. history.jsonl은 커밋 요청 시 prepare에서 생성한다. 루트 HEAD·staging은 변경하지 않았으며 커밋·푸시·npm 게시를 수행하지 않았다.

## 2026-09-14 Markdown 브라우저와 schemaVersion

요구사항 이력·제품 기능·기여자 화면을 실제 Markdown 명세와 Git에 연결했다. 이력은 커밋 전후를 비교하며 같은 요구사항 ID의 변경만 그래프로 연결한다. 현재 명세와 변경 전후 본문, 작성자 이름·이메일 기반 아바타를 제공한다. 기여자는 Git author 기준으로 집계하고 mailmap을 적용한다.

설정은 `schemaVersion: 1`과 기존 baseline만 저장한다. 사용자가 합의한 일회성 전환으로 kind·format 필드를 제거했으며 도입 기준선은 보존했다(DEV-01). 1.0 이전의 모든 형식을 영구 해석하는 계층은 만들지 않는다. 1.0 이후 호환되지 않는 저장 규약 변경에는 마이그레이션을 제공한다.

검증한 프로젝트 사용 빌드는 `apps/cli/dist/main.js`, SHA-256 `bc7147beae25cf987b7ebf392204acf3166965a6d9bf006e420f98c1ed00f120`이다. 패키지 버전은 0.3.0이며 공개 npm과 다른 로컬 개발 빌드다. 실행은 `pnpm cli` 또는 `node apps/cli/dist/main.js`를 사용한다. 이전 지정 범위와 새 브라우저 조회에 적용하며 brief의 새 형식 지원은 아직 없다.

전체 `pnpm check`에서 CLI 122개·core 19개·contracts 7개·브라우저 9개·스킬 5개와 패키지 검사가 통과했다. 이후 추가한 설정 거부 검사, 실제 12개 커밋의 페이지 경계 검사와 조회 변경에 대한 CLI 테스트 3개를 별도 실행해 통과했다. 최종 소스에서 타입 검사·빌드·브라우저 10개·외부 오프라인 패키지 설치를 다시 통과했다. 조회 전후 파일 보존, 세션·메서드·입력 검증, 모바일·다크 테마·위험한 Markdown도 검사했다.

실제 Tryce의 6개 명세와 19개 요구사항으로 화면 이동·상세·작성자 집계를 확인했다. 최종 서버에서 첫 화면 표시까지 1,467ms, 이후 API 조회 3회는 864/779/757ms였다. 이 저장소의 로컬 측정이며 모든 저장소의 응답 시간을 보장하지 않는다.

이력은 first-parent의 명세 관련 커밋 10개씩 읽고 이전 이력을 추가로 불러온다. 검색·필터와 기여자의 기능 활동은 불러온 이력 범위에 적용된다. 기여자 집계는 최근 커밋 10,000개까지이며 초과하면 화면에 표시한다. 대규모 이력의 로컬 색인은 후속 범위다. 이번 작업에서 커밋·푸시·npm 게시는 수행하지 않았다.

제품 기능 화면의 후속 디자인 수정은 목록 19~21rem / 문서 나머지 폭으로 배치하고 목차·행 선택·수용 조건 줄바꿈을 적용했다. 프론트엔드 타입 검사·빌드와 브라우저 테스트 10개를 통과했다. CLI 코드 해시는 기존 지정값과 같으며 서버를 다시 시작해 새 브라우저 자산을 제공한다. 이 작업은 저장 원문과 Git 이력을 변경하지 않는다.

visx 4.0.0 기반 이력 그래프와 구간별 열 배정을 적용했다. 연결 없는 행 정렬·겹치는 구간의 열 분리·열 재사용·긴 연결·20개 동시 구간의 폭 제한을 검사했다. 프론트엔드 타입 검사·빌드와 브라우저 검사 13개가 통과했다. 저장 형식과 CLI 코드에는 변경이 없다.

## 2026-09-14 브라우저 표현과 Gentask 참조

Outfit/Noto Sans KR 800 로컬 제목 폰트, Hugeicons 메뉴, Gentask 원본 빈 화면 SVG와 PageState를 적용했다. RequestState는 200ms 후 골격을 표시하고 Query 재조회는 기존 화면을 유지한다. 더보기의 진행·재시도·완료 상태를 구분한다. Gentask의 Router/Query 책임 분리와 pending 설정을 참고했으며 웹 URL과 로컬 세션 정책은 유지한다. 루트 AGENTS.md에 브라우저 AGENTS.md 직접 읽기를 명시했다.

타입 검사·프론트엔드 빌드·브라우저 16개 검사를 통과했다. 다음 페이지 추가 후 기존 행 유지·마지막 페이지, 지연 골격에서 빈 일러스트 전환을 새로 검증했다. 실화면에서 메뉴 아이콘·굵은 제목·Gentask 빈 화면을 확인했다. Hugeicons npm 패키지에 누락된 MIT 원문은 공식 저장소에서 받아 기존 notices 수집 절차로 포함했다. 최초 CLI 빌드는 이 누락 검사로 실패했고 보완 후 통과했다.

요구사항 R-tkl3lrrlpu와 R-5eehizubwl의 수용 조건을 지정 CLI spec save로 보완했다. 커밋·푸시·npm 게시는 수행하지 않았다. CLI 코드 해시는 기존 지정값과 같다.
최종 패키지의 workspace 밖 오프라인 설치와 실행 검사도 통과했다.

이력 목록을 Astryx 받은편지함 구조의 Table로 바꾸고 64px 행과 고정 정보 열, 상세 진입 시 보조 열 축소를 적용했다. 그래프 좌표와 고정 예상값 테스트도 새 행 높이에 맞췄다. 타입 검사·빌드·브라우저 16개 검사가 통과했다.
우측 읽기 패널을 Astryx LayoutPanel과 ResizeHandle로 구성하고 변경 후 중심 본문·아바타 유지·목록의 변경 후 미리보기를 적용했다. 타입 검사·빌드와 브라우저 17개 검사가 통과했으며 키보드 패널 크기 조절을 확인했다.

커밋 전 최종 `pnpm check`를 통과했다. 타입 검사·전체 빌드, CLI 123개·브라우저 17개·스킬 동기화 5개 검사와 core/contracts 검사, workspace 밖 패키지 오프라인 설치·실행을 확인했다.

## 0.4.0 릴리스 사용 빌드

버전과 배포 안내만 변경한 0.4.0 번들을 다시 빌드하고 패키지 오프라인 설치·실행과 커밋 연결·실패 복구 7개 검사를 통과했다. 이 빌드를 프로젝트 사용 대상으로 지정한다. 실행은 `node apps/cli/dist/main.js`, SHA-256은 `8cb0d83197f0721674859c8a20bdad171bfa65d6d66201a3f57653b74d317396`이다. 지원 형식과 기능 범위는 직전 검증 빌드와 같다.

## 2026-09-15 커밋 성능과 단일 커밋 명령

커밋이 오래 걸리는 원인을 측정하고 `spec commit`으로 개선했다. 명령 설계와 결정은 [MVP 전환 계획](mvp-transition.md)의 단일 커밋 명령 절을 따른다.

측정은 `node scripts/benchmark-commit.mjs [--cli 경로] [--flow both|legacy|merged]`로 재현한다. 매 실행마다 독립 fixture 저장소를 복사하며 현재 checkout은 건드리지 않는다. `scripts/benchmark-commit-trace.mjs` preload가 CLI 번들을 바꾸지 않고 Git 프로세스·파일 접근 시간을 기록한다. fixture 준비와 명세 편집은 측정 구간에서 제외했다. 시나리오별 5회를 실행했고 표는 첫 실행을 제외한 중앙값이다. 환경은 Windows 11, AMD Ryzen AI MAX 390, Node.js 24.17.0, Git 2.53.0.windows.1(system core.autocrlf=true)이며 fixture에는 훅과 서명이 없다.

0.4.0 흐름은 changes·prepare·commit-plan·commit-apply와 시작 시 working을 포함한다. Git 프로세스를 237~265회 순서대로 실행했고 시간의 86%가 Git 대기였다(호출당 평균 62ms). 저장소 크기보다 호출 수가 시간을 결정했다. 반복 원인은 명령마다의 사전 검사(status 2회 포함), 한 명령 안에서 반복한 저장소 위치·HEAD 조회, commit-apply의 계획 전체 재구성이었다. 같은 환경에서 `git --version` 한 번은 59ms, CLI 시작은 128ms였다.

| 시나리오 (명세+코드 / 코드만) | 0.4.0 흐름 | 새 빌드의 4단계 흐름 | spec commit | 기본 git add+commit |
| :--- | :--- | :--- | :--- | :--- |
| small: 추적 파일 10, 명세 1 | 14.7 / 13.8초 (Git 239 / 237회) | 7.2 / 7.0초 (111 / 109회) | 1.67 / 1.65초 (25 / 24회) | 0.18 / 0.17초 |
| Tryce 복제: 파일 220, 명세 6 | 15.2 / 15.0초 (239 / 237회) | 7.4 / 6.9초 (111 / 109회) | 1.60 / 1.64초 (25 / 24회) | 0.19 / 0.19초 |
| medium: 파일 2,000, 명세 20 | 21.0 / 18.1초 (265 / 259회) | 10.0 / 9.6초 (115 / 109회) | 2.13 / 1.93초 (25 / 24회) | 0.28 / 0.24초 |
| many: medium에서 커밋 파일 124 | 22.0 / 22.6초 (265 / 259회) | 10.4 / 9.4초 (115 / 109회) | 2.60 / 2.50초 (25 / 24회) | 0.52 / 0.44초 |

단독 `changes`는 1.5~1.7초에서 0.64~0.69초(Git 10회)로 줄었다. spec commit의 남은 시간은 대부분 Git 24~25회이며, 커밋 파일이 많으면 파일 지문 계산이 약 0.8초를 더한다. 기본 Git과의 차이는 잠금 아래 재대조·격리 index·결과 검증을 유지한 비용이다. 결과는 이 컴퓨터의 로컬 측정이며 macOS·Linux, 훅·서명이 있는 저장소, 더 큰 명세 집합은 측정하지 않았다. 원자료는 `.tmp/commit-performance/baseline-0.4.0.json`과 `after-single-commit.json`에 있다.

Tryce 복제 시나리오는 autocrlf=false로 복제했다. 기본 autocrlf=true 복제에서는 명세가 CRLF로 checkout돼 commit-plan이 변경되지 않은 명세를 미선택 변경으로 거부했다. 같은 CRLF 복제본에서 새 빌드의 spec commit도 dry-run과 실행 모두 같은 오류로 거부했고 파일은 쓰지 않았다. 별도 결함으로 남기고 이번 범위에서 고치지 않았다.

새 개발 번들 SHA-256은 `9dedcb5f4635a11be8f2cd3c10ef40dc4c2f39a6f72ca8d2fb9cd5644f5f6dc9`이며 프로젝트 사용 빌드로 지정하지 않았다. 0.4.0 지정 바이트는 `.tmp/commit-performance/record-cli-0.4.0.mjs`에 보존했다. 최종 소스의 `pnpm check`가 통과했다. 타입 검사·빌드, core 20개·contracts 7개·CLI 131개(새 spec commit 8개 포함)·브라우저 17개·스킬 동기화 5개와 workspace 밖 패키지 오프라인 설치·실행을 확인했다. 새 테스트는 SHA-1/SHA-256 dry-run 무변경과 단일 커밋, 이유 누락 경고, 생략한 이유 유지, 오래된 expected·미선택 명세·기존 staging·intent-to-add 거부, 훅 거부 후 이유 파일·index 복원과 재시도, 외부 편집 보존, HEAD 변경 후 복구 자료 보존을 검사한다. 루트 커밋·푸시·npm 게시는 하지 않았다.

## 2026-09-15 구형 명령 삭제

사용자 결정에 따라 deprecated였던 `req`·`note`·`mode`·`init --mode`·`spec-preview` 호환 이름과, 표시가 없던 구형 `commit plan/apply`·`brief`를 삭제했다. 이들만 쓰던 저장소·출력 코드, core의 note·요구사항 JSON·brief 모듈, contracts의 brief·notes·workflow·browser-project·project-init v1/v2 계약도 제거했다. 브라우저 화면은 `/api/v1/project`를 호출하지 않아 해당 API와 클라이언트도 제거했다. `spec`의 `prepare`·`verify`·`commit-plan`·`commit-apply`는 0.6.0 제거 일정대로 deprecated 상태로 남긴다.

init은 schemaVersion 1 설정만 만든다. init 실패 출력은 기존 project-init version 1 오류 형태를 유지한다. 구형 설정 파서는 구형 프로젝트를 새 형식으로 오인하지 않고 MIGRATION_REQUIRED 등으로 거부하기 위해 남겼다. spec commit의 구형 기록 삭제 선택도 유지한다. 구형 JSON 프로젝트의 기록은 0.4.0 이하 CLI로 읽는다.

구형 init 테스트는 삭제하지 않고 명세 기반 init으로 옮겼다. 무시 규칙·추적 설정 삭제·진행 중인 Git 작업·링크·병렬 실행·강제 종료·worktree·clone·submodule 검사를 유지했다. 옮기는 중 차이 하나를 확인했다. 초기화 도중 다른 쪽이 config.json을 만들면 구형 init은 기존 설정으로 받아들였지만, 명세 기반 init은 기록 검사가 먼저 실행돼 EXISTING_RECORDS로 거부한다. 두 경우 모두 파일은 덮어쓰지 않는다. 동작은 바꾸지 않고 테스트를 실제 동작에 맞췄다. spec-preview 테스트는 초기화된 fixture와 `spec` 이름으로 옮겼다.

최종 소스의 `pnpm check`가 통과했다. 타입 검사·빌드, core 14개·contracts 4개·CLI 98개·브라우저 17개·스킬 동기화 5개와 workspace 밖 패키지 설치 후 init·spec save/commit/read·skills·status·browser 실행을 확인했다. 테스트 수 감소는 삭제한 명령의 테스트 제거에 따른 것이다. 개발 번들 SHA-256은 `8af110810dd896fa580ca7f91918e8363395b349415bfd15e1a84fe798533d00`이며 프로젝트 사용 빌드로 지정하지 않았다. 이 저장소의 명세는 명령 이름이 아니라 동작을 기술하므로 수정하지 않았다. 루트 커밋·푸시·npm 게시는 하지 않았다.

## 0.5.0 프로젝트 사용 빌드

위 두 절의 변경을 담아 CLI 버전을 0.5.0으로 올렸다. deprecated 명령은 0.6.0에서 제거한다.

같은 버전에 CRLF checkout 결함 수정을 포함했다. core.autocrlf=true로 복제하면 LF 명세가 CRLF로 checkout돼 spec commit이 변경되지 않은 명세를 미선택 변경으로 거부했다. 이제 변경 여부를 Git이 저장할 blob ID로 비교하고, 필터 검사는 줄바꿈 변환만 허용한다. 판단과 기각한 대안은 [MVP 전환 계획](mvp-transition.md)의 단일 커밋 명령 절에 둔다. 실제 Tryce를 autocrlf=true로 복제한 저장소에서 요구사항 수정과 README 변경을 dry-run·커밋했고 커밋 후 작업 폴더가 깨끗했다. 새 테스트는 CRLF checkout에서 건드리지 않은 명세를 다시 쓰지 않고 커밋하는 경우와, 내용을 바꾸는 clean 필터가 계속 거부·복원되는 경우를 검사한다. deprecated commit-plan에는 적용하지 않았다.

최종 소스의 `pnpm check`가 통과했다(core 14개·contracts 4개·CLI 100개·브라우저 17개·스킬 5개, workspace 밖 패키지 설치·실행). `tryce --version`은 0.5.0을 출력하고, 이 저장소에서 `spec working`(명세 6개)과 `spec changes`(변경 0건)가 정상 동작했다.

이 빌드를 프로젝트 사용 대상으로 지정한다. 실행은 `node apps/cli/dist/main.js` 또는 `pnpm cli`, SHA-256은 `41223f684db38ea8d8032d6e30a6535b1dcd75ce96d2421887638acf378e1e83`이다. 커밋은 `spec commit`으로 한다. 직전 0.4.0 지정 바이트는 `.tmp/commit-performance/record-cli-0.4.0.mjs`에 보존했다. npm 게시 전이므로 공개 레지스트리의 최신 버전은 0.4.0이다. 루트 커밋·푸시·npm 게시는 하지 않았다.
