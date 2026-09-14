import { Command, Option } from 'commander';
import { runStatus } from './commands/status.js';
import { runBrowser, parsePort } from './commands/browser.js';
import { runInit } from './commands/init.js';
import { runNote } from './commands/note.js';
import { runBrief } from './commands/brief.js';
import { runSkills } from './commands/skills.js';
import { modeCommand } from './commands/mode.js';
import { reqCommand } from './commands/req.js';
import { runWorkflow } from './commands/workflow-output.js';
import { commitCommand } from './commands/commit.js';
import { runSpecPreview } from './commands/spec-preview.js';

declare const __CLI_VERSION__: string;

const program = new Command()
  .name('tryce')
  .description('프로젝트의 요구사항과 결정 이력을 Git에 남기는 도구')
  .version(__CLI_VERSION__)
  .allowExcessArguments(false)
  .addHelpText('after', '\nauto/approval은 workflow-1 형식입니다. 전체 이력 검사와 GUI 요구사항 화면은 아직 제공하지 않습니다.')
  .action(() => program.outputHelp());

program.command('status')
  .description('현재 checkout의 Git 상태 조회 (tryce 검사 미실행)')
  .allowExcessArguments(false)
  .addOption(new Option('--format <format>', '출력 형식').choices(['json', 'text']).default('json'))
  .action(async (options: { format: 'json' | 'text' }) => { await runStatus(options.format); });

program.command('browser')
  .description('현재 checkout의 Git 상태를 로컬 브라우저로 조회')
  .allowExcessArguments(false)
  .option('--port <port>', '수신 포트 (0은 자동 선택)', parsePort, 0)
  .option('--dev', 'Vite 개발 서버 Origin 허용')
  .action(runBrowser);

program.command('init')
  .description('프로젝트 설정과 도입 기준선 생성 (스킬·훅 제외)')
  .allowExcessArguments(false)
  .addOption(new Option('--mode <mode>', 'Deprecated: 기존 형식의 최초 모드').choices(['auto', 'approval', 'normal', 'prototype']))
  .option('--dry-run', '파일을 만들지 않고 초기화 계획 확인')
  .addOption(new Option('--format <format>', '출력 형식').choices(['json', 'text']).default('json'))
  .action(runInit);

const note = program.command('note').description('발견·제약·기각 이유 기록');
const outputOption = () => new Option('--format <format>', '출력 형식').choices(['json', 'text']).default('json');
note.command('enable').description('원본 설정을 보존하고 기록 형식 활성화')
  .allowExcessArguments(false).option('--dry-run', '전환 계획만 확인').addOption(outputOption()).action(options => runNote('enable', options));
note.command('add').description('새 기록 추가')
  .allowExcessArguments(false)
  .addOption(new Option('--type <type>', '기록 종류').choices(['discovery', 'constraint', 'rejected']).makeOptionMandatory())
  .option('--message <text>', '기록 본문').option('--file <path>', 'UTF-8 본문 파일')
  .option('--author <name>', '작성 주체 표시 (선택)')
  .option('--ref <id>', '참조 기록 ID (반복 가능)', (value: string, previous: string[]) => [...previous, value], [])
  .option('--supersedes <id>', '정정할 기록 ID').addOption(outputOption()).action(options => runNote('add', options));
note.command('list').description('작업 폴더의 모든 기록 조회').allowExcessArguments(false)
  .addOption(outputOption()).action(options => runNote('list', options));
note.command('show <id>').description('기록 ID로 조회').allowExcessArguments(false)
  .addOption(outputOption()).action((id, options) => runNote('show', options, id));

program.command('brief').description('설정·Git 상태·프로토타입 기록과 문서 위치 브리핑')
  .allowExcessArguments(false).option('--all', '지원 범위의 생략 없는 관측 결과')
  .addOption(outputOption()).action(runBrief);

const skills = program.command('skills').description('프로젝트 스킬 원본 설치와 로컬 복사본 관리');
for (const action of ['install', 'sync', 'remove'] as const) {
  const command = skills.command(action).allowExcessArguments(false).option('--dry-run', '파일을 쓰지 않고 계획 확인').addOption(outputOption());
  if (action !== 'remove') command.addOption(new Option('--agent <agent>', '사용할 에이전트').choices(['codex', 'claude']));
  command.action(options => runSkills(action, options));
}
const mode = program.command('mode').description('기록 모드 조회와 명시적 전환');
mode.command('show').allowExcessArguments(false).addOption(outputOption())
  .action(o => runWorkflow('mode.show', () => modeCommand(process.cwd()), o.format));
mode.command('set <mode>').allowExcessArguments(false).requiredOption('--reason <text>', '사용자 선택 근거')
  .option('--dry-run', '전환 계획 조회').addOption(outputOption())
  .action((value, o) => runWorkflow('mode.set', () => modeCommand(process.cwd(), value, o), o.format));
