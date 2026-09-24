import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkDocuments, compareDocumentSets, docIdPattern, kindOfId, parseReasonLines, renderReasonLine, HISTORY_PATH, SPEC_ROOT, WIKI_ROOT,
  type DocChange, type DocProblem, type DocReason } from '@gitifact/core';
import { createGitRunner } from '../adapters/git/run-git.js';
import { initRepository } from '../adapters/git/init-repository.js';
import { discardAgentInput, prepareAgentInputs, type AgentInputControls } from '../adapters/filesystem/agent-inputs.js';
import { generateId } from '../adapters/filesystem/document-file.js';
import { readDocumentWarnings } from '../adapters/filesystem/document-warnings.js';
import { MIGRATION_TRAILER } from '../adapters/cache/index.js';
import { checkStoreSelection, fail, fingerprint, hash, info, object, optional, paths, policyPaths, record, text as bounded } from './commit-files.js';
import { CommandError, runCommand, section, text, type Format } from './output.js';
import { documentsOf, openProject, type Project } from './project.js';
import { t } from '../shared/i18n/index.js';

const fields = ['reasons', 'paths', 'message', 'authorization', 'migration'];
const integration = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply'];
/** The format version a migration commit moves to; `changes commit` puts it in the migration trailer. */
const MIGRATION_TARGET = '0.8.0';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const problemLines = (problems: DocProblem[]) => problems.map(p => '  ' + p.code + ' ' + p.message);
const reasonsOf = (source: string | undefined) => { try { return source ? parseReasonLines(HISTORY_PATH, source) : []; } catch { return []; } };
/** Old files a migration removes (0.7 requirements.md, design.md, per-folder history.jsonl): deletions there may be committed. */
const underDocuments = (path: string) => path.startsWith(SPEC_ROOT + '/') || path.startsWith(WIKI_ROOT + '/');

/** The documents that differ from HEAD and the reasons written for them but not yet committed. */
async function pendingChanges(project: Project, head: string | null) {
  const headFiles = head ? await project.cache.history.filesAt(head) : new Map<string, string>();
  const working = await project.cache.documents.files();
  return { headFiles, working, ...compareDocumentSets(headFiles, working.files) };
}
const uncovered = (changes: DocChange[], reasons: DocReason[]) => { const covered = new Set(reasons.flatMap(r => r.docs)); return changes.filter(c => !covered.has(c.id)).map(c => c.id); };
const changeLine = (c: DocChange) => `${c.types.join(',').padEnd(9)} ${c.id} ${c.title} — ${c.path}${c.previousPath ? ' (← ' + c.previousPath + ')' : ''}`;
const reasonLine = (r: DocReason) => `${r.id} ${r.docs.join(', ')}: ${r.reason.replace(/\s+/g, ' ')}`;

/** `changes list`: what the next commit has to explain, and where to write its input. */
export const runChangesList = (options: { format: Format }, controls: AgentInputControls = {}) => runCommand('changes', options.format, async () => {
  const project = await openProject(process.cwd());
  const head = await project.head();
  const { changes, reasons, altered, working } = await pendingChanges(project, head);
  const withoutReason = uncovered(changes, reasons);
  // The files are already read, so the commit's own check costs nothing here and a draft shows up before the commit fails.
  const checked = checkDocuments(working.files);
  const problems = [...working.problems, ...checked.problems];
  // Warnings do not stop the commit; they are counted here so a broken link shows up before it is committed.
  const warnings = await readDocumentWarnings(project.root, checked.documents);
  // The input folder rides on the read an agent runs before committing; a failure only leaves it out.
  const inputs = await prepareAgentInputs(project.root, controls).catch(() => undefined);
  const out = changes.length ? [t('changes.changed', { count: changes.length }), ...changes.map(c => '  ' + changeLine(c))] : [t('changes.none')];
  out.push(...section(t('changes.pendingReasons', { count: reasons.length }), reasons.map(reasonLine)));
  if (withoutReason.length) out.push(t('changes.withoutReason', { ids: withoutReason.join(', ') }));
  if (altered.length) out.push(t('changes.reasonAltered', { ids: altered.join(', ') }));
  out.push(problems.length ? t('changes.problems', { count: problems.length }) : t('changes.clean'));
  if (warnings.length) out.push(t('changes.warnings', { count: warnings.length }));
  if (inputs) out.push(t('changes.input', { path: inputs.commit }));
  return { json: { head, changes, pendingReasons: reasons, withoutReason, alteredReasons: altered, problems, warnings, inputs: inputs ?? null }, text: text(out) };
});

