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
const temporaryRoot = await mkdtemp(join(tmpdir(), 'tryce-package-'));
const pnpm = (args, cwd) => execFileSync(process.execPath, [packageManager, ...args], {
  cwd, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
});

try {
  pnpm(['--filter', '@tryce/cli', 'pack', '--pack-destination', temporaryRoot], workspace);
  const archives = (await readdir(temporaryRoot)).filter((name) => name.endsWith('.tgz'));
  assert.equal(archives.length, 1);
  await writeFile(join(temporaryRoot, 'package.json'), JSON.stringify({ private: true }));
  pnpm(['--dir', temporaryRoot, 'add', join(temporaryRoot, archives[0]), '--offline', '--ignore-scripts'], temporaryRoot);
  const installedPackage = join(temporaryRoot, 'node_modules', '@tryce', 'cli', 'package.json');
  const { version, dependencies = {} } = JSON.parse(await readFile(installedPackage, 'utf8'));
  assert.deepEqual(dependencies, {}, 'The initial bundled CLI must be self-contained.');
  assert.equal(pnpm(['--dir', temporaryRoot, 'exec', 'tryce', '--version'], temporaryRoot).trim(), version);
  assert.match(pnpm(['--dir', temporaryRoot, 'exec', 'tryce', '--help'], temporaryRoot), /Usage: tryce/);
  execFileSync('git', ['init', '--template=', '-b', 'main'], { cwd: temporaryRoot, stdio: 'pipe' });
  const status = JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'tryce', 'status'], temporaryRoot));
  assert.equal(status.contract, 'repository-status');
  assert.equal(status.version, 1);
  assert.equal(status.ok, true);
  assert.deepEqual(status.head, { state: 'unborn', branch: 'main', commit: null });
  assert.deepEqual(status.checks, { state: 'not-run', reason: 'git-status-only' });
  const initialized = JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'tryce', 'init', '--mode', 'prototype'], temporaryRoot));
  assert.equal(initialized.outcome, 'created');
  assert.deepEqual(initialized.baseline, { kind: 'empty' });
  const configBefore = await readFile(join(temporaryRoot, '.tryce', 'config.json'));
  assert.equal(JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'tryce', 'init'], temporaryRoot)).outcome, 'already-initialized');
  assert.deepEqual(await readFile(join(temporaryRoot, '.tryce', 'config.json')), configBefore);
  const enabled = JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'tryce', 'note', 'enable'], temporaryRoot));
  assert.equal(enabled.outcome, 'enabled');
  assert.deepEqual(await readFile(join(temporaryRoot, enabled.backupPath)), configBefore);
  const added = JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'tryce', 'note', 'add', '--type', 'discovery', '--message', 'Packaged CLI writes a note'], temporaryRoot));
  assert.equal(added.outcome, 'added');
  const shown = JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'tryce', 'note', 'show', added.notes[0].id], temporaryRoot));
  assert.deepEqual(shown.notes, added.notes);
  assert.equal(JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'tryce', 'note', 'list'], temporaryRoot)).notes.length, 1);
  const brief = JSON.parse(pnpm(['--dir', temporaryRoot, 'exec', 'tryce', 'brief', '--all'], temporaryRoot));
  assert.equal(brief.ok, true);
  assert.equal(brief.report.project.data.mode, 'prototype');
  assert.equal(brief.report.notes.data.items[0].id, added.notes[0].id);
  assert.equal(brief.report.notes.data.omitted, 0);
  assert.equal(brief.report.checks.state, 'not-run');
  const child = spawn(process.execPath, [join(temporaryRoot, 'node_modules', '@tryce', 'cli', 'dist', 'main.js'), 'browser'], {
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
    const headers = { 'X-Tryce-Session': session.sessionId, Origin: new URL(url).origin };
    assert.equal((await fetch(new URL('/api/v1/status', url), { headers })).status, 200);
    await writeFile(join(temporaryRoot, 'browser-created.txt'), 'refresh fixture');
    const response = await fetch(new URL('/api/v1/status/refresh', url), { method: 'POST', headers });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).changes.some(change => change.path === 'browser-created.txt'));
  } finally { child.kill(); await exited; }
  console.log('PASS: packed CLI installs offline; init, note, brief, status and browser run outside the workspace.');
} finally {
  // Only removes the exact directory returned by mkdtemp for this check.
  await rm(temporaryRoot, { recursive: true, force: true });
}
