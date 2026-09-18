import { InitError, RepositoryReadError } from '@gitifact/core';
import { updateV3, type UpdateV3 } from '@gitifact/contracts';
import { initRepository } from '../adapters/git/init-repository.js';
import { agentDocsGit } from '../adapters/git/agent-docs-commit.js';
import { readConfigFile } from '../adapters/filesystem/config-file.js';
import { managedRead } from '../adapters/filesystem/managed-file.js';
import { fetchLatestVersion, type FetchLatestVersion } from '../adapters/registry/latest-version.js';
import { disabledUpdate, npmGlobalInstall, resolveUpdate, updateCheckDisabled } from '../shared/update-check.js';
import { applyAgentDocs, planAgentDocs } from './agent-docs.js';
import { AGENT_START, findBlock, type AgentBlockControls } from './agent-block.js';
import { t } from '../shared/i18n/index.js';

export interface UpdateControls extends AgentBlockControls { fetchLatest?: FetchLatestVersion; timeoutMs?: number; commit?: boolean }
type AgentDocsState = { state: 'refreshed' | 'current' | 'not-initialized' | 'no-block'; paths: string[]; missing: string[]; root?: string; candidates?: string[] };
type Commit = Extract<UpdateV3, { ok: true }>['commit'];

// The message is fixed so every contributor's refresh reads the same in history; it carries no Gitifact trailer.
export const blockCommitMessage = (version: string) => 'chore(gitifact): refresh GITIFACT block to v' + version;
const commitState = (state: Commit['state'], extra: Partial<Commit> = {}): Commit =>
  ({ state, commit: null, paths: [], message: null, reason: null, detail: null, ...extra });

// Rewrites only blocks that already exist and reports files init would add. Outside an initialized project the command still reports versions.
async function refreshBlocks(cwd: string, version: string, env: NodeJS.ProcessEnv, controls: AgentBlockControls): Promise<AgentDocsState> {
  const repo = initRepository(cwd, env);
  let first: Awaited<ReturnType<typeof repo.inspect>>;
  let config: string | undefined;
  try { first = await repo.inspect(); config = await readConfigFile(first.state.repository.rootPath); }
  catch (error) {
    if ((error instanceof RepositoryReadError && error.code === 'NOT_A_REPOSITORY') || (error instanceof InitError && error.code === 'MIGRATION_REQUIRED')) return { state: 'not-initialized', paths: [], missing: [] };
    throw error;
  }
  if (config === undefined) return { state: 'not-initialized', paths: [], missing: [] };
  const root = first.state.repository.rootPath;
  const plan = await planAgentDocs(root, { version, onlyExisting: true, ...controls });
  const { missing } = plan;
  if (plan.paths.length === 0) return { state: 'no-block', paths: [], missing, root };
  if (plan.writes.length === 0) return { state: 'current', paths: plan.paths, missing, root, candidates: plan.paths };
  const unchanged = async () => {
    if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== config) throw new InitError('INPUT_CHANGED', t('init.inputChanged'));
  };
  const applied = await applyAgentDocs(root, plan, unchanged);
  return { state: 'refreshed', paths: applied, missing, root, candidates: plan.paths };
}

// Text outside the block, with line endings normalized so a CRLF checkout of an LF blob is not a change.
function outsideBlock(text: string) {
  const normalized = text.replace(/\r\n/g, '\n');
  try {
    const found = findBlock(normalized);
    return found ? normalized.slice(0, found.start) + AGENT_START + normalized.slice(found.end) : null;
  } catch { return null; }
}