/** `changes commit`: reads the input, records the reasons and commits, then removes an input file it consumed. */
export const runChangesCommit = (options: { format: Format; file: string; dryRun?: boolean }, controls: AgentInputControls & { stdin?: AsyncIterable<Uint8Array> } = {}) =>
  runCommand('changes', options.format, async () => {
    const bytes = options.file === '-' ? await readStdin(controls.stdin ?? process.stdin) : await readInputFile(options.file);
    let input: unknown;
    try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new CommandError('INVALID_INPUT', t('input.json')); }
    const result = await commitChanges(process.cwd(), input, !!options.dryRun);
    // Only a certain success consumes the input; failures and dry runs keep it for the retry.
    const inputRemoved = result.outcome === 'committed' && options.file !== '-' ? await discardAgentInput(result.root, options.file, controls) : undefined;
    const { root: _root, ...json } = result;
    const out = [result.outcome === 'committed' ? t('changes.committed', { commit: result.commit!.slice(0, 7), message: result.message.split('\n')[0]! }) : t('changes.dryRun'),
      t('changes.summary', { paths: result.paths.length, changes: result.changes.length, reasons: result.reasons.length }),
      ...result.changes.map(c => '  ' + changeLine(c)),
      ...(result.withoutReason.length ? [t('changes.withoutReason', { ids: result.withoutReason.join(', ') })] : []),
      ...result.trailers];
    return { json: { ...json, ...(inputRemoved === undefined ? {} : { inputRemoved }) }, text: text(out) };
  });

async function readInputFile(path: string) {
  const source = await stat(path).catch(() => undefined);
  if (!source?.isFile() || source.size > 1024 * 1024) throw new CommandError('INVALID_INPUT', t('input.file'));
  return readFile(path);
}
async function readStdin(stream: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new CommandError('INVALID_INPUT', t('input.size'));
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseReasons(value: unknown): { docs: string[]; reason: string }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1000) return fail(t('commit.invalidReasons'));
  return value.map(item => {
    const r = object(item);
    if (Object.keys(r).sort().join(',') !== 'docs,reason' || !Array.isArray(r.docs) || !r.docs.length || r.docs.length > 1000
      || r.docs.some(d => typeof d !== 'string' || !docIdPattern.test(d)) || new Set(r.docs).size !== r.docs.length) return fail(t('commit.invalidReasons'));
    return { docs: r.docs as string[], reason: bounded(r.reason, 4000) };
  });
}

/**
 * Checks the documents, records the reasons and commits the selected files in one process.
 * State is read once; rechecks remain where another process could interfere: under the commit lock before staging,
 * before `git commit`, and after it. A rejected commit restores the reason file; a commit whose result cannot be
 * verified keeps every file and the recovery data.
 */
