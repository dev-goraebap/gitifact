import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { InitError, parseManagedConfig } from '@tryce/core';
import { skillsV1 } from '@tryce/contracts';
import { initRepository } from '../adapters/git/init-repository.js';
import { readConfigFile } from '../adapters/filesystem/config-file.js';
import { skillLock, skillRead, skillWrite } from '../adapters/filesystem/skill-files.js';

const source = '.agents/skills/tryce-workflow/SKILL.md';
const target = '.claude/skills/tryce-workflow/SKILL.md';
const manifest = '.agents/tryce-skills.local.json';
const lock = '.agents/tryce-skills.local.lock';
const ignores = ['/' + manifest, '/' + lock, '/' + target, '/.claude/skills/tryce-workflow/.tryce-skill-*.tmp', '/.agents/skills/tryce-workflow/.tryce-skill-*.tmp', '/.agents/.tryce-skill-*.tmp'];
type Agent = 'codex' | 'claude';
type Action = 'install' | 'sync' | 'remove';
interface State { version: 1; source: typeof source; target: typeof target; agent: Agent | null; accepted: (string | null)[] }
interface Options { agent?: Agent; dryRun?: boolean; format?: 'json' | 'text' }
interface Controls { template?: string; afterJournal?: () => Promise<void> }
const digest = (text: string | null) => text === null ? null : createHash('sha256').update(text).digest('hex');
function parseState(text: string | null): State | null {
  if (text === null) return null;
  let value: State;
  try { value = JSON.parse(text) as State; } catch { throw new InitError('INVALID_SKILL_MANIFEST', '로컬 스킬 매니페스트가 손상됐습니다.'); }
  if (!value || Object.keys(value).sort().join() !== 'accepted,agent,source,target,version' || value.version !== 1 || value.source !== source || value.target !== target
    || ![null, 'codex', 'claude'].includes(value.agent) || !Array.isArray(value.accepted) || value.accepted.length < 1 || value.accepted.length > 2
    || value.accepted.some(item => item !== null && (typeof item !== 'string' || !/^[a-f0-9]{64}$/.test(item)))) {
    throw new InitError('UNSUPPORTED_SKILL_MANIFEST', '지원하지 않는 로컬 스킬 매니페스트입니다.');
  }
  return value;
}
export async function skillsCommand(cwd: string, action: Action, options: Options = {}, env = process.env, controls: Controls = {}) {
  const repo = initRepository(cwd, env);
  const first = await repo.inspect();
  const root = first.state.repository.rootPath;
  const configText = await readConfigFile(root);
  if (configText === undefined) throw new InitError('NOT_INITIALIZED', '먼저 프로젝트를 초기화하세요.');
  const config = parseManagedConfig(configText);
  await repo.validateBaseline(config, root, first.state.head.commit, first.state.repository.objectFormat);
  const recheck = async () => {
    if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== configText) throw new InitError('INPUT_CHANGED', 'Git 또는 프로젝트 설정이 변경됐습니다.');
  };
  const execute = async () => {
    const original = await skillRead(root, source);
    const saved = await skillRead(root, manifest);
    const state = parseState(saved);
    const copy = await skillRead(root, target);
    if (copy !== null && !state) throw new InitError('UNMANAGED_SKILL', '기존 Claude 복사본은 관리 대상이 아닙니다. 보존하고 출처를 확인하세요.');
    if (state && !state.accepted.includes(digest(copy))) throw new InitError('SKILL_MODIFIED', 'Claude 복사본이 수정되거나 삭제됐습니다. 원본과 비교하고 보존하세요.');
    const tracked = await repo.trackedPaths(root, '.agents/', first.state.head.commit);
    const localTracked = await repo.trackedPaths(root, '.claude/skills/tryce-workflow/', first.state.head.commit);
    if (tracked.includes(manifest) || tracked.includes(lock) || localTracked.length) throw new InitError('LOCAL_SKILL_TRACKED', '로컬 스킬 파일이 Git에서 추적 중입니다. 먼저 보관 방침을 확인하세요.');
    if (original === null && tracked.includes(source)) throw new InitError('SKILL_DELETED', 'Git에 있는 스킬 원본이 삭제됐습니다. 복구 후 실행하세요.');
    const agent = action === 'remove' ? null : options.agent ?? state?.agent;
    if (action !== 'remove' && !agent) throw new InitError('AGENT_REQUIRED', '--agent codex 또는 claude를 지정하세요.');
    if (action === 'sync' && original === null) throw new InitError('SKILL_NOT_INSTALLED', '스킬 원본을 먼저 설치하세요.');
    let wanted = original;
    if (action === 'install' && wanted === null) wanted = controls.template ?? await readFile(new URL('./skills/tryce-workflow/SKILL.md', import.meta.url), 'utf8');
    if (wanted !== null && (!wanted.startsWith('---') || !/^name: tryce-workflow\r?$/m.test(wanted) || Buffer.byteLength(wanted) > 65536)) throw new InitError('INVALID_SKILL', 'tryce-workflow 원본 형식을 확인하세요.');
    const nextCopy = agent === 'claude' ? wanted : null;
    const ignoreBefore = await skillRead(root, '.gitignore');
    const lines = (ignoreBefore ?? '').split(/\r?\n/);
    const missing = ignores.filter(line => !lines.includes(line));
    const ignoreAfter = (ignoreBefore ?? '') + (ignoreBefore && !ignoreBefore.endsWith('\n') ? '\n' : '') + missing.join('\n') + (missing.length ? '\n' : '');
    const result = (outcome: string) => skillsV1.parse({ contract: 'skills', version: 1, ok: true, outcome,
      rootPath: root, agent: agent ?? null, source, target: agent === 'claude' ? target : null,
      sourcePreserved: original !== null, sessionState: 'not-observed' });
    if (action === 'remove' && !state) { await recheck(); return result('not-installed'); }
    await repo.checkIgnore(root, source);
    if (options.dryRun) { await recheck(); return result('planned'); }
    if (missing.length) await skillWrite(root, '.gitignore', ignoreBefore, ignoreAfter, recheck);
    // Confirm local-only rules actually take effect, including nested negations.
    for (const path of [manifest, lock, target]) {
      let ignored = false;
      try { await repo.checkIgnore(root, path); } catch (error) { if (error instanceof InitError && error.code === 'CONFIG_IGNORED') ignored = true; else throw error; }
      if (!ignored) throw new InitError('LOCAL_SKILL_NOT_IGNORED', '로컬 경로가 ignore되지 않습니다: ' + path);
    }
    const stateText = (accepted: (string | null)[]) => JSON.stringify({ version: 1, source, target, agent: agent ?? null, accepted }, null, 2) + '\n';
    const journal = stateText([...new Set([digest(copy), digest(nextCopy)])]);
    const inputs = async () => {
      await recheck();
      if (await skillRead(root, source) !== original || await skillRead(root, target) !== copy) throw new InitError('INPUT_CHANGED', '스킬 입력이 변경됐습니다.');
    };
    await skillWrite(root, manifest, saved, journal, inputs);
    await controls.afterJournal?.();
    if (original === null && wanted !== null) await skillWrite(root, source, null, wanted, recheck);
    if (copy !== nextCopy) await skillWrite(root, target, copy, nextCopy, recheck);
    await skillWrite(root, manifest, journal, stateText([digest(nextCopy)]), recheck);
    await recheck();
    if (await skillRead(root, source) !== wanted || await skillRead(root, target) !== nextCopy) throw new InitError('INPUT_CHANGED', '게시 후 스킬이 변경됐습니다. 다시 조회하세요.');
    return result(action === 'remove' ? 'removed' : action === 'install' ? 'installed' : 'synced');
  };
  return options.dryRun ? execute() : skillLock(root, lock, execute);
}
export async function runSkills(action: Action, options: Options) {
  try {
    const result = await skillsCommand(process.cwd(), action, options);
    console.log(options.format === 'text' && result.ok
      ? `${result.outcome}: ${JSON.stringify(result.rootPath)}\n원본: ${result.source}\n로컬 복사본: ${result.target ?? '없음'}\n세션 로딩: 확인하지 않음` : JSON.stringify(result));
  } catch (error) {
    const failure = skillsV1.parse({ contract: 'skills', version: 1, ok: false, error: {
      code: error instanceof InitError ? error.code : 'SKILLS_FAILED', message: error instanceof Error ? error.message : '스킬 작업 실패' } });
    console.error(JSON.stringify(failure)); process.exitCode = 1;
  }
}
