import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChangelog } from '../packages/core/dist/index.js';

// Keep the original Korean fixtures deterministic; English is checked separately below.
process.env.GITIFACT_LANG = 'ko';
const workspace = fileURLToPath(new URL('../', import.meta.url));
const packageManager = process.env.npm_execpath;
assert.ok(packageManager, 'Run this check through pnpm test or pnpm test:built.');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'gitifact-package-'));
// init and update check npm for a newer release; this check never contacts the registry.
const noRegistry = { ...process.env, GITIFACT_NO_UPDATE_CHECK: '1' };
const pnpm = (args, cwd, env = process.env) => execFileSync(process.execPath, [packageManager, ...args], {
  cwd, env, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
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
  assert.match(await readFile(join(installedRoot, 'README.md'), 'utf8'), /npx gitifact@latest init/);
  assert.match(await readFile(join(installedRoot, 'dist/THIRD_PARTY_NOTICES.txt'), 'utf8'), /Meta Platforms/);
  assert.deepEqual(dependencies, {}, 'The initial bundled CLI must be self-contained.');
  // Publishing a version without its release notes is the mistake this guards against.
  // Output folders from earlier builds must not be packed alongside the current ones.
  for (const stale of ['dist/docs', 'dist/skills']) {
    await assert.rejects(readdir(join(installedRoot, stale)), { code: 'ENOENT' }, stale + ' must not be packed.');
  }
  const [latestNotes] = parseChangelog(await readFile(join(installedRoot, 'dist/i18n/ko/changelog.md'), 'utf8'));
  assert.equal(latestNotes.version, version, 'The shipped changelog must start with the package version.');
  // Version numbers live in package.json and the changelog; a copy in these pages goes stale at the next release.
  for (const page of ['README.md', 'apps/cli/README.md', 'packages/intro/ko/intro.md']) {
    assert.doesNotMatch(await readFile(join(workspace, page), 'utf8'), /gitifact@\d/, page + ' must not hardcode a gitifact version.');
  }
  assert.equal(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', '--version'], temporaryRoot).trim(), version);
  assert.match(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', '--help'], temporaryRoot), /Usage: gitifact/);
  execFileSync('git', ['init', '--template=', '-b', 'main'], { cwd: temporaryRoot, stdio: 'pipe' });
  // A fresh cache and offline mode ensure the pinned npx command uses this project's package, not a global or downloaded CLI.
  const npxEnv = { ...noRegistry, npm_config_cache: join(temporaryRoot, 'npm-cache') };
  const npx = (...args) => pnpm(['--dir', temporaryRoot, 'exec', 'npx', '--offline', '--yes', 'gitifact@' + version, ...args], temporaryRoot, npxEnv);
  const packageBefore = await readFile(join(temporaryRoot, 'package.json'));
  const lockBefore = await readFile(join(temporaryRoot, 'pnpm-lock.yaml'));
  const initialized = JSON.parse(npx('init'));
  assert.deepEqual(await readFile(join(temporaryRoot, 'package.json')), packageBefore);
  assert.deepEqual(await readFile(join(temporaryRoot, 'pnpm-lock.yaml')), lockBefore);
  assert.deepEqual(JSON.parse(npx('check', '--format', 'json')).problems, []);
  assert.equal(initialized.outcome, 'created');
  assert.equal(initialized.schemaVersion, 3);
  assert.deepEqual([initialized.version, initialized.update, initialized.install], [8, { status: 'disabled', latestVersion: null }, null]);
  assert.deepEqual(initialized.lineEndings, { path: '.gitifact/.gitattributes', created: true });
  assert.deepEqual(initialized.baseline, { kind: 'empty' });
  const configBefore = await readFile(join(temporaryRoot, '.gitifact', 'config.json'));
  assert.equal(JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'init'], temporaryRoot, noRegistry)).outcome, 'already-initialized');
  assert.deepEqual(await readFile(join(temporaryRoot, '.gitifact', 'config.json')), configBefore);
  for (const [key, value] of [['user.name', 'Package fixture'], ['user.email', 'package@example.invalid'], ['commit.gpgsign', 'false']]) {
    execFileSync('git', ['config', key, value], { cwd: temporaryRoot, stdio: 'pipe' });
  }
  // The commit input goes to the folder changes list reports; the system temporary folder is redirected into this check's root.
  const systemTemp = join(temporaryRoot, 'system-temp'); await mkdir(systemTemp);
  const specEnv = { ...process.env, TEMP: systemTemp, TMP: systemTemp, TMPDIR: systemTemp };
  const gitifact = args => JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', ...args, '--format', 'json'], temporaryRoot, specEnv));
  const { inputs } = gitifact(['changes', 'list']);
  assert.ok(inputs.commit.startsWith(systemTemp), 'The commit input must default to the system temporary folder.');
  const feature = gitifact(['specs', 'new', 'feature', 'package', '--title', '패키지 기능', '--description', '설치한 CLI로 쓰는 기능']);
  const requirement = gitifact(['specs', 'new', 'requirement', 'package/install', '--title', '설치 확인', '--description', '설치한 CLI로 명세와 코드를 커밋한다']);
  // A record of the choice made, written as a draft by the installed CLI.
  const record = gitifact(['records', 'new', '--title', '패키지 검증', '--docs', requirement.id]);
  // specs new and records new mark their files as drafts; the author fills them in and removes the mark.
  const recordFile = join(temporaryRoot, ...record.path.split('/'));
  await writeFile(recordFile, (await readFile(recordFile, 'utf8')).replace('(내용)', '설치본의 동작을 확인해야 한다.').replace('(내용)', '설치본으로 확인한다.'));
  for (const created of [feature, requirement, record]) {
    const file = join(temporaryRoot, ...created.path.split('/'));
    await writeFile(file, (await readFile(file, 'utf8')).replace('draft: true\n', ''));
  }
  await writeFile(join(temporaryRoot, 'feature.txt'), 'packaged feature\n');
  await writeFile(inputs.commit, JSON.stringify({
    paths: ['.gitifact/config.json', feature.path, requirement.path, record.path, 'feature.txt'],
    message: 'Package fixture commit', authorization: { basis: 'user-request', evidence: 'Package verification fixture' } }));
  const committed = gitifact(['changes', 'commit', '--file', inputs.commit]);
  assert.equal(committed.outcome, 'committed');
  assert.equal(committed.inputRemoved, true, 'A successful commit removes its input file.');
  assert.equal(gitifact(['specs', 'show', requirement.id, '--ref', 'HEAD']).documents[0].path, requirement.path);
  assert.deepEqual(gitifact(['records', 'list', '--doc', requirement.id]).events[0].records.map(r => [r.id, r.title, r.sections.map(s => s.body)]),
    [[record.id, '패키지 검증', ['설치본의 동작을 확인해야 한다.', '설치본으로 확인한다.']]]);
  assert.match(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'guide', 'list'], temporaryRoot), /^workflow /m);
  assert.equal(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'guide', 'show', 'spec'], temporaryRoot),
    await readFile(join(workspace, 'apps/cli/src/shared/i18n/ko/docs/spec.md'), 'utf8'), 'Bundled guides must match the asset source.');
  assert.equal(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', '--lang', 'en', 'guide', 'show', 'spec'], temporaryRoot),
    await readFile(join(workspace, 'apps/cli/src/shared/i18n/en/docs/spec.md'), 'utf8'), 'The offline package must include English guides.');
  const [englishNotes] = parseChangelog(await readFile(join(installedRoot, 'dist/i18n/en/changelog.md'), 'utf8'));
  assert.equal(englishNotes.version, version);
  // The instruction guide ships with the package; init writes no wiki.
  assert.equal(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'guide', 'show', 'instructions'], temporaryRoot),
    await readFile(join(workspace, 'apps/cli/src/shared/i18n/ko/docs/instructions.md'), 'utf8'), 'The instruction guide must match the asset source.');
  assert.equal(existsSync(join(temporaryRoot, '.gitifact', 'wiki')), false, 'init must not write a wiki.');
  const agentsPath = join(temporaryRoot, 'AGENTS.md');
  const agents = await readFile(agentsPath, 'utf8');
  assert.deepEqual(initialized.agentDocs, { mode: 'install', paths: ['AGENTS.md', 'CLAUDE.md'] });
  assert.equal(await readFile(join(temporaryRoot, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n', 'init must add a CLAUDE.md that imports AGENTS.md.');
  assert.match(agents, /^# AGENTS\.md\n\nProject-specific guidance for AI coding agents\.\n\n<!-- GITIFACT:START -->\n/);
  assert.ok(agents.includes('gitifact v' + version + ' · ko · 저장 규약 schemaVersion 3'), 'Block must carry the installed version.');
  assert.ok(agents.includes('npx --yes gitifact@' + version + ' <cmd>'), 'The generated invocation must pin the installed version.');
  assert.ok(agents.includes('gitifact guide show spec'), 'Block must point at the bundled guides.');
  assert.match(agents, /<!-- GITIFACT:END -->\n$/);
  await writeFile(agentsPath, agents + '\n## Project rules\n\nKeep me.\n');
  assert.equal(JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'init'], temporaryRoot, noRegistry)).outcome, 'already-initialized');
  assert.equal(await readFile(agentsPath, 'utf8'), agents + '\n## Project rules\n\nKeep me.\n');
  const removed = JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'gitifact', 'init', '--remove-agents'], temporaryRoot, noRegistry));
  assert.deepEqual(removed.agentDocs, { mode: 'remove', paths: ['AGENTS.md'] });
  assert.equal(await readFile(agentsPath, 'utf8'), '# AGENTS.md\n\nProject-specific guidance for AI coding agents.\n\n## Project rules\n\nKeep me.\n');
  // The package check never contacts the npm registry: the update check is switched off and reported as disabled.
  const offline = { ...process.env, GITIFACT_NO_UPDATE_CHECK: '1' };
  await writeFile(agentsPath, agents.replace('gitifact v' + version + ' ', 'gitifact v0.0.1 '));
  const beforeCheck = await readFile(agentsPath, 'utf8');
  const checked = JSON.parse(npx('update', '--check'));
  assert.deepEqual([checked.contract, checked.update.status, checked.command], ['update-check', 'disabled', null]);
  assert.equal(await readFile(agentsPath, 'utf8'), beforeCheck, 'Check-only must not refresh an old block.');
  const updated = JSON.parse(execFileSync(process.execPath, [join(installedRoot, 'dist', 'main.js'), 'update'], { cwd: temporaryRoot, env: offline, encoding: 'utf8', timeout: 60_000 }));
  assert.deepEqual([updated.contract, updated.cliVersion, updated.update, updated.install, updated.agentDocs],
    ['update', version, { status: 'disabled', latestVersion: null }, null, { state: 'refreshed', paths: ['AGENTS.md'], missing: [] }]);
  assert.equal(await readFile(agentsPath, 'utf8'), agents, 'update must restore the block of the installed version.');
  const child = spawn(process.execPath, [join(installedRoot, 'dist', 'main.js'), 'browser'], {
    cwd: temporaryRoot, env: offline, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
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
    assert.deepEqual([session.version, session.cliVersion, 'update' in session], [3, version, false]);
    const headers = { 'X-Gitifact-Session': session.sessionId, Origin: new URL(url).origin };
    const notes = await (await fetch(new URL('/api/v1/changelog?lang=ko', url), { headers })).json();
    assert.deepEqual([notes.contract, notes.language, notes.fallback, notes.entries[0].version], ['changelog', 'ko', false, version], 'Release notes must start with the packaged version.');
    assert.equal((await fetch(new URL('/changelog', url), { headers: { Accept: 'text/html' } })).status, 200);
    assert.equal((await fetch(new URL('/api/v1/status', url), { headers })).status, 200);
    await writeFile(join(temporaryRoot, 'browser-created.txt'), 'refresh fixture');
    const response = await fetch(new URL('/api/v1/status/refresh', url), { method: 'POST', headers });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).changes.some(change => change.path === 'browser-created.txt'));
  } finally { child.kill(); await exited; }
  console.log('PASS: packed CLI installs offline; init with the AGENTS.md block, guides, specs new/show, check, records list, changes list/commit, update, release notes and browser run outside the workspace.');
} finally {
  // Only removes the exact directory returned by mkdtemp for this check.
  await rm(temporaryRoot, { recursive: true, force: true });
}
