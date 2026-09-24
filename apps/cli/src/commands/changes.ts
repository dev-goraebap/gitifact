import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkDocuments, compareDocumentSets, kindOfId, HISTORY_PATH, SPEC_ROOT, WIKI_ROOT,
  type DecisionRecord, type DocChange, type DocProblem } from '@gitifact/core';
import { createGitRunner } from '../adapters/git/run-git.js';
import { initRepository } from '../adapters/git/init-repository.js';
import { discardAgentInput, prepareAgentInputs, type AgentInputControls } from '../adapters/filesystem/agent-inputs.js';
import { readDocumentWarnings } from '../adapters/filesystem/document-warnings.js';
import { MIGRATION_TRAILER } from '../adapters/cache/index.js';
import { checkStoreSelection, fail, fingerprint, hash, info, object, optional, paths, policyPaths, record, text as bounded } from './commit-files.js';
import { readJsonInput } from './input.js';
import { CommandError, runCommand, section, text, type Format } from './output.js';
import { documentsOf, openProject, type Project } from './project.js';
import { t } from '../shared/i18n/index.js';

const fields = ['paths', 'message', 'authorization', 'migration'];
const integration = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply'];
/** The format version a migration commit moves to; `changes commit` puts it in the migration trailer. */
const MIGRATION_TARGET = '0.8.0';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const problemLines = (problems: DocProblem[]) => problems.map(p => '  ' + p.code + ' ' + p.message);
/** Old files a migration removes (0.7 requirements.md, design.md, per-folder history.jsonl, the wiki, the reason file): deletions there may be committed. */
const underDocuments = (path: string) => path.startsWith(SPEC_ROOT + '/') || path.startsWith(WIKI_ROOT + '/') || path === HISTORY_PATH;

/** The documents that differ from HEAD, and the records written but not yet committed. */
async function pendingChanges(project: Project, head: string | null) {
  const headFiles = head ? await project.cache.history.filesAt(head) : new Map<string, string>();
  const [working, records] = await Promise.all([project.cache.documents.files(), project.pendingRecords()]);
  return { headFiles, working, records, ...compareDocumentSets(headFiles, working.files) };
}
/**
 * The changes a record should explain and no record does. A new document carries its own why (a requirement's user
 * story), so only changing, moving or deleting what was there calls for one.
 */
const uncovered = (changes: DocChange[], records: DecisionRecord[]) => {
  const covered = new Set(records.flatMap(r => r.docs));
  return changes.filter(c => c.types.some(type => type !== 'created') && !covered.has(c.id)).map(c => c.id);
};
/** Changed documents two records explain: those records go into one commit, since a file cannot be split between two. */
const shared = (changes: DocChange[], records: DecisionRecord[]) =>
  changes.map(c => c.id).filter(id => records.filter(r => r.docs.includes(id)).length > 1);
const changeLine = (c: DocChange) => `${c.types.join(',').padEnd(9)} ${c.id} ${c.title} — ${c.path}${c.previousPath ? ' (← ' + c.previousPath + ')' : ''}`;
const recordLine = (r: DecisionRecord, changes: DocChange[]) => {
  const changed = new Set(changes.map(c => c.id));
  return `${r.id} ${r.title}${r.draft ? ' (' + t('docs.draft') + ')' : ''} — ${r.docs.map(d => changed.has(d) ? d : d + '*').join(', ')}`;
};
const recordSummary = (r: DecisionRecord) => ({ id: r.id, title: r.title, docs: r.docs, path: r.path, ...(r.draft ? { draft: true } : {}) });

/**
 * `changes list`: what changed since HEAD, the records written for it, and where to write the commit input. Records
 * name their documents, so the list shows which changes each record explains: one commit per record is the default,
 * and records that share a changed document go into one commit together.
 */
