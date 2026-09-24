import { checkDocuments, docProblem, type DocProblem, type DocWarning } from '@gitifact/core';
import { readDocumentWarnings } from '../adapters/filesystem/document-warnings.js';
import { runCommand, section, text, type CommandResult, type Format } from './output.js';
import { openProject } from './project.js';
import { t } from '../shared/i18n/index.js';

const problemLines = (problems: (DocProblem | DocWarning)[]) => problems.map(p => p.code + ' ' + p.message);

/**
 * `check`: every problem in the whole set of specs, instructions and uncommitted records; exit code 1 when there is
 * any. It stays one command above the resources because a problem often lies between them — a design naming an
 * instruction that was removed. Link and asset warnings are listed after the problems and never change the exit code.
 */
export const runCheck = (options: { format: Format }) => runCommand('check', options.format, async (): Promise<CommandResult> => {
  const project = await openProject(process.cwd());
  const [{ files, problems: unreadable }, pending] = await Promise.all([project.cache.documents.files(), project.pendingRecords()]);
  // Uncommitted records are checked with the documents; committed ones never change, so they are not read again.
  const result = checkDocuments(new Map([...files, ...pending.files]));
  const problems = [...unreadable, ...pending.problems, ...pending.altered.map(path => docProblem('RECORD_ALTERED', path)), ...result.problems];
  const warnings = await readDocumentWarnings(project.root, result.documents);
  return { json: { documents: result.documents.length, problems, warnings }, failed: problems.length > 0,
    text: text([...(problems.length ? [t('docs.problems', { count: problems.length }), ...problemLines(problems).map(l => '  ' + l)]
      : [t('docs.clean', { count: result.documents.length })]),
      ...section(t('docs.warnings', { count: warnings.length }), problemLines(warnings))]) };
});
