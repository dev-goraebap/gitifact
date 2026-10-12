// Gitifact landing — 모든 장면은 JS 없이도 읽히고, JS는 상호작용과 전환만 담당한다.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* nav: 스크롤 경계선과 현재 구역 */
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const navLinks = $$('.nav__links a');
  const sectionObs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((a) => { const t = $(a.getAttribute('href')); if (t) sectionObs.observe(t); });

  /* 복사 */
  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = document.getElementById(btn.dataset.copy).textContent;
      try { await navigator.clipboard.writeText(text); btn.textContent = '복사됨'; }
      catch { btn.textContent = '선택해서 복사하세요'; }
      btn.classList.add('is-done');
      setTimeout(() => { btn.textContent = '복사'; btn.classList.remove('is-done'); }, 1800);
    });
  });

  /* 사용 흐름: 넓은 화면에서만 오른쪽 고정 장면으로 바꾼다 */
  const story = $('[data-story]');
  const steps = $$('.step', story);
  const slot = $('.stage__slot', story);
  // 진행 막대는 단계 수만큼 만든다. 단계를 더하거나 빼도 HTML의 막대 수를 따로 맞출 필요가 없다.
  const progress = $('.stage__progress', story);
  progress.replaceChildren(...steps.map(() => document.createElement('span')));
  const bars = $$('span', progress);
  const wide = matchMedia('(min-width: 901px)');
  let stageScenes = [];
  let stepObs;

  const activate = (i) => {
    steps.forEach((s, n) => s.classList.toggle('is-active', n === i));
    stageScenes.forEach((s, n) => s.classList.toggle('is-active', n === i));
    bars.forEach((b, n) => b.classList.toggle('is-on', n <= i));
  };

  const setupStory = () => {
    stepObs?.disconnect();
    if (!wide.matches) {
      document.documentElement.classList.remove('js-story');
      slot.replaceChildren();
      stageScenes = [];
      return;
    }
    document.documentElement.classList.add('js-story');
    slot.replaceChildren(...steps.map((s) => $('[data-scene]', s).cloneNode(true)));
    stageScenes = $$('.scene', slot);
    stepObs = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) activate(Number(e.target.dataset.step));
    }, { rootMargin: '-48% 0px -48% 0px' });
    steps.forEach((s) => stepObs.observe(s));
    activate(0);
  };
  wide.addEventListener('change', setupStory);
  setupStory();

  /* 관계 그래프 */
  const graph = $('[data-graph]');
  const info = {
    feat: ['기능 · S-', '기능 단위의 디렉터리입니다. 하위의 요구사항과 설계를 묶으며, 기능의 목적과 범위를 적는 index.md를 둡니다.'],
    req: ['요구사항 · R-', '제품이 보장해야 할 동작과 제약을 적는 명세 단위입니다. 사람이 검토하기 쉬운 수용 조건(“조건 / 기대 동작”)을 담습니다.'],
    des: ['설계 · D-', '기능 구현의 기술 구조를 관심사별로 나눈 문서입니다. 설명하는 요구사항을 requirements에 적고, 근거로 삼은 저장소 문서(ID)나 외부 자료(제목·URL)를 sources에 적을 수 있습니다.'],
    rec: ['결정기록 · DR-', '기존 문서를 바꾸거나 지운 맥락, 고른 안과 검토한 대안을 담는 기록입니다. 대상 문서의 ID(docs)를 가리켜 문서마다 결정 흐름을 이룹니다. 커밋한 뒤에는 고치지 않습니다.'],
    commit: ['Git 커밋', '문서, 결정기록, 코드, 테스트를 함께 담는 단위입니다. CLI가 Gitifact 트레일러(Gitifact-Req, Gitifact-Design, Gitifact-Record 등)를 붙여 커밋과 문서를 연결합니다.'],
  };
  const edges = $$('.edges path', graph).map((p) => ({ el: p, ends: p.dataset.e.split(' ') }));
  const nodes = $$('.nodes g', graph);
  const infoTitle = $('.graph__info-title', graph);
  const infoBody = $('.graph__info-body', graph);
  const defaultInfo = [infoTitle.textContent, infoBody.textContent];
  let pinned = null;

  const focusNode = (id) => {
    if (!id) {
      graph.classList.remove('is-focus');
      nodes.forEach((n) => n.classList.remove('is-lit', 'is-sel'));
      edges.forEach((e) => e.el.classList.remove('is-lit'));
      [infoTitle.textContent, infoBody.textContent] = defaultInfo;
      return;
    }
    const lit = new Set([id]);
    edges.forEach((e) => {
      const on = e.ends.includes(id);
      e.el.classList.toggle('is-lit', on);
      if (on) e.ends.forEach((x) => lit.add(x));
    });
    graph.classList.add('is-focus');
    nodes.forEach((n) => {
      n.classList.toggle('is-lit', lit.has(n.dataset.n));
      n.classList.toggle('is-sel', n.dataset.n === id);
    });
    [infoTitle.textContent, infoBody.textContent] = info[id];
  };
  nodes.forEach((n) => {
    const id = n.dataset.n;
    n.addEventListener('mouseenter', () => focusNode(id));
    n.addEventListener('mouseleave', () => focusNode(pinned));
    n.addEventListener('focus', () => focusNode(id));
    n.addEventListener('blur', () => focusNode(pinned));
    const toggle = () => { pinned = pinned === id ? null : id; focusNode(pinned ?? id); };
    n.addEventListener('click', toggle);
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  /* ID 추적 */
  const idStates = [
    { git: '<span class="add">+ spec/feedback-inbox/requirements/merge-duplicates.md</span>', title: '중복 요청 병합', path: 'feedback-inbox/requirements/merge-duplicates.md', hist: '이력 1건' },
    { git: '  spec/feedback-inbox/requirements/merge-duplicates.md\n<span class="del">- title: 중복 요청 병합</span>\n<span class="add">+ title: 계정 단위 중복 병합</span>', title: '계정 단위 중복 병합', path: 'feedback-inbox/requirements/merge-duplicates.md', hist: '이력 2건' },
    { git: '<span class="del">- spec/feedback-inbox/requirements/merge-duplicates.md</span>\n<span class="add">+ spec/feedback-triage/requirements/account-merge.md</span>', title: '계정 단위 중복 병합', path: 'feedback-triage/requirements/account-merge.md', hist: '이력 3건' },
  ];
  const idWrap = $('[data-idtrack]');
  const idBtns = $$('[data-id-state]', idWrap);
  const idEls = { git: $('[data-id-git]', idWrap), title: $('[data-id-title]', idWrap), path: $('[data-id-path]', idWrap), hist: $('[data-id-hist]', idWrap) };
  idBtns.forEach((b) => b.addEventListener('click', () => {
    const s = idStates[Number(b.dataset.idState)];
    idBtns.forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    idEls.git.innerHTML = s.git;
    for (const k of ['title', 'path', 'hist']) {
      if (idEls[k].textContent !== s[k]) {
        idEls[k].textContent = s[k];
        if (!reduced.matches) { idEls[k].classList.remove('flash'); void idEls[k].offsetWidth; idEls[k].classList.add('flash'); }
      }
    }
  }));

  /* 아키텍처 */
  const arch = $('[data-arch]');
  const blocks = $$('.blk', arch);
  const dPath = $('[data-detail-path]', arch);
  const dTitle = $('[data-detail-title]', arch);
  const dBody = $('[data-detail-body]', arch);
  const dSteps = $('[data-detail-steps]', arch);
  const overview = [dPath.textContent, dTitle.textContent, dBody.textContent];

  const blockInfo = {
    agent: ['진입점', '에이전트', 'init이 AGENTS.md 등에 쓴 GITIFACT 블록에는 언제 어떤 명령을 쓸지만 담깁니다. 에이전트는 형식이 필요할 때 내장 가이드(guide show)를 읽고, specs·records·check·changes 명령을 실행기로 부릅니다.'],
    launcher: ['.gitifact/bin/cli.mjs', '실행기', 'init과 update가 저장소에 쓰는 파일입니다. .gitifact/config.json의 cli 버전을 npm 레지스트리에서 사용자 캐시에 한 번 받아 무결성을 확인한 뒤 실행합니다. 전역 설치 없이 프로젝트마다 지정된 버전을 씁니다.'],
    browser: ['apps/browser', '웹 뷰어', 'gitifact browser가 여는 읽기 전용 React 웹 앱입니다. 로컬 Git 저장소의 파일과 이력을 읽어 기능별 명세, 결정기록의 흐름, 참여자 현황을 보여 주며 편집·승인 기능은 두지 않습니다.'],
    commands: ['apps/cli/src/commands', 'CLI 커맨드', '사용자 및 에이전트 입력을 파싱하여 Core 유스케이스를 호출합니다. 커맨드 라우팅과 함께 동시성 제어를 위한 커밋 잠금(Lock) 및 복구 처리를 담당합니다.'],
    server: ['apps/cli/src/server', '로컬 HTTP 서버', 'gitifact browser 실행 시 구동되는 로컬 API 서버입니다. 웹 애플리케이션 정적 파일 서빙과 REST API(/api/v1) 라우팅 및 요청 유효성 검증을 수행합니다.'],
    output: ['apps/cli/src/output', 'DTO 직렬화 및 출력', 'Core 엔진의 반환 데이터를 버전화된 DTO 규격으로 변환합니다. CLI 터미널 출력과 웹 뷰어 HTTP 응답이 동일한 DTO 계약을 공유합니다.'],
    adapters: ['apps/cli/src/adapters', '인프라 어댑터', 'Core 도메인의 Port 인터페이스를 구현하는 계층입니다. Git 실행, 파일시스템 원자적 읽기·쓰기, SQLite 캐시(index.db), npm 레지스트리 버전 조회, 피드백 이슈 전송 등을 처리합니다.'],
    i18n: ['apps/cli/src/shared/i18n', '다국어 문구와 에이전트 가이드', '언어별(ko, en) 리소스를 나눠 둡니다. 메시지와 오류 문구는 JSON으로, 에이전트 가이드(guide show)와 패치노트는 Markdown으로 두며 컴파일 시점에 키 타입을 검사합니다.'],
    usecases: ['packages/core/src/use-cases', '유스케이스', '문서 조회, 형식 검사, 변경 비교 등 핵심 흐름을 맡습니다. check와 changes commit이 같은 검사 로직을 씁니다.'],
    formats: ['packages/core/src/formats', '문서 형식 및 파서', '명세 문서, 결정기록, 패치노트 등의 파싱과 스키마 유효성을 검증합니다. 이전 버전 규약과의 하위 호환성을 보장하고 비표준 포맷 쓰기를 방지합니다.'],
    domain: ['packages/core/src/domain', '도메인 모델', '문서, 식별자(ID), 저장소 상태, 도메인 오류를 정의하는 순수 도메인 계층입니다. 외부 Git이나 파일시스템에 직접 의존하지 않습니다.'],
    ports: ['packages/core/src/ports', '포트 인터페이스', 'Core 도메인이 외부 환경에 요구하는 추상 인터페이스입니다. 저장소 읽기, 파일 입출력 등의 경계를 정의하여 인프라와의 결합도를 낮춥니다.'],
    contracts: ['packages/contracts', '통신 계약 및 스키마', '클라이언트-서버 간 외부 JSON 스키마, 런타임 유효성 검증, 표준 오류 코드를 정의합니다. 런타임 종속성 없이 브라우저와 Node.js 환경에서 공용으로 사용됩니다.'],
    files: ['단일 진실 원천', '작업 디렉터리 파일', '.gitifact/ 아래의 명세(spec), 결정기록(records), 설정(config.json), 실행기(bin)와 AGENTS.md의 GITIFACT 블록입니다. 파일 하나가 문서 하나이며 구조 정보는 프론트매터에 적습니다.'],
    git: ['단일 진실 원천', 'Git 원본 이력', '커밋된 최종 문서, 결정기록, 트레일러 메타데이터, 작성자 및 시각 정보입니다. 모든 Git 명령은 신뢰할 수 있는 인자 배열 방식으로 안전하게 실행됩니다.'],
    cache: ['파생 데이터', '인덱스 캐시', '.gitifact/cache/index.db는 빠른 조회를 위한 파생 인덱스입니다. Git 형상관리에서 제외되며, 캐시 삭제 시 Git 원본으로부터 언제든 안전하게 자동 재생성됩니다.'],
  };

  const paths = {
    cli: {
      title: ['에이전트가 커밋할 때', 'gitifact changes commit --file <입력>', '사용자가 커밋을 허락했거나 프로젝트 정책이 있을 때, 하나의 결정과 관련된 문서, 결정기록, 코드, 테스트를 한 커밋으로 남기는 흐름입니다.'],
      steps: [
        ['agent', '작업을 마친 에이전트가 커밋을 제안하고, 허락을 받으면 changes list로 바뀐 명세와 커밋 전 결정기록을 확인해 커밋 입력을 씁니다.'],
        ['launcher', '실행기가 config의 cli 버전을 사용자 캐시에서 찾아(없으면 한 번 받아) CLI를 실행합니다.'],
        ['commands', 'CLI 커맨드가 입력 형식을 검증하고 동시성 제어를 위한 커밋 잠금(Lock)을 얻습니다.'],
        ['adapters', '파일시스템 어댑터가 작업 디렉터리의 명세 문서와 커밋할 결정기록을 읽습니다.', ['files']],
        ['usecases', 'Core 유스케이스가 check와 같은 검사를 실행합니다. 초안 표시(draft)가 남아 있거나 커밋한 기록이 바뀌었으면 커밋하지 않습니다.', ['formats', 'domain']],
        ['git', '선택된 파일만을 원자적으로 커밋하며, Gitifact 트레일러(Gitifact-Req, Gitifact-Record 등)를 자동 주입합니다.'],
        ['output', '작업 결과를 버전 관리되는 DTO 규격으로 직렬화하여 표준 출력으로 반환합니다.', ['contracts']],
      ],
    },
    browser: {
      title: ['웹 뷰어로 탐색할 때', 'GET /api/v1/… → 결정기록 화면', '동일한 Core 규칙을 HTTP API로 제공하는 읽기 전용 조회 흐름입니다.'],
      steps: [
        ['browser', '웹 뷰어 클라이언트가 로컬 백엔드 서버에 변경 이력 및 문서 데이터를 요청합니다.'],
        ['server', '로컬 서버가 요청 파라미터를 검증하고 라우팅 규칙에 따라 Core 유스케이스를 호출합니다.'],
        ['usecases', 'Core 유스케이스가 포트 인터페이스를 통해 필요한 도메인 데이터를 요청합니다.', ['ports']],
        ['adapters', '캐시 어댑터가 SQLite 캐시에서 데이터를 조회하며, 캐시가 만료되었거나 누락된 경우 Git 원본 이력으로부터 인덱스를 재생성합니다.', ['cache', 'git']],
        ['output', '조회 결과를 버전화된 계약(Contract) 규격으로 직렬화하여 응답합니다. 웹 뷰어는 동일한 타입 정의를 공유합니다.', ['contracts']],
      ],
    },
  };

  const clearArch = () => {
    arch.classList.remove('is-path');
    blocks.forEach((b) => { b.classList.remove('is-sel', 'on-path'); b.querySelector('.step-badge')?.remove(); });
    dSteps.hidden = true;
    dSteps.replaceChildren();
  };
  const blockOf = (id) => blocks.find((b) => b.dataset.b === id);

  blocks.forEach((b) => b.addEventListener('click', () => {
    const wasSel = b.classList.contains('is-sel') && !arch.classList.contains('is-path');
    clearArch();
    $$('[data-path]', arch).forEach((x) => x.classList.toggle('is-on', x.dataset.path === 'all'));
    if (wasSel) { [dPath.textContent, dTitle.textContent, dBody.textContent] = overview; return; }
    b.classList.add('is-sel');
    [dPath.textContent, dTitle.textContent, dBody.textContent] = blockInfo[b.dataset.b];
  }));

  $$('[data-path]', arch).forEach((btn) => btn.addEventListener('click', () => {
    $$('[data-path]', arch).forEach((x) => { x.classList.toggle('is-on', x === btn); x.setAttribute('aria-pressed', String(x === btn)); });
    clearArch();
    const p = paths[btn.dataset.path];
    if (!p) { [dPath.textContent, dTitle.textContent, dBody.textContent] = overview; return; }
    arch.classList.add('is-path');
    [dPath.textContent, dTitle.textContent, dBody.textContent] = p.title;
    p.steps.forEach(([id, text, extra = []], i) => {
      const main = blockOf(id);
      main.classList.add('on-path');
      const badge = document.createElement('span');
      badge.className = 'step-badge';
      badge.textContent = String(i + 1);
      main.prepend(badge);
      extra.forEach((x) => blockOf(x).classList.add('on-path'));
      const li = document.createElement('li');
      li.textContent = text;
      dSteps.append(li);
    });
    dSteps.hidden = false;
  }));
})();
