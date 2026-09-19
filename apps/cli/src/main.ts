import { Command, Option } from 'commander';
import { runStatus } from './commands/status.js';
import { runBrowser, parsePort } from './commands/browser.js';
import { runInit } from './commands/init.js';
import { runDocs } from './commands/docs.js';
import { runUpdate } from './commands/update.js';
import { agentPresetNames } from './commands/agent-block.js';
import { runSpecPreview } from './commands/spec-preview.js';
import { runMigrate } from './commands/migrate.js';
import { t } from './shared/i18n/index.js';

declare const __CLI_VERSION__: string;

const program = new Command()
  .name('gitifact')
  .description(t('help.program'))
  .version(__CLI_VERSION__)
  .allowExcessArguments(false)
  .addHelpText('after', '\n' + t('help.notYet'))
  .action(() => program.outputHelp());

program.command('status')
  .description(t('help.status'))
  .allowExcessArguments(false)
  .addOption(new Option('--format <format>', t('help.format')).choices(['json', 'text']).default('json'))
  .action(async (options: { format: 'json' | 'text' }) => { await runStatus(options.format); });

program.command('browser')
  .description(t('help.browser'))
  .allowExcessArguments(false)
  .option('--port <port>', t('help.browserPort'), parsePort, 0)
  .option('--dev', t('help.browserDev'))
  .option('--no-update-check', t('help.browserNoUpdateCheck'))
  .action(options => runBrowser(options, __CLI_VERSION__));

program.command('init')
  .description(t('help.init'))
  .allowExcessArguments(false)
  .option('--dry-run', t('help.initDryRun'))
  .addOption(new Option('--agent <agent>', t('help.initAgent')).choices([...agentPresetNames]))
  .addOption(new Option('--remove-agents', t('help.initRemoveAgents')).conflicts('skipAgents'))
  .option('--skip-agents', t('help.initSkipAgents'))
  .addOption(new Option('--format <format>', t('help.format')).choices(['json', 'text']).default('json'))
  .action(options => runInit(options, __CLI_VERSION__));

program.command('docs')
  .description(t('help.docs'))
  .argument('[topic]', t('help.docsTopic'))
  .allowExcessArguments(false)
  .action(async (topic?: string) => { await runDocs(topic); });

program.command('update')
  .description(t('help.update'))
  .allowExcessArguments(false)
  .addOption(new Option('--format <format>', t('help.format')).choices(['json', 'text']).default('json'))
  .option('--commit', t('help.updateCommit'))
  .action(options => runUpdate(options, __CLI_VERSION__));

program.command('migrate')
  .description(t('help.migrate'))
  .allowExcessArguments(false)
  .option('--dry-run', t('help.migrateDryRun'))
  .action(runMigrate);

const spec = program.command('spec').description(t('help.spec'));
spec.command('commit').description(t('help.specCommit')).allowExcessArguments(false)
  .requiredOption('--file <path>', t('help.specCommitFile'))
  .option('--dry-run', t('help.specCommitDryRun')).action(o => runSpecPreview('commit', o));
spec.command('changes').description(t('help.specChanges')).allowExcessArguments(false).action(o => runSpecPreview('changes', o));
spec.command('working').description(t('help.specWorking')).allowExcessArguments(false)
  .addOption(new Option('--stamp', t('help.specWorkingStamp')).conflicts(['feature', 'ids']))
  .option('--feature <name>', t('help.specWorkingFeature')).option('--ids', t('help.specWorkingIds'))
  .action(o => runSpecPreview('working', o));
spec.command('save').description(t('help.specSave')).allowExcessArguments(false)
  .requiredOption('--file <path>', t('help.specSaveFile')).action(o => runSpecPreview('save', o));
spec.command('read').description(t('help.specRead')).allowExcessArguments(false).option('--ref <commit>', t('help.specReadRef'), 'HEAD').action(o => runSpecPreview('read', o));
spec.command('diff').description(t('help.specDiff')).allowExcessArguments(false)
  .requiredOption('--from <commit>', t('help.specDiffFrom')).requiredOption('--to <commit>', t('help.specDiffTo'))
  .action(o => runSpecPreview('diff', o));

await program.parseAsync();
