import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { initRepository } from '../.test-build/adapters/git/init-repository.js';
import { fixture, fingerprint } from './git-fixture.mjs';

for (const format of ['sha1', 'sha256']) {
  test(`batched record blobs preserve UTF-8 bytes and distinct index/HEAD versions (${format})`, async t => {
    const f = fixture(t, format);
    const contents = new Map();
    for (let i = 0; i < 40; i++) {
      const directory = `.tryce/spec/area-${i}`;
      mkdirSync(join(f.repo, directory), { recursive: true });
      const path = `${directory}/tryce.json`;
      const text = JSON.stringify({ spec: `area-${i}`, text: `한글 🐳\n${i}\n` }) + '\n';
      f.write(path, text); contents.set(path, text);
    }
    f.commit('forty distinct record blobs');
    const path = '.tryce/spec/area-0/tryce.json';
    f.write(path, '{"staged":"다른 원문 🐳"}\n');
    f.git(['add', path]); f.write(path, contents.get(path));
    const before = fingerprint(f.repo);
    const head = f.git(['rev-parse', 'HEAD']).stdout.trim();
    const result = await initRepository(f.repo, f.env).recordSnapshot(f.repo, head);
    assert.equal(result.paths.length, 40);
    assert.deepEqual(result.versions.get(path), ['{"staged":"다른 원문 🐳"}\n', contents.get(path)]);
    for (const [name, text] of contents) if (name !== path) assert.deepEqual(result.versions.get(name), [text, text]);
    assert.deepEqual(fingerprint(f.repo), before);
  });
}
