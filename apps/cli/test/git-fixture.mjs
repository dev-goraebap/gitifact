import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, readlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryStatusSuccessV1, repositoryStatusFailureV1 } from '@gitifact/contracts';

const probe = fileURLToPath(new URL('./status-probe.mjs', import.meta.url));
const executable = fileURLToPath(new URL('../dist/main.js', import.meta.url));
export function fixture(t, format = 'sha1') {
  const base = realpathSync(tmpdir());
  const root = mkdtempSync(join(base, 'gitifact-status-'));
  t.after(() => {
    assert.equal(dirname(realpathSync(root)), base);
    rmSync(root, { recursive: true, force: true });
  });
  const repo = join(root, 'repo');
  mkdirSync(repo);
  // CLI temporary folders (commit inputs) stay inside the fixture instead of the user's system folder.
  const temp = join(root, 'tmp');
  mkdirSync(temp);
  const config = join(root, 'empty-config');
  writeFileSync(config, '');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_SYSTEM: config,
    GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', TEMP: temp, TMP: temp, TMPDIR: temp,
    GIT_AUTHOR_DATE: '2026-09-13T00:00:00Z', GIT_COMMITTER_DATE: '2026-09-13T00:00:00Z' };
  for (const key of Object.keys(env)) {
    if (/^GIT_(DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|CONFIG_COUNT|CONFIG_PARAMETERS|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/i.test(key)) delete env[key];
  }
  const git = (args, cwd = repo, allowFailure = false) => {
    const result = spawnSync('git', ['-c', 'user.name=Tryce fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd, env, encoding: 'utf8', timeout: 10000 });
    assert.ifError(result.error);
    if (!allowFailure) assert.equal(result.status, 0, result.stderr);
    return result;
  };
  git(['init', '--template=', '-b', 'main', '--object-format=' + format]);
  const write = (path, content, cwd = repo) => writeFileSync(join(cwd, path), content);
  const commit = (message = 'fixture', cwd = repo) => {
    git(['add', '-A'], cwd); git(['commit', '-m', message], cwd);
  };
  // The repository status the browser serves, read in a separate process with this fixture's environment.
  const cli = (args = [], cwd = repo, extraEnv = {}) => {
    const result = spawnSync(process.execPath, [probe, ...args], {
      cwd, env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 35000,
    });
    assert.ifError(result.error);
    return result;
  };
  const status = (cwd = repo) => {
    const result = cli([], cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    return repositoryStatusSuccessV1.parse(JSON.parse(result.stdout));
  };
  const failure = (cwd, code, extraEnv = {}) => {
    const result = cli([], cwd, extraEnv);
    assert.equal(result.status, 1); assert.equal(result.stdout, '');
    const dto = repositoryStatusFailureV1.parse(JSON.parse(result.stderr));
    assert.equal(dto.error.code, code);
    return dto;
  };
  return { root, repo, env, git, write, commit, cli, status, failure };
}
// Adopts schemaVersion 3 without a baseline commit, as `gitifact init` does in an unborn repository.
export function specFixture(t, format = 'sha1') {
  const f = fixture(t, format);
  mkdirSync(join(f.repo, '.gitifact'));
  writeFileSync(join(f.repo, '.gitifact', 'config.json'), JSON.stringify({ schemaVersion: 3, baseline: { kind: 'empty' } }, null, 2) + '\n');
  return f;
}
/**
 * An initialized project with one commit and a committer, driven through the built CLI: `run` returns the process
 * result, `ok` the parsed JSON of a successful `--format json` call.
 */
export function projectFixture(t, format = 'sha1') {
  const f = fixture(t, format);
  for (const [key, value] of [['user.name', 'Fixture'], ['user.email', 'fixture@example.invalid'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) f.git(['config', key, value]);
  mkdirSync(join(f.repo, '.git', 'hooks'), { recursive: true });
  const run = (args, { env = {}, input, cwd = f.repo } = {}) => {
    const result = spawnSync(process.execPath, [executable, ...args], { cwd, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1', GITIFACT_LANG: 'ko', ...env }, encoding: 'utf8', timeout: 45000, input });
    assert.ifError(result.error); return result;
  };
  const ok = (args, options) => { const result = run([...args, '--format', 'json'], options); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); };
  const init = run(['init', '--skip-agents']); assert.equal(init.status, 0, init.stderr);
  f.commit('Initialize gitifact');
  return { ...f, run, ok };
}
export function fingerprint(root) {
  const result = {};
  function visit(directory, prefix = '') {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      const name = prefix + entry;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) result[name] = 'symlink:' + readlinkSync(path);
      else if (stat.isDirectory()) { result[name + '/'] = 'directory'; visit(path, name + '/'); }
      else result[name] = createHash('sha256').update(readFileSync(path)).digest('hex');
    }
  }
  visit(root);
  return result;
}