// Commits block files that differ from HEAD only between the markers. Blocks are already current when this runs, so
// the commit carries exactly the refresh. Any file with other edits, or not tracked, stops the whole commit. Wrapper files an
// earlier run expanded are cleaned by the refresh but left out here: their diff is a removal, not a block-only change.
async function commitBlocks(docs: AgentDocsState, version: string, env: NodeJS.ProcessEnv): Promise<Commit> {
  if (!docs.root || !docs.candidates?.length) return commitState('nothing');
  const git = agentDocsGit(docs.root, env);
  const head = await git.head();
  const changed: string[] = [];
  for (const path of docs.candidates) {
    const working = await managedRead(docs.root, path);
    const committed = head ? await git.committed(head, path) : null;
    if (working === null) continue;
    if (committed === null) return commitState('skipped', { paths: [path], reason: 'untracked' });
    if (committed.replace(/\r\n/g, '\n') === working.replace(/\r\n/g, '\n')) continue;
    const before = outsideBlock(committed);
    if (before === null || before !== outsideBlock(working)) return commitState('skipped', { paths: [path], reason: 'other-changes' });
    changed.push(path);
  }
  if (changed.length === 0) return commitState('nothing');
  const message = blockCommitMessage(version);
  let failure: unknown;
  try { await git.commitOnly(changed, message); } catch (error) { failure = error; }
  const after = await git.head();
  // A rejected commit (hook, identity, signing) leaves HEAD where it was and the refreshed files in place.
  if (!after || after === head) return commitState('skipped', { paths: changed, reason: 'commit-failed', detail: failure instanceof Error ? failure.message : null });
  const parents = await git.parents(after);
  if (parents.length !== 1 || parents[0] !== head) throw new InitError('COMMIT_RESULT_UNKNOWN', t('update.commitResultUnknown', { commit: after }));
  return commitState('committed', { commit: after, paths: await git.changedPaths(after), message });
}

export async function updateCommand(cwd: string, version: string, env: NodeJS.ProcessEnv = process.env, controls: UpdateControls = {}) {
  const [update, agentDocs] = await Promise.all([
    updateCheckDisabled(env) ? disabledUpdate : resolveUpdate(version, controls.fetchLatest ?? fetchLatestVersion, undefined, controls.timeoutMs),
    refreshBlocks(cwd, version, env, controls),
  ]);
  const commit = controls.commit ? await commitBlocks(agentDocs, version, env) : commitState('not-requested');
  return updateV3.parse({ contract: 'update', version: 3, ok: true, cliVersion: version, update,
    install: update.status === 'available' ? { npmGlobal: npmGlobalInstall(update.latestVersion!) } : null,
    agentDocs: { state: agentDocs.state, paths: agentDocs.paths, missing: agentDocs.missing }, commit });
}
export async function runUpdate(options: { format?: 'json' | 'text'; commit?: boolean }, version: string) {
  try {
    const dto = await updateCommand(process.cwd(), version, process.env, { commit: !!options.commit });
    if (!dto.ok) throw new Error('unreachable');
    if (options.format !== 'text') { process.stdout.write(JSON.stringify(dto) + '\n'); return; }
    const lines = [t('update.text.current', { version: dto.cliVersion })];
    lines.push(dto.update.status === 'available' ? t('update.text.available', { version: dto.update.latestVersion })
      : dto.update.status === 'up-to-date' ? t('update.text.upToDate')
      : dto.update.status === 'disabled' ? t('update.text.disabled') : t('update.text.unavailable'));
    if (dto.install) lines.push(t('update.text.install', { command: dto.install.npmGlobal }), t('update.text.afterInstall'));
    lines.push(dto.agentDocs.state === 'refreshed' ? t('update.text.blockRefreshed', { paths: dto.agentDocs.paths.join(', ') })
      : dto.agentDocs.state === 'current' ? t('update.text.blockCurrent', { paths: dto.agentDocs.paths.join(', ') })
      : dto.agentDocs.state === 'no-block' ? t('update.text.noBlock') : t('update.text.notInitialized'));
    if (dto.agentDocs.missing.length) lines.push(t('update.text.missing', { paths: dto.agentDocs.missing.join(', ') }));
    const { commit } = dto;
    if (commit.state === 'committed') lines.push(t('update.text.committed', { commit: commit.commit!.slice(0, 12), paths: commit.paths.join(', ') }));
    else if (commit.state === 'nothing') lines.push(t('update.text.commitNothing'));
    else if (commit.state === 'skipped') {
      const paths = commit.paths.join(', ');
      const text = commit.reason === 'untracked' ? t('update.text.commitSkipped.untracked', { paths })
        : commit.reason === 'other-changes' ? t('update.text.commitSkipped.other-changes', { paths }) : t('update.text.commitSkipped.commit-failed', { paths });
      lines.push(text + (commit.detail ? ' (' + commit.detail + ')' : ''));
    }
    process.stdout.write(lines.join('\n') + '\n');
  } catch (error) {
    const known = error instanceof InitError || error instanceof RepositoryReadError;
    const failure = { code: known ? error.code : 'UPDATE_FAILED', message: known ? error.message : t('update.failed') };
    process.stderr.write(options.format === 'text' ? failure.code + ': ' + failure.message + '\n'
      : JSON.stringify(updateV3.parse({ contract: 'update', version: 3, ok: false, error: failure })) + '\n');
    process.exitCode = 1;
  }
}
