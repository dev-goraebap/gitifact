import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { syncSkills } from './sync-skills.mjs';

const source = '.agents/skills/gitifact-workflow/SKILL.md';
const target = '.claude/skills/gitifact-workflow/SKILL.md';
const manifest = '.agents/gitifact-local-skills.json';
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'gitifact-skills-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.agents/skills/gitifact-workflow'), { recursive: true });
  await writeFile(join(root, source), 'original\n');
  return root;
}
test('create, repeat and update preserve the edited source and unrelated skills', async t => {
  const root = await fixture(t);
  await assert.rejects(syncSkills(root, true), /missing or outdated/);
  assert.equal(await syncSkills(root), 'created');
  assert.equal(await syncSkills(root), 'in-sync');
  await mkdir(join(root, '.claude/skills/other'), { recursive: true });
  await writeFile(join(root, '.claude/skills/other/SKILL.md'), 'user');
  await writeFile(join(root, source), 'customized\n');
  assert.equal(await syncSkills(root), 'updated');
  assert.equal(await readFile(join(root, target), 'utf8'), 'customized\n');
  assert.equal(await readFile(join(root, source), 'utf8'), 'customized\n');
  assert.equal(await readFile(join(root, '.claude/skills/other/SKILL.md'), 'utf8'), 'user');
  assert.equal(await syncSkills(root, true), 'in-sync');
});
test('unmanaged and edited destinations are refused without changing files', async t => {
  const root = await fixture(t);
  await mkdir(join(root, '.claude/skills/gitifact-workflow'), { recursive: true });
  await writeFile(join(root, target), 'original\n');
  await assert.rejects(syncSkills(root), /Unmanaged/);
  await rm(join(root, target));
  await syncSkills(root);
  const before = await readFile(join(root, manifest));
  await writeFile(join(root, target), 'user edit');
  await assert.rejects(syncSkills(root), /Locally changed/);
  assert.equal(await readFile(join(root, target), 'utf8'), 'user edit');
  assert.deepEqual(await readFile(join(root, manifest)), before);
});
test('an interrupted publication resumes from either recorded side', async t => {
  const root = await fixture(t);
  await syncSkills(root);
  const next = Buffer.from('next\n');
  await writeFile(join(root, source), next);
  const state = JSON.parse(await readFile(join(root, manifest), 'utf8'));
  state.accepted.push(createHash('sha256').update(next).digest('hex'));
  await writeFile(join(root, manifest), JSON.stringify(state));
  assert.equal(await syncSkills(root), 'updated');
  await writeFile(join(root, manifest), JSON.stringify(state));
  assert.equal(await syncSkills(root), 'in-sync');
  assert.equal(JSON.parse(await readFile(join(root, manifest), 'utf8')).accepted.length, 1);
});
test('lock and corrupt manifest are preserved for explicit recovery', async t => {
  const root = await fixture(t);
  const lock = join(root, '.agents/gitifact-local-skills.lock');
  await writeFile(lock, 'other operation');
  await assert.rejects(syncSkills(root), /EEXIST/);
  assert.equal(await readFile(lock, 'utf8'), 'other operation');
  await rm(lock);
  await writeFile(join(root, manifest), '{broken');
  await assert.rejects(syncSkills(root), SyntaxError);
  assert.equal(await readFile(join(root, manifest), 'utf8'), '{broken');
});
test('directory junction does not redirect publication outside the target', async t => {
  const root = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'gitifact-skills-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, join(root, '.claude'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(syncSkills(root), /Unsupported path/);
  await assert.rejects(readFile(join(outside, 'skills/gitifact-workflow/SKILL.md')), { code: 'ENOENT' });
});
