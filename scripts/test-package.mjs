import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const packageManager = process.env.npm_execpath;
assert.ok(packageManager, 'Run this check through pnpm test or pnpm test:built.');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'gitifact-package-'));
const pnpm = (args, cwd) => execFileSync(process.execPath, [packageManager, ...args], {
  cwd, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
});

try {
  pnpm(['--filter', 'gitifact', 'pack', '--pack-destination', temporaryRoot], workspace);
  const archives = (await readdir(temporaryRoot)).filter((name) => name.endsWith('.tgz'));
  assert.equal(archives.length, 1);
  await writeFile(join(temporaryRoot, 'package.json'), JSON.stringify({ private: true }));
  pnpm(['--dir', temporaryRoot, 'add', join(temporaryRoot, archives[0]), '--offline', '--ignore-scripts'], temporaryRoot);
  const installedPackage = join(temporaryRoot, 'node_modules', 'gitifact', 'package.json');
  const { name, version, dependencies = {} } = JSON.parse(await readFile(installedPackage, 'utf8'));
  assert.equal(name, 'gitifact');
  const installedRoot = join(temporaryRoot, 'node_modules', 'gitifact');
  assert.match(await readFile(join(installedRoot, 'LICENSE'), 'utf8'), /MIT License/);
  assert.match(await readFile(join(installedRoot, 'README.md'), 'utf8'), /npm install -g gitifact/);
  assert.match(await readFile(join(installedRoot, 'dist/THIRD_PARTY_NOTICES.txt'), 'utf8'), /Meta Platforms/);
  assert.deepEqual(dependencies, {}, 'The initial bundled CLI must be self-contained.');
  assert.equal(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', '--version'], temporaryRoot).trim(), version);
  assert.match(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', '--help'], temporaryRoot), /Usage: gitifact/);
  execFileSync('git', ['init', '--template=', '-b', 'main'], { cwd: temporaryRoot, stdio: 'pipe' });
  const status = JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'status'], temporaryRoot));
  assert.equal(status.contract, 'repository-status');
  assert.equal(status.version, 1);
  assert.equal(status.ok, true);
  assert.deepEqual(status.head, { state: 'unborn', branch: 'main', commit: null });
  assert.deepEqual(status.checks, { state: 'not-run', reason: 'git-status-only' });
  const initialized = JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'init'], temporaryRoot));
  assert.equal(initialized.outcome, 'created');
  assert.equal(initialized.schemaVersion, 1);
  assert.deepEqual(initialized.baseline, { kind: 'empty' });
  const configBefore = await readFile(join(temporaryRoot, '.gitifact', 'config.json'));
  assert.equal(JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'init'], temporaryRoot)).outcome, 'already-initialized');
  assert.deepEqual(await readFile(join(temporaryRoot, '.gitifact', 'config.json')), configBefore);
  for (const [key, value] of [['user.name', 'Package fixture'], ['user.email', 'package@example.invalid'], ['commit.gpgsign', 'false']]) {
    execFileSync('git', ['config', key, value], { cwd: temporaryRoot, stdio: 'pipe' });
  }
  const specInput = join(temporaryRoot, 'spec-input.json');
  const spec = async (args, input) => {
    if (input) await writeFile(specInput, JSON.stringify(input));
    return JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'spec', ...args, ...(input ? ['--file', specInput] : [])], temporaryRoot));
  };
  const saved = await spec(['save'], { expected: (await spec(['working'])).stamp, operations: [
    { type: 'create', feature: 'package', title: '패키지 기능' },
    { type: 'add', feature: 'package', title: '설치 확인', body: '설치한 CLI로 명세와 코드를 커밋합니다.' }] });
  await writeFile(join(temporaryRoot, 'feature.txt'), 'packaged feature\n');
  const committed = await spec(['commit'], { reasons: [{ requirements: [saved.results[1].id], reason: '패키지 검증' }],
    paths: ['.gitifact/config.json', '.gitifact/spec/package/requirements.md', '.gitifact/spec/package/history.jsonl', 'feature.txt'],
    message: 'Package fixture commit', authorization: { basis: 'user-request', evidence: 'Package verification fixture' } });
  assert.equal(committed.outcome, 'committed');
  assert.equal((await spec(['read'])).specs[0].requirements[0].id, saved.results[1].id);
  const skillSource = join(temporaryRoot, '.agents/skills/gitifact-workflow/SKILL.md');
  const skillCopy = join(temporaryRoot, '.claude/skills/gitifact-workflow/SKILL.md');
  const installSkills = JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'skills', 'install', '--agent', 'claude'], temporaryRoot));
  assert.equal(installSkills.outcome, 'installed');
  const sourceBytes = await readFile(skillSource, 'utf8');
  assert.match(sourceBytes, /name: gitifact-workflow/);
  assert.equal(sourceBytes, await readFile(join(workspace, '.agents/skills/gitifact-workflow/SKILL.md'), 'utf8'), 'Installed skill must match the current source.');
  assert.equal(await readFile(skillCopy, 'utf8'), sourceBytes);
  await writeFile(skillSource, sourceBytes + '\nProject customization\n');
  pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'skills', 'sync'], temporaryRoot);
  assert.equal(await readFile(skillCopy, 'utf8'), sourceBytes + '\nProject customization\n');
  pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'skills', 'remove'], temporaryRoot);
  await assert.rejects(readFile(skillCopy), { code: 'ENOENT' });
  assert.equal(await readFile(skillSource, 'utf8'), sourceBytes + '\nProject customization\n');
  const child = spawn(process.execPath, [join(installedRoot, 'dist', 'main.js'), 'browser'], {
    cwd: temporaryRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  const exited = once(child, 'exit');
  try {
    const url = await new Promise((resolve, reject) => {
      let output = ''; let diagnostics = '';
      const timer = setTimeout(() => reject(new Error('Browser startup timeout: ' + diagnostics)), 15000);
      child.stdout.on('data', chunk => {
        output += chunk.toString();
        if (output.includes('\n')) { clearTimeout(timer); resolve(output.trim()); }
      });
      child.stderr.on('data', chunk => { diagnostics += chunk.toString(); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Browser exited: ' + diagnostics)); });
    });
    const html = await (await fetch(url)).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
    assert.ok(assets.some(path => path.endsWith('.js')));
    assert.ok(assets.some(path => path.endsWith('.css')));
    for (const path of assets) {
      const response = await fetch(new URL(path, url));
      assert.equal(response.status, 200);
      assert.ok((await response.text()).length > 0);
    }
    assert.equal((await fetch(new URL('/about', url), { headers: { Accept: 'text/html' } })).status, 200);
    const session = await (await fetch(new URL('/api/v1/session', url))).json();
    const headers = { 'X-Gitifact-Session': session.sessionId, Origin: new URL(url).origin };
    assert.equal((await fetch(new URL('/api/v1/status', url), { headers })).status, 200);
    await writeFile(join(temporaryRoot, 'browser-created.txt'), 'refresh fixture');
    const response = await fetch(new URL('/api/v1/status/refresh', url), { method: 'POST', headers });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).changes.some(change => change.path === 'browser-created.txt'));
  } finally { child.kill(); await exited; }
  console.log('PASS: packed CLI installs offline; init, spec save/commit/read, skills, status and browser run outside the workspace.');
} finally {
  // Only removes the exact directory returned by mkdtemp for this check.
  await rm(temporaryRoot, { recursive: true, force: true });
}
