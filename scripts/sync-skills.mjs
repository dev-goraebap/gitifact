import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile, rename, link, unlink, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Development-only mapping. No glob-based ownership or user-global locations.
const source = '.agents/skills/tryce-workflow/SKILL.md';
const target = '.claude/skills/tryce-workflow/SKILL.md';
const statePath = '.agents/tryce-local-skills.json';
const lockPath = '.agents/tryce-local-skills.lock';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const info = async path => { try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } };

async function safe(root, path, makeParents = false) {
  const parts = path.split('/');
  let current = root;
  for (const [i, part] of parts.entries()) {
    current = join(current, part);
    let stat = await info(current);
    if (!stat && makeParents && i < parts.length - 1) { await mkdir(current); stat = await info(current); }
    if (stat && (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()))) throw new Error(`Unsupported path: ${path}`);
  }
  return join(root, path);
}
async function bytes(root, path) {
  const full = await safe(root, path);
  return await info(full) ? readFile(full) : undefined;
}
async function publish(root, path, value, previous) {
  const full = await safe(root, path, true);
  const temp = join(dirname(full), '.tryce-skill-' + randomUUID() + '.tmp');
  await writeFile(temp, value, { flag: 'wx' });
  try {
    const current = await bytes(root, path);
    if (current?.toString('hex') !== previous?.toString('hex')) throw new Error(`Input changed: ${path}`);
    if (previous) await rename(temp, full);
    else await link(temp, full); // Refuse a concurrently created destination.
  } finally { if (await info(temp)) await unlink(temp); }
}

export async function syncSkills(root, check = false) {
  root = await realpath(root);
  const original = await bytes(root, source);
  if (!original) throw new Error(`Missing source: ${source}`);
  const inspect = async () => {
    const saved = await bytes(root, statePath);
    const state = saved ? JSON.parse(saved.toString('utf8')) : undefined;
    if (state && (state.version !== 1 || state.source !== source || state.target !== target
      || !Array.isArray(state.accepted) || state.accepted.length > 2
      || state.accepted.some(value => value !== null && !/^[a-f0-9]{64}$/.test(value)))) throw new Error('Unsupported local skill manifest');
    const current = await bytes(root, target);
    if (!state && current) throw new Error(`Unmanaged destination: ${target}`);
    if (state && !state.accepted.includes(current ? hash(current) : null)) throw new Error(`Locally changed destination: ${target}`);
    return { saved, current };
  };
  const initial = await inspect();
  if (check) {
    if (!initial.current?.equals(original)) throw new Error('Skill copy is missing or outdated; run pnpm skills:sync');
    return 'in-sync';
  }
  const lock = await safe(root, lockPath);
  await writeFile(lock, '', { flag: 'wx' });
  const owner = await lstat(lock);
  try {
    const { saved, current } = await inspect();
    if (!(await bytes(root, source))?.equals(original)) throw new Error('Source changed; retry sync');
    const next = hash(original);
    // Journal both sides before publishing. A stopped run can resume without adopting arbitrary files.
    const manifest = accepted => Buffer.from(JSON.stringify({ version: 1, source, target, accepted }, null, 2) + '\n');
    if (current?.equals(original)) {
      const settled = manifest([next]);
      if (!saved?.equals(settled)) await publish(root, statePath, settled, saved);
      return 'in-sync';
    }
    const pending = manifest([current ? hash(current) : null, next]);
    await publish(root, statePath, pending, saved);
    await publish(root, target, original, current);
    await publish(root, statePath, manifest([next]), pending);
    return current ? 'updated' : 'created';
  } finally {
    const now = await info(lock);
    if (now?.ino === owner.ino && now.dev === owner.dev) await unlink(lock);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/sync-skills.mjs [--check]');
    console.log(await syncSkills(fileURLToPath(new URL('../', import.meta.url)), process.argv.includes('--check')));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
