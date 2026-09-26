import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { InitError, RepositoryReadError, formatManagedConfig, needsMigration, parseManagedConfig } from '@gitifact/core';
import { updateV6, type UpdateV6 } from '@gitifact/contracts';
import { initRepository } from '../adapters/git/init-repository.js';
import { agentDocsGit } from '../adapters/git/agent-docs-commit.js';
import { publishConfig, readConfigFile } from '../adapters/filesystem/config-file.js';
import { managedRead } from '../adapters/filesystem/managed-file.js';
import { fetchLatestVersion } from '../adapters/registry/latest-version.js';
import { recordUpdateCheck } from '../adapters/filesystem/user-cache.js';
import { type FetchLatestVersion, disabledUpdate, isNewerRelease, npmGlobalInstall, resolveUpdate, updateCheckDisabled } from '../shared/update-check.js';
import { applyAgentDocs, planAgentDocs } from './agent-docs.js';
import { AGENT_START, findBlock, type AgentBlockControls } from './agent-block.js';
import { settleConfig } from './project-settings.js';
import { t } from '../shared/i18n/index.js';

export interface UpdateControls extends AgentBlockControls { fetchLatest?: FetchLatestVersion; timeoutMs?: number; commit?: boolean; now?: () => number }
type AgentDocsState = { state: 'refreshed' | 'current' | 'kept' | 'not-initialized' | 'no-block'; paths: string[]; missing: string[]; root?: string; candidates?: string[] };
type ProjectState = { state: 'written' | 'current' | 'not-initialized'; cli: string | null };
type Commit = Extract<UpdateV6, { ok: true }>['commit'];

const CONFIG_PATH = '.gitifact/config.json';
// The message is fixed so every contributor's update reads the same in history; it carries no Gitifact trailer.
export const updateCommitMessage = (version: string) => 'chore(gitifact): update project to gitifact v' + version;
const commitState = (state: Commit['state'], extra: Partial<Commit> = {}): Commit =>
  ({ state, commit: null, paths: [], message: null, reason: null, detail: null, ...extra });
const notInitialized = { docs: { state: 'not-initialized', paths: [], missing: [] } as AgentDocsState, project: { state: 'not-initialized', cli: null } as ProjectState };

// Rewrites only blocks that already exist, reports files init would add, and settles the config on this release and the
// block language. Outside an initialized project the command still reports versions.
async function refreshProject(cwd: string, version: string, env: NodeJS.ProcessEnv, controls: AgentBlockControls): Promise<{ docs: AgentDocsState; project: ProjectState }> {
  const repo = initRepository(cwd, env);
  let first: Awaited<ReturnType<typeof repo.inspect>>;
  let config: string | undefined;
  try { first = await repo.inspect(); config = await readConfigFile(first.state.repository.rootPath); }
  catch (error) {
    if (error instanceof RepositoryReadError && error.code === 'NOT_A_REPOSITORY') return notInitialized;
    throw error;
  }
  if (config === undefined) return notInitialized;
  const root = first.state.repository.rootPath;
  // A 0.7 project keeps its config as it is; the result points at the migration instead.
  const parsed = needsMigration(config) ? undefined : parseManagedConfig(config);
  const plan = await planAgentDocs(root, { version, onlyExisting: true, language: parsed?.language, ...controls });
  const { missing } = plan;
  // A project already on a newer release keeps its blocks and config: this CLI's text is the older one.
  if (parsed?.cli && isNewerRelease(parsed.cli, version)) return { docs: { state: 'kept', paths: plan.paths, missing, root }, project: { state: 'current', cli: parsed.cli } };
  let current = config;
  const unchanged = async () => {
    if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== current) throw new InitError('INPUT_CHANGED', t('init.inputChanged'));
  };
  const docs: AgentDocsState = plan.paths.length === 0 ? { state: 'no-block', paths: [], missing, root }
    : plan.writes.length === 0 ? { state: 'current', paths: plan.paths, missing, root, candidates: plan.paths }
    : { state: 'refreshed', paths: await applyAgentDocs(root, plan, unchanged), missing, root, candidates: plan.paths };
  if (!parsed) return { docs, project: { state: 'current', cli: null } };
  const settled = settleConfig(parsed, version, plan.language);
  if (settled.changed) {
    const next = formatManagedConfig(settled.config, config);
    await publishConfig(root, next, unchanged, undefined, true);
    current = next;
  }
  return { docs: { ...docs, root }, project: { state: settled.changed ? 'written' : 'current', cli: settled.config.cli ?? null } };
}

