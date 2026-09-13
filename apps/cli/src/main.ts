import { Command, Option } from 'commander';
import { runStatus } from './commands/status.js';
import { runBrowser, parsePort } from './commands/browser.js';
import { runInit } from './commands/init.js';
import { runNote } from './commands/note.js';
import { runBrief } from './commands/brief.js';
import { runSkills } from './commands/skills.js';

declare const __CLI_VERSION__: string;

const program = new Command()
  .name('tryce')
  .description('프로젝트의 요구사항과 결정 이력을 Git에 남기는 도구')
  .version(__CLI_VERSION__)
  .allowExcessArguments(false)
  .addHelpText('after', '\n개발 초기 버전입니다. 요구사항 기록·검사 명령은 아직 제공하지 않습니다.')
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
  .addOption(new Option('--mode <mode>', '최초 프로젝트 모드').choices(['normal', 'prototype']))
  .option('--dry-run', '파일을 만들지 않고 초기화 계획 확인')
  .addOption(new Option('--format <format>', '출력 형식').choices(['json', 'text']).default('json'))
  .action(runInit);

const note = program.command('note').description('프로토타입의 발견·제약·기각 이유 기록');
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
await program.parseAsync();
