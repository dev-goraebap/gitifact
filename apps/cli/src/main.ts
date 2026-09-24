import { Argument, Command, Option } from 'commander';
import { runBrowser, parsePort } from './commands/browser.js';
import { runInit } from './commands/init.js';
import { newKinds, runDocsCheck, runDocsHistory, runDocsList, runDocsNew, runDocsSearch, runDocsShow } from './commands/docs.js';
import { runChangesCommit, runChangesList } from './commands/changes.js';
import { runGuideList, runGuideShow } from './commands/guide.js';
import { formats } from './commands/output.js';
import { runUpdate } from './commands/update.js';
import { runUpdateCheck } from './commands/update-check.js';
import { agentPresetNames } from './commands/agent-block.js';
import { t, configureLanguage, environmentLanguage, type Language } from './shared/i18n/index.js';

declare const __CLI_VERSION__: string;

// Resolve before constructing help text; Commander still validates the actual option.
const languageArgs = process.argv.slice(2).slice(0, process.argv.slice(2).indexOf('--') < 0 ? undefined : process.argv.slice(2).indexOf('--'));
let selectedLanguage: Language | undefined;
for (let i = 0; i < languageArgs.length; i++) {
  const arg = languageArgs[i]!;
  const value = arg === '--lang' ? languageArgs[++i] : arg.startsWith('--lang=') ? arg.slice(7) : undefined;
  if (value === 'ko' || value === 'en') selectedLanguage = value;
}
configureLanguage(selectedLanguage ?? environmentLanguage(), selectedLanguage);
const program = new Command()
  .name('gitifact')
  .addOption(new Option('--lang <language>', t('help.lang')).choices(['ko', 'en']))
  .description(t('help.program'))
  .version(__CLI_VERSION__)
  .allowExcessArguments(false)
  .addHelpText('after', '\n' + t('help.notYet'))
  .action(() => program.outputHelp());
// Queries print text by default; --format json gives the same result with the {contract, version, ok} envelope.
const format = () => new Option('--format <format>', t('help.format')).choices(formats).default('text');

program.command('browser')
  .description(t('help.browser'))
  .allowExcessArguments(false)
  .option('--port <port>', t('help.browserPort'), parsePort, 0)
  .option('--dev', t('help.browserDev'))
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

program.command('update')
  .description(t('help.update'))
  .allowExcessArguments(false)
  .addOption(new Option('--format <format>', t('help.format')).choices(['json', 'text']).default('json'))
  .option('--commit', t('help.updateCommit'))
  .addOption(new Option('--check', t('help.updateCheck')).conflicts('commit'))
  .action(options => options.check ? runUpdateCheck(options.format, __CLI_VERSION__) : runUpdate(options, __CLI_VERSION__));

const docs = program.command('docs').description(t('help.docs'));
docs.command('list').description(t('help.docsList')).allowExcessArguments(false)
  .option('--feature <name>', t('help.docsListFeature'))
  .addOption(new Option('--kind <kind>', t('help.docsListKind')).choices(['spec', 'instruction']))
  .addOption(format()).action(o => runDocsList(o));
docs.command('search').description(t('help.docsSearch')).argument('<words...>', t('help.docsSearchWords'))
  .addOption(format()).action((words: string[], o) => runDocsSearch(words.join(' '), o));
docs.command('show').description(t('help.docsShow')).argument('<ids...>', t('help.docsShowIds'))
  .option('--ref <commit>', t('help.docsShowRef')).addOption(format()).action((ids: string[], o) => runDocsShow(ids, o));
docs.command('new').description(t('help.docsNew')).allowExcessArguments(false)
  .addArgument(new Argument('<kind>', t('help.docsNewKind')).choices(newKinds))
  .argument('<path>', t('help.docsNewPath'))
  .requiredOption('--title <title>', t('help.docsNewTitle')).requiredOption('--description <text>', t('help.docsNewDescription'))
  .addOption(format()).action((kind: typeof newKinds[number], path: string, o) => runDocsNew(kind, path, o));
docs.command('check').description(t('help.docsCheck')).allowExcessArguments(false).addOption(format()).action(o => runDocsCheck(o));
docs.command('history').description(t('help.docsHistory')).argument('<id>', t('help.docsHistoryId')).allowExcessArguments(false)
  .addOption(format()).action((id: string, o) => runDocsHistory(id, o));

const changes = program.command('changes').description(t('help.changes'));
changes.command('list').description(t('help.changesList')).allowExcessArguments(false).addOption(format()).action(o => runChangesList(o));
changes.command('commit').description(t('help.changesCommit')).allowExcessArguments(false)
  .requiredOption('--file <path>', t('help.changesCommitFile')).option('--dry-run', t('help.changesCommitDryRun'))
  .addOption(format()).action(o => runChangesCommit(o));

const guide = program.command('guide').description(t('help.guide'));
guide.command('list').description(t('help.guideList')).allowExcessArguments(false).addOption(format()).action(o => runGuideList(o));
guide.command('show').description(t('help.guideShow')).argument('<topic>', t('help.guideTopic')).allowExcessArguments(false)
  .addOption(format()).action((topic: string, o) => runGuideShow(topic, o));


await program.parseAsync();