// Text outside the block, with line endings normalized so a CRLF checkout of an LF blob is not a change.
function outsideBlock(text: string) {
  const normalized = text.replace(/\r\n/g, '\n');
  try {
    const found = findBlock(normalized);
    return found ? normalized.slice(0, found.start) + AGENT_START + normalized.slice(found.end) : null;
  } catch { return null; }
}
// The config without the two fields update writes, or null when it is not JSON.
function withoutSettings(text: string) {
  try { const { cli: _c, language: _l, ...rest } = JSON.parse(text) as Record<string, unknown>; return rest; } catch { return null; }
}

// Commits block files that differ from HEAD only between the markers, and the config when only `cli` and `language`
// differ. Both are already current when this runs, so the commit carries exactly the update. Any file with other edits,
// or not tracked, stops the whole commit. Wrapper files an earlier run expanded are cleaned by the refresh but left out
// here: their diff is a removal, not a block-only change.
async function commitUpdate(docs: AgentDocsState, version: string, env: NodeJS.ProcessEnv): Promise<Commit> {
  if (!docs.root) return commitState('nothing');
  const git = agentDocsGit(docs.root, env);
  const head = await git.head();
  const changed: string[] = [];
  for (const path of docs.candidates ?? []) {
    const working = await managedRead(docs.root, path);
    const committed = head ? await git.committed(head, path) : null;
    if (working === null) continue;
    if (committed === null) return commitState('skipped', { paths: [path], reason: 'untracked' });
    if (committed.replace(/\r\n/g, '\n') === working.replace(/\r\n/g, '\n')) continue;
    const before = outsideBlock(committed);
    if (before === null || before !== outsideBlock(working)) return commitState('skipped', { paths: [path], reason: 'other-changes' });
    changed.push(path);
  }
  const workingConfig = await readFile(join(docs.root, CONFIG_PATH), 'utf8').catch(() => null);
  const committedConfig = head ? await git.committed(head, CONFIG_PATH) : null;
  if (workingConfig !== null && committedConfig?.replace(/\r\n/g, '\n') !== workingConfig.replace(/\r\n/g, '\n')) {
    if (committedConfig === null) return commitState('skipped', { paths: [CONFIG_PATH], reason: 'untracked' });
    const before = withoutSettings(committedConfig);
    if (before === null || !isDeepStrictEqual(before, withoutSettings(workingConfig))) return commitState('skipped', { paths: [CONFIG_PATH], reason: 'other-changes' });
    changed.push(CONFIG_PATH);
  }
  if (changed.length === 0) return commitState('nothing');
  const message = updateCommitMessage(version);
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
  const [update, refreshed] = await Promise.all([
    updateCheckDisabled(env) ? disabledUpdate : resolveUpdate(version, controls.fetchLatest ?? fetchLatestVersion, undefined, controls.timeoutMs),
    refreshProject(cwd, version, env, controls),
  ]);
  // The check just ran, so the notice every command shows reuses it instead of asking the registry again.
  await recordUpdateCheck(env, update, controls.now?.());
  const { docs, project } = refreshed;
  const commit = controls.commit ? await commitUpdate(docs, version, env) : commitState('not-requested');
  const config = await readConfigFile(docs.root ?? cwd).catch(() => undefined);
  return updateV6.parse({ contract: 'update', version: 6, ok: true, cliVersion: version, update,
    install: update.status === 'available' ? { npmGlobal: npmGlobalInstall(update.latestVersion!) } : null,
    agentDocs: { state: docs.state, paths: docs.paths, missing: docs.missing }, project, commit,
    migrationRequired: config !== undefined && needsMigration(config) });
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
      : dto.agentDocs.state === 'kept' ? t('update.text.blockKept', { paths: dto.agentDocs.paths.join(', ') || '-' })
      : dto.agentDocs.state === 'no-block' ? t('update.text.noBlock') : t('update.text.notInitialized'));
    if (dto.agentDocs.missing.length) lines.push(t('update.text.missing', { paths: dto.agentDocs.missing.join(', ') }));
    if (dto.project.state === 'written') lines.push(t('update.text.projectWritten', { path: CONFIG_PATH, version: dto.project.cli ?? dto.cliVersion }));
    if (dto.project.cli && isNewerRelease(dto.project.cli, dto.cliVersion)) lines.push(t('update.text.projectAhead', { project: dto.project.cli, version: dto.cliVersion, command: npmGlobalInstall(dto.project.cli) }));
    if (dto.migrationRequired) lines.push(t('update.text.migrationRequired', { version: dto.cliVersion }));
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
      : JSON.stringify(updateV6.parse({ contract: 'update', version: 6, ok: false, error: failure })) + '\n');
    process.exitCode = 1;
  }
}
