import { Command, Option } from 'commander';
import { runStatus } from './commands/status.js';
import { runBrowser, parsePort } from './commands/browser.js';
import { runInit } from './commands/init.js';
import { runSkills } from './commands/skills.js';
import { runSpecPreview } from './commands/spec-preview.js';
import { runMigrate } from './commands/migrate.js';

declare const __CLI_VERSION__: string;

const program = new Command()
  .name('gitifact')
  .description('프로젝트의 요구사항과 결정 이력을 Git에 남기는 도구')
  .version(__CLI_VERSION__)
  .allowExcessArguments(false)
  .addHelpText('after', '\n전체 이력 검사와 GUI 요구사항 편집은 아직 제공하지 않습니다.')
  .action(() => program.outputHelp());

program.command('status')
  .description('현재 checkout의 Git 상태 조회 (gitifact 검사 미실행)')
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
  .option('--dry-run', '파일을 만들지 않고 초기화 계획 확인')
  .addOption(new Option('--format <format>', '출력 형식').choices(['json', 'text']).default('json'))
  .action(runInit);

program.command('migrate')
  .description('.tryce 저장소를 .gitifact로 전환 (경로와 마커만 바꾸고 ID·이유·이력은 보존)')
  .allowExcessArguments(false)
  .option('--dry-run', '파일을 바꾸지 않고 전환 계획 확인')
  .action(runMigrate);

const outputOption = () => new Option('--format <format>', '출력 형식').choices(['json', 'text']).default('json');
const skills = program.command('skills').description('프로젝트 스킬 원본 설치와 로컬 복사본 관리');
for (const action of ['install', 'sync', 'remove'] as const) {
  const command = skills.command(action).allowExcessArguments(false).option('--dry-run', '파일을 쓰지 않고 계획 확인').addOption(outputOption());
  if (action !== 'remove') command.addOption(new Option('--agent <agent>', '사용할 에이전트').choices(['codex', 'claude']));
  command.action(options => runSkills(action, options));
}

const spec = program.command('spec').description('Markdown 명세 작성·조회·Git 기록');
const replaced = 'Deprecated: 0.6.0에서 제거 예정. spec commit을 사용하세요.';
spec.command('commit').description('변경 이유 기록과 관련 파일 커밋을 한 번에 실행').allowExcessArguments(false)
  .requiredOption('--file <path>', 'reasons·paths·message·authorization을 담은 JSON 파일')
  .option('--dry-run', '파일을 쓰거나 커밋하지 않고 결과만 확인').action(o => runSpecPreview('commit', o));
for (const action of ['commit-plan', 'commit-apply'] as const) spec.command(action).description(replaced).allowExcessArguments(false)
  .requiredOption('--file <path>', '커밋 입력 또는 계획 JSON 파일').action(o => runSpecPreview(action, o));
spec.command('changes').allowExcessArguments(false).action(o => runSpecPreview('changes', o));
spec.command('prepare').description(replaced).allowExcessArguments(false)
  .requiredOption('--file <path>', 'expected와 최종 reasons를 담은 JSON 파일').action(o => runSpecPreview('prepare', o));
spec.command('verify').description(replaced).allowExcessArguments(false)
  .requiredOption('--file <path>', 'prepare의 verification 객체를 담은 JSON 파일').option('--staged', 'index 원문도 비교')
  .action(o => runSpecPreview('verify', o));
spec.command('working').allowExcessArguments(false).action(o => runSpecPreview('working', o));
spec.command('save').allowExcessArguments(false)
  .requiredOption('--file <path>', 'expected와 operations를 담은 UTF-8 JSON 파일').action(o => runSpecPreview('save', o));
spec.command('read').allowExcessArguments(false).option('--ref <commit>', '읽을 커밋', 'HEAD').action(o => runSpecPreview('read', o));
spec.command('diff').allowExcessArguments(false)
  .requiredOption('--from <commit>', '이전 커밋').requiredOption('--to <commit>', '이후 커밋')
  .action(o => runSpecPreview('diff', o));

await program.parseAsync();