const req = program.command('req').description('요구사항 초안·확인 묶음·확정 기록');
for (const action of ['draft', 'revise'] as const) {
  const cmd = req.command(action === 'draft' ? 'draft' : 'revise <id>').allowExcessArguments(false)
    .requiredOption('--title <text>', '제목').option('--message <text>', '본문').option('--file <path>', 'UTF-8 본문 파일')
    .requiredOption('--author <name>', '작성 주체').requiredOption('--reason <text>', '수집 또는 수정 근거').addOption(outputOption());
  if (action === 'draft') cmd.requiredOption('--spec <slug>', '제품 영역').action(o => runWorkflow('req.draft', () => reqCommand(process.cwd(), action, [], o), o.format));
  else cmd.requiredOption('--expected <revision>', '수정 전 revision ID').option('--amend', '확정된 내용의 의미를 유지하는 수정')
    .action((id, o) => runWorkflow('req.revise', () => reqCommand(process.cwd(), action, [id], o), o.format));
}
req.command('review <ids...>').allowExcessArguments(false).addOption(outputOption())
  .action((ids, o) => runWorkflow('req.review', () => reqCommand(process.cwd(), 'review', ids), o.format));
for (const action of ['approve', 'activate'] as const) req.command(`${action} <review>`).allowExcessArguments(false)
  .requiredOption('--by <name>', '실제 확인자 또는 자동 기록 에이전트').requiredOption('--evidence <text>', '사용자 답변 또는 자동 확정 근거')
  .addOption(outputOption()).action((id, o) => runWorkflow(`req.${action}`, () => reqCommand(process.cwd(), action, [id], o), o.format));
req.command('list').allowExcessArguments(false).addOption(outputOption())
  .action(o => runWorkflow('req.list', () => reqCommand(process.cwd(), 'list', []), o.format));
req.command('show <id>').allowExcessArguments(false).addOption(outputOption())
  .action((id, o) => runWorkflow('req.show', () => reqCommand(process.cwd(), 'show', [id]), o.format));
const commit = program.command('commit').description('정책과 파일 범위를 확인한 커밋 계획·실행');
commit.command('plan').allowExcessArguments(false)
  .requiredOption('--path <path>', '관련 파일 상대 경로 (반복 가능)', (v: string, p: string[]) => [...p, v], [])
  .requiredOption('--message <text>', '프로젝트 정책에 맞는 커밋 메시지')
  .addOption(new Option('--policy <policy>', '에이전트가 확인한 커밋 권한').choices(['no-policy', 'permitted']).makeOptionMandatory())
  .requiredOption('--evidence <text>', '정책 확인 근거').addOption(outputOption())
  .option('--policy-file <path>', '추가 커밋 지침 파일 (반복 가능)', (v: string, p: string[]) => [...p, v], [])
  .option('--req <id>', '관련 요구사항 ID (반복 가능)', (v: string, p: string[]) => [...p, v], [])
  .option('--implement', '확정된 요구사항의 구현을 참조하는 커밋')
  .action(o => runWorkflow('commit.plan', () => commitCommand(process.cwd(), 'plan', o), o.format));
commit.command('apply').allowExcessArguments(false).requiredOption('--file <path>', 'plan 객체를 담은 UTF-8 JSON 파일').addOption(outputOption())
  .action(o => runWorkflow('commit.apply', () => commitCommand(process.cwd(), 'apply', o), o.format));
for (const name of ['spec', 'spec-preview']) {
const specPreview = program.command(name).description(name === 'spec' ? 'Markdown 명세 작성·조회·Git 기록' : 'Deprecated: spec의 실험용 호환 명령');
const run = (action: Parameters<typeof runSpecPreview>[0], o: Parameters<typeof runSpecPreview>[1]) => runSpecPreview(action, { ...o, experimental: name === 'spec' || !!o.experimental }, name === 'spec');
for (const action of ['commit-plan', 'commit-apply'] as const) specPreview.command(action).allowExcessArguments(false)
  .option('--experimental', '검토 문법을 명시적으로 사용').requiredOption('--file <path>', '커밋 입력 또는 계획 JSON 파일')
  .action(o => run(action, o));
specPreview.command('changes').allowExcessArguments(false).option('--experimental', '검토 문법을 명시적으로 사용')
  .action(o => run('changes', o));
specPreview.command('prepare').allowExcessArguments(false).option('--experimental', '검토 문법을 명시적으로 사용')
  .requiredOption('--file <path>', 'expected와 최종 reasons를 담은 JSON 파일').action(o => run('prepare', o));
specPreview.command('verify').allowExcessArguments(false).option('--experimental', '검토 문법을 명시적으로 사용')
  .requiredOption('--file <path>', 'prepare의 verification 객체를 담은 JSON 파일').option('--staged', 'index 원문도 비교')
  .action(o => run('verify', o));
specPreview.command('working').allowExcessArguments(false).option('--experimental', '검토 문법을 명시적으로 사용')
  .action(o => run('working', o));
specPreview.command('save').allowExcessArguments(false).option('--experimental', '검토 문법을 명시적으로 사용')
  .requiredOption('--file <path>', 'expected와 operations를 담은 UTF-8 JSON 파일').action(o => run('save', o));
specPreview.command('read').allowExcessArguments(false).option('--experimental', '검토 문법을 명시적으로 사용')
  .option('--ref <commit>', '읽을 커밋', 'HEAD').action(o => run('read', o));
specPreview.command('diff').allowExcessArguments(false).option('--experimental', '검토 문법을 명시적으로 사용')
  .requiredOption('--from <commit>', '이전 커밋').requiredOption('--to <commit>', '이후 커밋')
  .action(o => run('diff', o));
}
for (const name of ['req', 'note', 'mode']) {
  const command = program.commands.find(c => c.name() === name)!;
  command.description('Deprecated: 기존 형식 호환용 ' + command.description());
}
await program.parseAsync();