export const runChangesList = (options: { format: Format }, controls: AgentInputControls = {}) => runCommand('changes', options.format, async () => {
  const project = await openProject(process.cwd());
  const head = await project.head();
  const { changes, working, records: pending } = await pendingChanges(project, head);
  // The files are already read, so the commit's own check costs nothing here and a draft shows up before the commit fails.
  const checked = checkDocuments(new Map([...working.files, ...pending.files]));
  const records = checked.records;
  const withoutRecord = uncovered(changes, records); const sharedDocuments = shared(changes, records);
  const problems = [...working.problems, ...pending.problems, ...checked.problems];
  // Warnings do not stop the commit; they are counted here so a broken link shows up before it is committed.
  const warnings = await readDocumentWarnings(project.root, checked.documents);
  // The input folder rides on the read an agent runs before committing; a failure only leaves it out.
  const inputs = await prepareAgentInputs(project.root, controls).catch(() => undefined);
  const out = changes.length ? [t('changes.changed', { count: changes.length }), ...changes.map(c => '  ' + changeLine(c))] : [t('changes.none')];
  out.push(...section(t('changes.pendingRecords', { count: records.length }), records.map(r => recordLine(r, changes))));
  if (withoutRecord.length) out.push(t('changes.withoutRecord', { ids: withoutRecord.join(', ') }));
  if (sharedDocuments.length) out.push(t('changes.sharedDocuments', { ids: sharedDocuments.join(', ') }));
  if (pending.altered.length) out.push(t('changes.recordAltered', { paths: pending.altered.join(', ') }));
  out.push(problems.length ? t('changes.problems', { count: problems.length }) : t('changes.clean'));
  if (warnings.length) out.push(t('changes.warnings', { count: warnings.length }));
  if (inputs) out.push(t('changes.input', { path: inputs.commit }));
  return { json: { head, changes, pendingRecords: records.map(recordSummary), withoutRecord, sharedDocuments, alteredRecords: pending.altered, problems, warnings, inputs: inputs ?? null }, text: text(out) };
});

/** `changes commit`: reads the input, checks and commits the selected files, then removes an input file it consumed. */
export const runChangesCommit = (options: { format: Format; file: string; dryRun?: boolean }, controls: AgentInputControls & { stdin?: AsyncIterable<Uint8Array> } = {}) =>
  runCommand('changes', options.format, async () => {
    const input = await readJsonInput(options.file, controls.stdin);
    const result = await commitChanges(process.cwd(), input, !!options.dryRun);
    // Only a certain success consumes the input; failures and dry runs keep it for the retry.
    const inputRemoved = result.outcome === 'committed' && options.file !== '-' ? await discardAgentInput(result.root, options.file, controls) : undefined;
    const { root: _root, ...json } = result;
    const out = [result.outcome === 'committed' ? t('changes.committed', { commit: result.commit!.slice(0, 7), message: result.message.split('\n')[0]! }) : t('changes.dryRun'),
      t('changes.summary', { paths: result.paths.length, changes: result.changes.length, records: result.records.length }),
      ...result.changes.map(c => '  ' + changeLine(c)),
      ...result.records.map(r => '  ' + r.id + ' ' + r.title),
      ...(result.withoutRecord.length ? [t('changes.withoutRecord', { ids: result.withoutRecord.join(', ') })] : []),
      ...result.trailers];
    return { json: { ...json, ...(inputRemoved === undefined ? {} : { inputRemoved }) }, text: text(out) };
  });

/**
 * Checks the documents and commits the selected files in one process. Records are files the agent wrote; the ones
 * selected go into the commit and the others stay for a later one, so a commit can hold one decision.
 * State is read once; rechecks remain where another process could interfere: under the commit lock before staging,
 * before `git commit`, and after it. A commit whose result cannot be verified keeps every file and the recovery data.
 */
