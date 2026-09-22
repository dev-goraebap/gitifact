import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePorcelain, decodeGitLine } from '../.test-build/adapters/git/porcelain.js';

const oid = 'a'.repeat(40);
const header = '# branch.oid ' + oid + '\0# branch.head main\0';
const tracked = (xy, path, blob = 'b'.repeat(40), sub = 'N...') =>
  '1 ' + xy + ' ' + sub + ' 100644 100644 100644 ' + oid + ' ' + blob + ' ' + path + '\0';
const parse = (text) => parsePorcelain(Buffer.from(header + text), 'sha1');
const fails = (buffer, code = 'INVALID_GIT_OUTPUT') =>
  assert.throws(() => parsePorcelain(buffer, 'sha1'), (error) => error.code === code);

test('NUL parsing preserves special filenames, UTF-8 order and unknown optional headers', () => {
  const value = parse(tracked('MM', '한글 space\tline\nend ') + '? a\0? embedded/\0# future optional\0');
  assert.deepEqual(value.changes.map((v) => v.path), ['a', 'embedded/', '한글 space\tline\nend ']);
  assert.equal(value.changes[2].xy, 'MM');
  assert.equal(decodeGitLine(Buffer.from('/repo \n\n')), '/repo \n');
});
test('comparison retains index object identities and ignores ordering', () => {
  assert.equal(parse('? z\0? a\0').comparison, parse('? a\0? z\0').comparison);
  assert.notEqual(parse(tracked('MM', 'file')).comparison, parse(tracked('MM', 'file', 'c'.repeat(40))).comparison);
});
test('unmerged and submodule records preserve their own meanings', () => {
  const raw = 'u UU N... 100644 100644 100644 100644 ' + [oid, oid, oid].join(' ') + ' conflict\0';
  const value = parse(raw + tracked('.M', 'module', oid, 'SCMU'));
  assert.equal(value.changes[0].kind, 'unmerged');
  assert.deepEqual(value.changes[1].submodule, { commitChanged: true, trackedChanges: true, untrackedChanges: true });
});
test('unborn, detached and SHA-256 headers are explicit', () => {
  assert.deepEqual(parsePorcelain(Buffer.from('# branch.oid (initial)\0# branch.head main\0'), 'sha1').head,
    { state: 'unborn', branch: 'main', commit: null });
  assert.deepEqual(parsePorcelain(Buffer.from('# branch.oid ' + 'd'.repeat(64) + '\0# branch.head (detached)\0'), 'sha256').head,
    { state: 'detached', branch: null, commit: 'd'.repeat(64) });
});
test('malformed headers, records, paths, states and incomplete buffers are rejected', () => {
  for (const raw of ['', header.slice(0, -1), header + '\0', header + '# branch.oid ' + oid + '\0',
    header + '? ../escape\0', header + '? same\0? same\0', header + '2 R100 unsupported\0',
    header + tracked('??', 'file'), header + tracked('..', 'file'), header + tracked('.M', ''),
    header + tracked('.M', 'file', 'short'), header + tracked('.M', 'file', oid, 'SXYZ'),
    '# branch.oid (initial)\0# branch.head (detached)\0', '# branch.head main\0']) {
    fails(Buffer.from(raw));
  }
  fails(Buffer.concat([Buffer.from(header + '? '), Buffer.from([0xff, 0])]), 'UNSUPPORTED_PATH_ENCODING');
});
