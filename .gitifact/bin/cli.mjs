// Gitifact launcher, written by `gitifact init` and `gitifact update`; do not edit, the next update rewrites it.
// It runs the Gitifact release this project is on (`cli` in ../config.json): `node .gitifact/bin/cli.mjs <command>`.
// The release is kept once per computer in the user's cache, fetched from the npm registry the first time and checked
// against the registry's integrity. GITIFACT_PACKAGE names a local package file to use instead (an unpublished build).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, normalize, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';

const fail = message => { process.stderr.write('gitifact launcher: ' + message + '\n'); process.exit(1); };

let version;
try { version = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'config.json'), 'utf8')).cli; }
catch { fail('cannot read .gitifact/config.json next to this launcher.'); }
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) fail('.gitifact/config.json has no valid "cli" version.');

// The same per-user cache folder the CLI keeps its update check in.
const env = process.env; const home = homedir();
const cacheRoot = env.GITIFACT_CACHE_DIR || (process.platform === 'win32' ? join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'gitifact')
  : process.platform === 'darwin' ? join(home, 'Library', 'Caches', 'gitifact') : join(env.XDG_CACHE_HOME || join(home, '.cache'), 'gitifact'));
const releases = join(cacheRoot, 'cli');
const main = join(releases, version, 'package', 'dist', 'main.js');

/** The files of a gzipped tar, by path: enough of ustar, pax and GNU long names for an npm package. */
function untar(gzipped) {
  const data = gunzipSync(gzipped); const files = new Map();
  const text = (start, length) => data.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
  let offset = 0; let longName;
  while (offset + 512 <= data.length) {
    if (data[offset] === 0) break;
    const size = parseInt(text(offset + 124, 12).trim() || '0', 8); const type = String.fromCharCode(data[offset + 156] || 48);
    const body = data.subarray(offset + 512, offset + 512 + size);
    let name = longName ?? ((text(offset + 345, 155) ? text(offset + 345, 155) + '/' : '') + text(offset, 100)); longName = undefined;
    if (type === 'x') { const path = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(body.toString('utf8')); if (path) longName = path[1]; }
    else if (type === 'L') longName = body.toString('utf8').replace(/\0.*$/s, '');
    else if (type === '0' || type === '7') files.set(name, body);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

/** Unpacks a package into the cache as `<version>/package`, all at once so a half-written release is never run. */
function unpack(tarball) {
  mkdirSync(releases, { recursive: true });
  const staging = mkdtempSync(join(releases, '.tmp-'));
  try {
    for (const [name, body] of untar(tarball)) {
      const path = normalize(join(staging, name));
      if (!path.startsWith(staging + sep)) throw new Error('the package holds a path outside itself: ' + name);
      mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, body);
    }
    const unpacked = JSON.parse(readFileSync(join(staging, 'package', 'package.json'), 'utf8'));
    if (unpacked.name !== 'gitifact' || unpacked.version !== version) throw new Error('the package is ' + unpacked.name + '@' + unpacked.version + ', not gitifact@' + version + '.');
    try { renameSync(staging, join(releases, version)); }
    catch (error) { if (!existsSync(main)) throw error; }
  } finally { rmSync(staging, { recursive: true, force: true }); }
}

async function fetchRelease() {
  const registry = (env.npm_config_registry || 'https://registry.npmjs.org').replace(/\/+$/, '');
  process.stderr.write('gitifact launcher: fetching gitifact@' + version + ' once for this computer…\n');
  const manifest = await fetch(registry + '/gitifact/' + version).then(r => r.ok ? r.json() : fail('the registry has no gitifact@' + version + ' (' + r.status + ').'));
  const { tarball, integrity } = manifest.dist ?? {};
  if (!tarball || !/^sha512-/.test(integrity ?? '')) fail('the registry answer for gitifact@' + version + ' has no sha512 integrity.');
  const bytes = Buffer.from(await fetch(tarball).then(r => r.ok ? r.arrayBuffer() : fail('could not download ' + tarball + ' (' + r.status + ').')));
  if ('sha512-' + createHash('sha512').update(bytes).digest('base64') !== integrity) fail('the downloaded package does not match the registry integrity.');
  return bytes;
}

if (!existsSync(main)) {
  try { unpack(env.GITIFACT_PACKAGE ? readFileSync(env.GITIFACT_PACKAGE) : await fetchRelease()); }
  catch (error) { fail('could not prepare gitifact@' + version + ': ' + (error?.message ?? error)); }
}
const run = spawnSync(process.execPath, [main, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(run.status ?? 1);