export async function commitChanges(cwd: string, input: unknown, dryRun: boolean) {
  const request = object(input);
  if (Object.keys(request).some(k => !fields.includes(k))) fail(t('commit.unknownField'));
  const selected = paths(request.paths); const authorization = object(request.authorization);
  if (Object.keys(authorization).sort().join(',') !== 'basis,evidence' || !['user-request', 'project-policy'].includes(String(authorization.basis))) fail(t('commit.authorizationRequired'));
  bounded(authorization.evidence, 2000);
  const message = bounded(request.message, 4000); if (/^\s*Gitifact-/im.test(message)) fail(t('commit.trailerInMessage'));
  if (request.migration !== undefined && request.migration !== true) fail(t('commit.migrationFlag'));

  const project = await openProject(cwd, { writing: true });
  const { root, gitDir, indexPath, objectFormat } = project;
  const base = await project.reader.baseline();
  await initRepository(root).validateBaseline(project.config, root, base.head, objectFormat);
  const runner = createGitRunner();
  const git = (args: string[], index?: string, stdin?: Buffer) => runner(['-c', 'core.fsmonitor=false', ...args], { cwd: root,
    env: { ...process.env, GIT_LITERAL_PATHSPECS: '1', GIT_GLOB_PATHSPECS: '0', GIT_NOGLOB_PATHSPECS: '0', GIT_ICASE_PATHSPECS: '0',
      GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) },
    timeoutMs: 120000, maxBytes: 32 * 1024 * 1024, ...(stdin ? { input: stdin } : {}) });
  const staged = async (index?: string) => (await git(['diff', '--cached', '--ita-visible-in-index', '--name-only', '--no-renames', '-z'], index)).toString('utf8').split('\0').filter(Boolean).sort();
  const busy = join(gitDir, 'gitifact-changes-commit.lock');
  if (await info(busy)) fail(t('commit.busy', { path: busy }));
  if ((await staged()).length) fail(t('commit.existingStaging'));
  const indexHash = hash(await optional(indexPath) ?? Buffer.alloc(0));

  const { headFiles, working, records: pending, changes: all } = await pendingChanges(project, base.head);
  // Committed records are the record of why; a new decision is a new record.
  if (pending.altered.length) fail(t('commit.recordAltered', { paths: pending.altered.join(', ') }));
  const chosen = new Map([...pending.files].filter(([path]) => selected.includes(path)));

  // The same check as `check`, with the records this commit carries; records left for later commits may still be drafts.
  const checked = checkDocuments(new Map([...working.files, ...chosen]));
  const problems = [...working.problems, ...pending.problems.filter(p => chosen.has(p.path)), ...checked.problems];
  if (problems.length) throw new CommandError('DOCS_CHECK_FAILED', t('commit.checkFailed', { count: problems.length }), { problems }, problemLines(problems));
  const records = checked.records;
  // A record may name a document this commit deletes, but not one that never existed.
  const existing = new Set([...checked.documents, ...documentsOf(headFiles)].map(d => d.id));
  const unknown = [...new Set(records.flatMap(r => r.docs))].filter(id => !existing.has(id));
  if (unknown.length) fail(t('commit.unknownDocument', { ids: unknown.join(', ') }));
  // The changed documents this commit takes. A moved document is its old and new path together, or not at all.
  const changes = all.filter(c => selected.includes(c.path) || (c.previousPath !== undefined && selected.includes(c.previousPath)));
  const split = changes.filter(c => c.previousPath !== undefined && !(selected.includes(c.path) && selected.includes(c.previousPath)));
  if (split.length) fail(t('commit.selectMove', { ids: split.map(c => c.id).join(', ') }));
  const withoutRecord = uncovered(changes, records);

  // Deleted files under the document folders are committed as deletions; everything else in .gitifact must be a store file.
  const status = (await git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames', '--', '.gitifact'])).toString('utf8').split('\0').filter(Boolean);
  const removed = new Set(status.filter(entry => entry.slice(0, 2).includes('D')).map(entry => entry.slice(3)));
  checkStoreSelection(selected.filter(p => !(underDocuments(p) && removed.has(p))));
  const stageable = selected;

  const ids = [...new Set([...changes.map(c => c.id), ...records.flatMap(r => r.docs)])].sort();
  const trailer = (name: string, kinds: string[]) => ids.filter(id => kinds.includes(kindOfId(id)!)).map(id => name + ': ' + id);
  const trailers = [...trailer('Gitifact-Req', ['requirement']), ...trailer('Gitifact-Design', ['design']), ...trailer('Gitifact-Doc', ['feature', 'wiki', 'instruction']),
    ...records.map(r => 'Gitifact-Record: ' + r.id).sort(),
    ...(request.migration ? [MIGRATION_TRAILER + ': ' + MIGRATION_TARGET] : [])];
  const contextPaths = policyPaths(selected);
  const hashes = async (list: string[]) => new Map(await Promise.all(list.map(async p => [p, await fingerprint(root, p)] as const)));
  // Policies and the selected files are bound now and compared again under the lock and before the commit.
  const started = await hashes([...new Set([...selected, ...contextPaths])]);
  const summary = { root, head: base.head, message, paths: selected, changes, records: records.map(recordSummary), withoutRecord, trailers };
  if (dryRun) {
    if (!same(base, await project.reader.baseline())) fail(t('commit.headChanged'));
    return { outcome: 'dry-run' as const, committed: false, ...summary, commit: undefined };
  }

  const temporary = join(gitDir, 'gitifact-commit-index-' + randomUUID());
  let owned = false; let uncertain = false; let commitStarted = false;
  let indexLock: Awaited<ReturnType<typeof open>> | undefined;
  let committed: { commit: string; paths: string[] } | undefined;
  try {
    try { await mkdir(busy); owned = true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') fail(t('commit.busy', { path: busy })); throw e; }
    const lock = indexLock = await open(indexPath + '.lock', 'wx', 0o600);
    const original = await optional(indexPath);
    if (hash(original ?? Buffer.alloc(0)) !== indexHash || (await staged()).length) fail(t('commit.indexChanged'));
    const before = await hashes([...started.keys()]);
    for (const [path, value] of started) if (before.get(path) !== value) fail(t('commit.fileChangedRunning', { path }));
    await writeFile(join(busy, 'recovery.json'), JSON.stringify({ before: base, originalIndex: original?.toString('base64') ?? null, temporary, paths: selected, message }));
    const locked = await hashes([...new Set([...selected, ...contextPaths])]);
    if (original) await writeFile(temporary, original, { flag: 'wx' }); else await git(['read-tree', '--empty'], temporary);
    await git(['add', '--', ...stageable], temporary);
    const actual = await staged(temporary);
    if (!actual.length || actual.some(p => !selected.includes(p))) fail(t('commit.unexpectedFiles'));
    const storeFiles = selected.filter(p => record(p) && locked.get(p) !== null);
    if (storeFiles.length) {
      // One batch reads the staged document and record bytes to reject Git filters that change them.
      const output = await git(['cat-file', '--batch'], temporary, Buffer.from(storeFiles.map(p => ':' + p).join('\n') + '\n')); let offset = 0;
      for (const path of storeFiles) {
        const end = output.indexOf(10, offset); const header = output.subarray(offset, end).toString('utf8').split(' '); const size = Number(header[2]);
        if (end < 0 || header[1] !== 'blob' || !Number.isSafeInteger(size) || output[end + 1 + size] !== 10) fail(t('commit.stagedUnreadable', { path }));
        // Line-ending normalization (core.autocrlf, eol attributes) is allowed; any other rewrite by a filter is not.
        const blob = output.subarray(end + 1, end + 1 + size); const file = await readFile(join(root, path));
        if (!blob.equals(file) && !blob.equals(Buffer.from(file.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'))) fail(t('commit.filterChanged'));
        offset = end + size + 2;
      }
    }
    const again = await hashes([...locked.keys()]);
    for (const [path, value] of locked) if (again.get(path) !== value) fail(t('commit.fileChangedPreparing', { path }));
    for (const name of integration) if (await info(join(gitDir, name))) fail(t('commit.integrationStarted'));
    if (!same(base, await project.reader.baseline())) fail(t('commit.headChanged'));
    const tree = (await git(['write-tree'], temporary)).toString('utf8').trim();
    commitStarted = true;
    await git(['commit', '-m', message.trim() + (trailers.length ? '\n\n' + trailers.join('\n') : '')], temporary);
    const after = await project.reader.baseline();
    if (!after.head) return fail(t('commit.resultUnknown'));
    // The raw object carries tree, parents and message without log formatting or signature display settings.
    const raw = (await git(['cat-file', 'commit', after.head])).toString('utf8'); const split = raw.indexOf('\n\n');
    const headers = raw.slice(0, split < 0 ? raw.length : split).split('\n'); const body = split < 0 ? '' : raw.slice(split + 2);
    const parents = headers.filter(h => h.startsWith('parent ')).map(h => h.slice(7));
    if (headers[0] !== 'tree ' + tree || after.branch !== base.branch || !same(parents, base.head ? [base.head] : [])
      || trailers.some(line => !body.split(/\r?\n/).includes(line))) fail(t('commit.resultAltered'));
    if (hash(await optional(indexPath) ?? Buffer.alloc(0)) !== indexHash) fail(t('commit.indexChangedAfter'));
    if ((await git(['write-tree'], temporary)).toString('utf8').trim() !== tree) fail(t('commit.hookChangedStaging'));
    // Preserve unrelated index flags while publishing only the verified commit's index.
    await lock.writeFile(await readFile(temporary)); await lock.sync(); await lock.close();
    await rename(indexPath + '.lock', indexPath); indexLock = undefined;
    committed = { commit: after.head, paths: actual };
  } catch (error) {
    if (commitStarted) { try { uncertain = !same(base, await project.reader.baseline()); } catch { uncertain = true; } }
    if (uncertain) throw new CommandError('COMMIT_UNCERTAIN', t('commit.uncertain', { path: busy }));
    throw error;
  } finally {
    await indexLock?.close().catch(() => {});
    if (!uncertain) {
      if (indexLock) await unlink(indexPath + '.lock').catch(() => {});
      await unlink(temporary).catch(() => {});
      if (owned) { await unlink(join(busy, 'recovery.json')).catch(() => {}); await rmdir(busy); }
    }
  }
  return { outcome: 'committed' as const, committed: true, ...summary, commit: committed!.commit, paths: committed!.paths, pushed: false };
}
