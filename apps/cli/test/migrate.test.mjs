import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, fingerprint } from './git-fixture.mjs';
import { createSpecBrowserReader } from '../.test-build/server/spec-reader.js';

const exe = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const cli = (f, args) => spawnSync(process.execPath, [exe, ...args], { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 45000 });
const ok = r => { assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
const failed = (r, code) => { assert.equal(r.status, 1, r.stdout); const dto = JSON.parse(r.stderr); assert.equal(dto.error.code, code, dto.error.message); return dto; };
const file = (f, value) => { const p = join(f.root, 'input.json'); writeFileSync(p, JSON.stringify(value)); return p; };
const authorization = { basis: 'user-request', evidence: 'Fixture explicitly requests this transition commit' };
const legacyReq = '<!-- tryce-spec: S-abcdefghij -->\n\n# Posts\n\n## Save\n<!-- tryce-req: R-abcdefghij -->\n\n제목을 입력해 저장합니다.\n';
const legacyDesign = '<!-- tryce-design: S-abcdefghij -->\n\n# Posts design\n\n## Flow\n<!-- tryce-ref: R-abcdefghij -->\n\n저장 흐름.\n\n```md\n<!-- tryce-ref: R-zzzzzzzzzz -->\n```\n';
const history = JSON.stringify({ id: 'H-abcdefghij', requirements: ['R-abcdefghij'], reason: '첫 저장 요구사항' }) + '\n';
const legacyFiles = ['.tryce/spec/posts/requirements.md', '.tryce/spec/posts/design.md', '.tryce/spec/posts/history.jsonl'];
const newFiles = legacyFiles.map(p => p.replace(/^\.tryce\//, '.gitifact/'));

/** A checkout recorded by the Tryce build: `.tryce` store, `tryce-*` markers, committed history. */
function legacy(t) {
  const f = fixture(t);
  for (const [k, v] of [['user.name', 'Tryce fixture'], ['user.email', 'fixture@example.invalid'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) f.git(['config', k, v]);
  f.write('app.js', 'export {};\n'); f.commit('Initial');
  mkdirSync(join(f.repo, '.tryce/spec/posts'), { recursive: true });
  f.write('.tryce/config.json', JSON.stringify({ schemaVersion: 2, baseline: { kind: 'commit', objectFormat: 'sha1', commit: f.git(['rev-parse', 'HEAD']).stdout.trim() } }, null, 2) + '\n');
  f.write(legacyFiles[0], legacyReq); f.write(legacyFiles[1], legacyDesign); f.write(legacyFiles[2], history);
  f.commit('Legacy spec');
  return f;
}

test('a Tryce checkout is refused until migrated, and migration keeps IDs, reasons and history readable', async t => {
  const f = legacy(t);
  failed(cli(f, ['spec', 'working']), 'MIGRATION_REQUIRED');
  failed(cli(f, ['init']), 'MIGRATION_REQUIRED');
  const before = fingerprint(f.repo);
  const planned = ok(cli(f, ['migrate', '--dry-run']));
  assert.equal(planned.outcome, 'planned'); assert.deepEqual(planned.rewritten, [newFiles[1], newFiles[0]]);
  assert.deepEqual(fingerprint(f.repo), before);
  const migrated = ok(cli(f, ['migrate']));
  assert.equal(migrated.outcome, 'migrated'); assert.equal(migrated.specs[0].id, 'S-abcdefghij'); assert.equal(migrated.specs[0].history, 1);
  assert.equal(existsSync(join(f.repo, '.tryce')), false);
  assert.equal(readFileSync(join(f.repo, newFiles[0]), 'utf8'), legacyReq.replace(/<!-- tryce-/g, '<!-- gitifact-'));
  // Only marker lines change; the fenced example and the reason file stay byte-identical.
  assert.match(readFileSync(join(f.repo, newFiles[1]), 'utf8'), /```md\n<!-- tryce-ref: R-zzzzzzzzzz -->\n```/);
  assert.equal(readFileSync(join(f.repo, newFiles[2]), 'utf8'), history);
  failed(cli(f, ['migrate']), 'ALREADY_MIGRATED');
  // The store rename is not a specification change.
  const changes = ok(cli(f, ['spec', 'changes']));
  assert.deepEqual(changes.changes, []); assert.deepEqual(changes.specChanges, []);
  const working = ok(cli(f, ['spec', 'working']));
  assert.equal(working.specs[0].path, newFiles[0]); assert.equal(working.specs[0].history[0].id, 'H-abcdefghij'); assert.equal(working.specs[0].design.requirements[0], 'R-abcdefghij');
  // One commit removes the old paths and adds the new ones; no trailer is invented for an unchanged spec.
  const committed = ok(cli(f, ['spec', 'commit', '--file', file(f, { reasons: [], paths: ['.tryce/config.json', '.gitifact/config.json', ...legacyFiles, ...newFiles], message: 'Move records to .gitifact', authorization })]));
  assert.equal(committed.outcome, 'committed'); assert.deepEqual(committed.requirements, []);
  assert.doesNotMatch(f.git(['log', '-1', '--format=%B']).stdout, /Gitifact-|Tryce-/);
  assert.equal(f.git(['status', '--porcelain']).stdout, '');
  // History before the rename still reads through the legacy store, and the diff across it is empty.
  const previous = ok(cli(f, ['spec', 'read', '--ref', 'HEAD~1']));
  assert.equal(previous.specs[0].path, legacyFiles[0]); assert.equal(previous.specs[0].design.title, 'Posts design');
  const diff = ok(cli(f, ['spec', 'diff', '--from', 'HEAD~1', '--to', 'HEAD']));
  assert.deepEqual(diff.changes, []);
  // A later change is attributed only to itself, and the activity feed still lists the legacy creation.
  const stamp = ok(cli(f, ['spec', 'working'])).stamp;
  ok(cli(f, ['spec', 'save', '--file', file(f, { expected: stamp, operations: [{ type: 'update', id: 'R-abcdefghij', title: 'Save', body: '제목 없이 저장하지 않습니다.' }] })]));
  const second = ok(cli(f, ['spec', 'commit', '--file', file(f, { reasons: [{ requirements: ['R-abcdefghij'], reason: '빈 제목 저장을 막습니다.' }], paths: [newFiles[0], newFiles[2]], message: 'Require a title', authorization })]));
  assert.deepEqual(second.requirements, ['R-abcdefghij']);
  assert.match(f.git(['log', '-1', '--format=%B']).stdout, /Gitifact-Req: R-abcdefghij/);
  const feed = await createSpecBrowserReader(f.repo, 'fixture', f.env)();
  assert.deepEqual(feed.events.map(e => [e.message, e.id, e.types]), [['Require a title', 'R-abcdefghij', ['modified']], ['Legacy spec', 'R-abcdefghij', ['created']], ['Legacy spec', 'S-abcdefghij', ['created']]]);
  assert.equal(feed.events[0].reasons[0], '빈 제목 저장을 막습니다.');
  assert.equal(feed.events[1].before, null); assert.equal(feed.events[1].after.path, legacyFiles[0]);
});

test('migration refuses old JSON records, stray files, unfinished Tryce runs and repositories without a store', t => {
  const f = legacy(t);
  writeFileSync(join(f.repo, '.git', 'tryce-spec-commit.lock'), '');
  failed(cli(f, ['migrate']), 'LOCKED');
  rmSync(join(f.repo, '.git', 'tryce-spec-commit.lock'));
  // Old JSON records travel unchanged so the existing deletion-only commit path can retire them afterwards.
  f.write('.tryce/spec/posts/tryce.json', '{}');
  const carried = ok(cli(f, ['migrate', '--dry-run']));
  assert.deepEqual(carried.legacyRecords, ['.gitifact/spec/posts/tryce.json']);
  rmSync(join(f.repo, '.tryce/spec/posts/tryce.json'));
  f.write('.tryce/notes.txt', 'stray');
  const before = fingerprint(f.repo);
  failed(cli(f, ['migrate']), 'UNSUPPORTED_FORMAT');
  assert.deepEqual(fingerprint(f.repo), before);
  rmSync(join(f.repo, '.tryce/notes.txt'));
  ok(cli(f, ['migrate']));
  // A lock left by a Tryce build still blocks the Gitifact build.
  mkdirSync(join(f.repo, '.git', 'tryce-spec-preview.lock'));
  const blocked = cli(f, ['spec', 'working']);
  assert.equal(blocked.status, 1); assert.match(blocked.stderr, /이전 Tryce/);
  rmSync(join(f.repo, '.git', 'tryce-spec-preview.lock'), { recursive: true });
  const fresh = fixture(t); fresh.write('app.js', ''); fresh.commit('empty');
  failed(cli(fresh, ['migrate']), 'NOTHING_TO_MIGRATE');
});

test('a commit that carries both store directories is rejected when read', t => {
  const f = legacy(t);
  mkdirSync(join(f.repo, '.gitifact/spec/other'), { recursive: true });
  f.write('.gitifact/config.json', readFileSync(join(f.repo, '.tryce/config.json')));
  f.write('.gitifact/spec/other/requirements.md', '<!-- gitifact-spec: S-bbbbbbbbbb -->\n\n# Other\n');
  f.commit('Mixed');
  const mixed = cli(f, ['spec', 'read', '--ref', 'HEAD']);
  assert.equal(mixed.status, 1); assert.match(mixed.stderr, /함께 있습니다/);
});