export async function commitChanges(cwd: string, input: unknown, dryRun: boolean) {
  const request = object(input);
  if (Object.keys(request).some(k => !fields.includes(k))) fail(t('commit.unknownField'));
  const selected = paths(request.paths); const authorization = object(request.authorization);
  if (Object.keys(authorization).sort().join(',') !== 'basis,evidence' || !['user-request', 'project-policy'].includes(String(authorization.basis))) fail(t('commit.authorizationRequired'));
  bounded(authorization.evidence, 2000);
  const message = bounded(request.message, 4000); if (/^\s*Gitifact-/im.test(message)) fail(t('commit.trailerInMessage'));
  if (request.migration !== undefined && request.migration !== true) fail(t('commit.migrationFlag'));
  const requested = parseReasons(request.reasons);

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

  const { headFiles, working } = await pendingChanges(project, base.head);
  // New reasons go at the end of the one reason file, in the line endings it already has.
  const previous = working.files.get(HISTORY_PATH);
  const taken = new Set([...reasonsOf(previous), ...reasonsOf(headFiles.get(HISTORY_PATH))].map(r => r.id));
  const lines: DocReason[] = requested.map(r => { let id: string; do id = generateId('H'); while (taken.has(id)); taken.add(id); return { id, ...r }; });
  const eol = previous?.includes('\r\n') ? '\r\n' : '\n';
  const next = lines.length ? (previous ?? '') + (previous && !previous.endsWith('\n') ? eol : '') + lines.map(renderReasonLine).join(eol) + eol : undefined;
  const finalFiles = new Map(working.files); if (next !== undefined) finalFiles.set(HISTORY_PATH, next);

  // The same check as `docs check`, on the files as they will be committed.
  const checked = checkDocuments(finalFiles);
  const problems = [...working.problems, ...checked.problems];
  if (problems.length) throw new CommandError('DOCS_CHECK_FAILED', t('commit.checkFailed', { count: problems.length }), { problems }, problemLines(problems));
  // A reason may name a document this commit deletes, but not one that never existed.
  const existing = new Set([...checked.documents, ...documentsOf(headFiles)].map(d => d.id));
  const unknown = [...new Set(lines.flatMap(r => r.docs))].filter(id => !existing.has(id));
  if (unknown.length) fail(t('commit.unknownDocument', { ids: unknown.join(', ') }));
  const { changes, reasons: pendingReasons, altered } = compareDocumentSets(headFiles, finalFiles);
  // Committed reasons are the record of why; new ones are only ever appended.
  if (altered.length) fail(t('commit.reasonAltered', { ids: altered.join(', ') }));
  const withoutReason = uncovered(changes, pendingReasons);

  // Every changed document file and the reason file go into this commit; Git decides what changed, line endings included.
  const status = (await git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames', '--', '.gitifact'])).toString('utf8').split('\0').filter(Boolean);
  const removed = new Set<string>(); const pending = new Set<string>();
  for (const entry of status) {
    const path = entry.slice(3);
    if (entry.slice(0, 2).includes('D')) removed.add(path);
    if (record(path) || (underDocuments(path) && removed.has(path))) pending.add(path);
  }
  if (next !== undefined) pending.add(HISTORY_PATH);
  if ([...pending].some(p => !selected.includes(p))) fail(t('commit.selectPending'));
  checkStoreSelection(selected.filter(p => !(underDocuments(p) && removed.has(p))));
  // A selected reason file with nothing to record is skipped instead of failing `git add`.
  const stageable = selected.filter(p => p !== HISTORY_PATH || finalFiles.has(p) || headFiles.has(p));

  const ids = [...new Set([...changes.map(c => c.id), ...lines.flatMap(r => r.docs)])].sort();
  const trailer = (name: string, kinds: string[]) => ids.filter(id => kinds.includes(kindOfId(id)!)).map(id => name + ': ' + id);
  const trailers = [...trailer('Gitifact-Req', ['requirement']), ...trailer('Gitifact-Design', ['design']), ...trailer('Gitifact-Doc', ['feature', 'wiki', 'instruction']),
    ...(request.migration ? [MIGRATION_TRAILER + ': ' + MIGRATION_TARGET] : [])];
  const contextPaths = policyPaths(selected);
  const hashes = async (list: string[]) => new Map(await Promise.all(list.map(async p => [p, await fingerprint(root, p)] as const)));
  // Policies and files read by the agent are bound now; the reason file is bound after it is written.
  const started = await hashes([...new Set([...selected.filter(p => p !== HISTORY_PATH || next === undefined), ...contextPaths])]);
  const summary = { root, head: base.head, message, paths: selected, changes, reasons: lines, pendingReasons, withoutReason, trailers };
  if (dryRun) {
    if (!same(base, await project.reader.baseline())) fail(t('commit.headChanged'));
    return { outcome: 'dry-run' as const, committed: false, ...summary, commit: undefined };
  }

  const historyFile = join(root, ...HISTORY_PATH.split('/'));
  const temporary = join(gitDir, 'gitifact-commit-index-' + randomUUID());
  let owned = false; let uncertain = false; let keep = false; let wrote = false; let commitStarted = false;
  let indexLock: Awaited<ReturnType<typeof open>> | undefined;
  let committed: { commit: string; paths: string[] } | undefined;
  const publish = async (text: string) => {
    const temp = join(root, '.gitifact', '.history-' + randomUUID() + '.tmp');
    await writeFile(temp, text, { flag: 'wx' });
    try { await rename(temp, historyFile); } catch (error) { await unlink(temp).catch(() => {}); throw error; }
  };
  try {
    try { await mkdir(busy); owned = true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') fail(t('commit.busy', { path: busy })); throw e; }
    const lock = indexLock = await open(indexPath + '.lock', 'wx', 0o600);
    const original = await optional(indexPath);
    if (hash(original ?? Buffer.alloc(0)) !== indexHash || (await staged()).length) fail(t('commit.indexChanged'));
    const before = await hashes([...started.keys()]);
    for (const [path, value] of started) if (before.get(path) !== value) fail(t('commit.fileChangedRunning', { path }));
    await writeFile(join(busy, 'recovery.json'), JSON.stringify({ before: base, originalIndex: original?.toString('base64') ?? null, temporary, paths: selected, message,
      history: next === undefined ? undefined : previous ?? null }));
    if (next !== undefined) {
      if ((await optional(historyFile))?.toString('utf8') !== previous) fail(t('commit.fileChangedRunning', { path: HISTORY_PATH }));
      await publish(next); wrote = true;
    }
    const locked = await hashes([...new Set([...selected, ...contextPaths])]);
    if (original) await writeFile(temporary, original, { flag: 'wx' }); else await git(['read-tree', '--empty'], temporary);
    await git(['add', '--', ...stageable], temporary);
    const actual = await staged(temporary);
    if (!actual.length || actual.some(p => !selected.includes(p))) fail(t('commit.unexpectedFiles'));
    const records = selected.filter(p => record(p) && locked.get(p) !== null);
    if (records.length) {
      // One batch reads the staged document and reason bytes to reject Git filters that change them.
      const output = await git(['cat-file', '--batch'], temporary, Buffer.from(records.map(p => ':' + p).join('\n') + '\n')); let offset = 0;
      for (const path of records) {
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
    // The reason file goes back to what it was, unless someone else has changed it since it was written.
    if (wrote) {
      try {
        if ((await optional(historyFile))?.toString('utf8') !== next) keep = true;
        else if (previous === undefined) await unlink(historyFile); else await publish(previous);
      } catch { keep = true; }
    }
    if (keep) throw new CommandError('COMMIT_RECOVERY', t('commit.recoveryKept', { path: busy }));
    throw error;
  } finally {
    await indexLock?.close().catch(() => {});
    if (!uncertain) {
      if (indexLock) await unlink(indexPath + '.lock').catch(() => {});
      await unlink(temporary).catch(() => {});
      if (owned && !keep) { await unlink(join(busy, 'recovery.json')).catch(() => {}); await rmdir(busy); }
    }
  }
  return { outcome: 'committed' as const, committed: true, ...summary, commit: committed!.commit, paths: committed!.paths, pushed: false };
}
