import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const shipped = readFileSync(fileURLToPath(new URL('../src/shared/launcher/cli.mjs', import.meta.url)), 'utf8');

/** A gzipped ustar of the given files, the way npm packs a package (every path under `package/`). */
function tarball(files) {
  const blocks = [];
  for (const [name, text] of Object.entries(files)) {
    const body = Buffer.from(text); const header = Buffer.alloc(512);
    header.write(name, 0); header.write('0000644\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
    header.write(body.length.toString(8).padStart(11, '0') + '\0', 124); header.write('00000000000\0', 136);
    header.write('        ', 148); header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263);
    let sum = 0; for (const byte of header) sum += byte;
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}
/** A stand-in release: its main.js prints what it was given and exits with the code the first argument names. */
const release = version => tarball({
  'package/package.json': JSON.stringify({ name: 'gitifact', version }),
  'package/dist/main.js': "console.log('ran ' + JSON.stringify(process.argv.slice(2))); process.exit(Number(process.argv[2] ?? 0) || 0);\n",
});

function project(t, cli) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'gitifact-launcher-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'repo', '.gitifact', 'bin'), { recursive: true });
  writeFileSync(join(root, 'repo', '.gitifact', 'config.json'), JSON.stringify(cli === undefined ? { schemaVersion: 3 } : { schemaVersion: 3, cli }));
  writeFileSync(join(root, 'repo', '.gitifact', 'bin', 'cli.mjs'), shipped);
  return { root, launcher: join(root, 'repo', '.gitifact', 'bin', 'cli.mjs'), cache: join(root, 'cache') };
}
const run = (p, args, env = {}) => new Promise(resolve => {
  const child = spawn(process.execPath, [p.launcher, ...args], { env: { ...process.env, GITIFACT_CACHE_DIR: p.cache, GITIFACT_PACKAGE: '', ...env } });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
  child.on('close', status => resolve({ status, stdout, stderr }));
});

test('the launcher runs the project release from a local package, then from the cache, passing arguments and exit codes', async t => {
  const p = project(t, '0.9.0');
  const file = join(p.root, 'gitifact-0.9.0.tgz'); writeFileSync(file, release('0.9.0'));
  const first = await run(p, ['0', 'specs', 'list'], { GITIFACT_PACKAGE: file });
  assert.deepEqual([first.status, first.stdout.trim()], [0, 'ran ["0","specs","list"]'], first.stderr);
  assert.ok(existsSync(join(p.cache, 'cli', '0.9.0', 'package', 'dist', 'main.js')));
  // The release stays in the cache: without the package it still runs, and its exit code comes through.
  const second = await run(p, ['3']);
  assert.deepEqual([second.status, second.stdout.trim(), second.stderr], [3, 'ran ["3"]', '']);
});

test('a package of another version or name is refused and leaves nothing in the cache', async t => {
  const p = project(t, '0.9.0');
  const file = join(p.root, 'other.tgz'); writeFileSync(file, release('0.9.1'));
  const result = await run(p, [], { GITIFACT_PACKAGE: file });
  assert.equal(result.status, 1); assert.match(result.stderr, /gitifact@0\.9\.1, not gitifact@0\.9\.0/);
  assert.equal(existsSync(join(p.cache, 'cli', '0.9.0')), false);
  const missing = project(t, undefined);
  assert.match((await run(missing, [])).stderr, /no valid "cli" version/);
});

test('the launcher fetches the release from the registry once and refuses one that does not match its integrity', async t => {
  const good = release('0.9.0'); const bad = release('0.9.0').subarray(0, 10);
  const integrity = 'sha512-' + createHash('sha512').update(good).digest('base64');
  let served = good; let manifests = 0;
  const server = createServer((request, response) => {
    if (request.url === '/gitifact/0.9.0') { manifests++; response.end(JSON.stringify({ dist: { tarball: `http://127.0.0.1:${server.address().port}/gitifact-0.9.0.tgz`, integrity } })); return; }
    if (request.url === '/gitifact-0.9.0.tgz') { response.end(served); return; }
    response.statusCode = 404; response.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const registry = { npm_config_registry: `http://127.0.0.1:${server.address().port}/` };
  served = bad;
  const refused = await run(project(t, '0.9.0'), [], registry);
  assert.equal(refused.status, 1); assert.match(refused.stderr, /does not match the registry integrity/);
  served = good;
  const p = project(t, '0.9.0');
  assert.deepEqual([(await run(p, ['0', 'check'], registry)).stdout.trim(), (await run(p, ['0'], registry)).status], ['ran ["0","check"]', 0]);
  assert.equal(manifests, 2, 'the second run reads the cache, not the registry');
  assert.match((await run(project(t, '9.9.9'), [], registry)).stderr, /registry has no gitifact@9\.9\.9 \(404\)/);
});
