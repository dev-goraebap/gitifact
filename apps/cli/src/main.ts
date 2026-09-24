import { Argument, Command, Option } from 'commander';
import { runBrowser, parsePort } from './commands/browser.js';
import { runInit } from './commands/init.js';
import { runSpecsList, runSpecsNew, runSpecsShow, specKinds, specSorts } from './commands/specs.js';
import { instructionSorts, runInstructionsList, runInstructionsNew, runInstructionsShow } from './commands/instructions.js';
import { runCheck } from './commands/check.js';
import { parseFields, parseLimit } from './commands/list-options.js';
import { runChangesCommit, runChangesList } from './commands/changes.js';
import { runRecordsList, runRecordsNew, runRecordsShow } from './commands/records.js';
import { runFeedback } from './commands/feedback.js';
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

// Every list takes the same options with the same meaning; each resource adds its own filters and sort keys.
const listed = (command: Command, sorts?: readonly string[]) => {
  command.allowExcessArguments(false)
    .option('--q <words>', t('help.listQ'))
    .option('--author <name>', t('help.listAuthor'));
  if (sorts) command.addOption(new Option('--sort <key>', t('help.listSort')).choices([...sorts]).default(sorts[0]));
  return command.option('--limit <n>', t('help.listLimit'), parseLimit)
    .option('--fields <names>', t('help.listFields'), parseFields)
    .addOption(format());
};

const specs = program.command('specs').description(t('help.specs'));
listed(specs.command('list').description(t('help.specsList'))
  .addOption(new Option('--type <kind>', t('help.specsListType')).choices([...specKinds]))
  .option('--feature <folder>', t('help.specsListFeature'))
  .option('--without-design', t('help.specsListWithoutDesign'))
  .option('--uncovered', t('help.specsListUncovered'))
  .option('--draft', t('help.specsListDraft'))
  .option('--changed-since <date|commit>', t('help.specsListChangedSince')), specSorts).action(o => runSpecsList(o));
specs.command('show').description(t('help.specsShow')).argument('<ids...>', t('help.specsShowIds'))
  .option('--ref <commit>', t('help.showRef')).addOption(format()).action((ids: string[], o) => runSpecsShow(ids, o));
specs.command('new').description(t('help.specsNew')).allowExcessArguments(false)
  .addArgument(new Argument('<kind>', t('help.specsNewKind')).choices(specKinds))
  .argument('<path>', t('help.specsNewPath'))
  .requiredOption('--title <title>', t('help.newTitle')).requiredOption('--description <text>', t('help.newDescription'))
  .addOption(format()).action((kind: typeof specKinds[number], path: string, o) => runSpecsNew(kind, path, o));

const instructions = program.command('instructions').description(t('help.instructions'));
listed(instructions.command('list').description(t('help.instructionsList')), instructionSorts).action(o => runInstructionsList(o));
instructions.command('show').description(t('help.instructionsShow')).argument('<targets...>', t('help.instructionsShowTargets'))
  .option('--ref <commit>', t('help.showRef')).option('--file <path>', t('help.instructionsShowFile'))
  .addOption(format()).action((targets: string[], o) => runInstructionsShow(targets, o));
instructions.command('new').description(t('help.instructionsNew')).allowExcessArguments(false)
  .argument('<name>', t('help.instructionsNewName'))
  .requiredOption('--title <title>', t('help.newTitle')).requiredOption('--description <text>', t('help.newDescription'))
  .addOption(format()).action((name: string, o) => runInstructionsNew(name, o));

const records = program.command('records').description(t('help.records'));
listed(records.command('list').description(t('help.recordsList'))
  .option('--doc <id>', t('help.recordsListDoc'))
  .option('--since <date|commit>', t('help.recordsListSince'))).action(o => runRecordsList(o));
records.command('show').description(t('help.recordsShow')).argument('<ids...>', t('help.recordsShowId'))
  .addOption(format()).action((ids: string[], o) => runRecordsShow(ids, o));
records.command('new').description(t('help.recordsNew')).allowExcessArguments(false)
  .requiredOption('--title <title>', t('help.recordsTitle')).requiredOption('--docs <ids...>', t('help.recordsDocs'))
  .addOption(format()).action(o => runRecordsNew(o));

program.command('check').description(t('help.check')).allowExcessArguments(false).addOption(format()).action(o => runCheck(o));

const changes = program.command('changes').description(t('help.changes'));
changes.command('list').description(t('help.changesList')).allowExcessArguments(false).addOption(format()).action(o => runChangesList(o));
changes.command('commit').description(t('help.changesCommit')).allowExcessArguments(false)
  .requiredOption('--file <path>', t('help.changesCommitFile')).option('--dry-run', t('help.changesCommitDryRun'))
  .addOption(format()).action(o => runChangesCommit(o));

program.command('feedback').description(t('help.feedback')).allowExcessArguments(false)
  .requiredOption('--file <path>', t('help.feedbackFile')).option('--dry-run', t('help.feedbackDryRun'))
  .addOption(format()).action(o => runFeedback(o, __CLI_VERSION__));

const guide = program.command('guide').description(t('help.guide'));
guide.command('list').description(t('help.guideList')).allowExcessArguments(false).addOption(format()).action(o => runGuideList(o));
guide.command('show').description(t('help.guideShow')).argument('<topic>', t('help.guideTopic')).allowExcessArguments(false)
  .addOption(format()).action((topic: string, o) => runGuideShow(topic, o));


await program.parseAsync();
