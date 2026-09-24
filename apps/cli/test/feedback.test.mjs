import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { issueBody, parseFeedback, sendFeedback } from '../.test-build/commands/feedback.js';
import { FEEDBACK_REPOSITORY, ISSUE_URL_LIMIT, newIssueUrl } from '../.test-build/adapters/github/issue.js';
import { projectFixture } from './git-fixture.mjs';

// A stand-in for gh: records every call and answers from a script, so no test ever reaches GitHub.
function fakeGh({ signedIn = true, create = { code: 0, stdout: 'Creating issue\nhttps://github.com/dev-goraebap/gitifact/issues/42\n' }, missing = false } = {}) {
  const calls = [];
  const run = async (args, options) => {
    calls.push({ args: [...args], input: options.input });
    if (missing) return undefined;
    if (args[0] === 'auth') return { code: signedIn ? 0 : 1, stdout: '', stderr: signedIn ? '' : 'not logged in' };
    return { stderr: '', ...create };
  };
  return { run, calls };
}
const feedback = { type: 'bug', title: '목록 정렬이 틀림', body: 'specs list --sort updated가 같은 날짜에서 순서가 섞인다.' };

test('feedback input is exactly a type, a one-line title and a body', () => {
  assert.deepEqual(parseFeedback({ type: 'idea', title: '  제목  ', body: ' 본문 ' }), { type: 'idea', title: '제목', body: '본문' });
  for (const input of [null, [], { type: 'bug', title: 't' }, { type: 'question', title: 't', body: 'b' }, { type: 'bug', title: '두\n줄', body: 'b' },
    { type: 'bug', title: ' ', body: 'b' }, { type: 'bug', title: 't', body: ' ' }, { type: 'bug', title: 't', body: 'b', labels: ['x'] },
    { type: 'bug', title: '가'.repeat(201), body: 'b' }, { type: 'bug', title: 't', body: 'b'.repeat(20001) }]) {
    assert.throws(() => parseFeedback(input), { code: 'INVALID_INPUT' }, JSON.stringify(input)?.slice(0, 60));
  }
});

test('the body carries the environment and nothing from the project', async () => {
  const body = await issueBody(feedback, '9.9.9', process.cwd());
  assert.ok(body.startsWith(feedback.body + '\n\n---\n- Type: bug\n- Gitifact: 9.9.9\n- OS: '));
  assert.match(body, new RegExp(`\\n- Node: ${process.version.replace(/\./g, '\\.')}\\n- schemaVersion: (\\d+|none)\\n$`));
});

test('a signed-in gh creates the issue; without it, or when it fails, the new-issue page is given instead', async () => {
  const signed = fakeGh();
  const created = await sendFeedback(feedback, 'full body', false, signed.run);
  assert.deepEqual(created, { dryRun: false, method: 'gh', url: 'https://github.com/dev-goraebap/gitifact/issues/42', truncated: false, ghFailed: false });
  assert.deepEqual(signed.calls.map(c => c.args), [['auth', 'status', '--hostname', 'github.com'],
    ['issue', 'create', '--repo', FEEDBACK_REPOSITORY, '--title', feedback.title, '--body-file', '-']]);
  assert.equal(signed.calls[1].input, 'full body');

  for (const gh of [fakeGh({ missing: true }), fakeGh({ signedIn: false })]) {
    const page = await sendFeedback(feedback, 'full body', false, gh.run);
    assert.equal(page.method, 'url'); assert.equal(page.ghFailed, false); assert.equal(gh.calls.length, 1);
    const url = new URL(page.url);
    assert.equal(url.origin + url.pathname, 'https://github.com/dev-goraebap/gitifact/issues/new');
    assert.deepEqual([url.searchParams.get('title'), url.searchParams.get('body')], [feedback.title, 'full body']);
  }
  const failing = await sendFeedback(feedback, 'full body', false, fakeGh({ create: { code: 1, stdout: '' } }).run);
  assert.deepEqual([failing.method, failing.ghFailed], ['url', true]);
});

test('a dry run checks gh and sends nothing', async () => {
  const signed = fakeGh();
  assert.deepEqual(await sendFeedback(feedback, 'b', true, signed.run), { dryRun: true, method: 'gh', url: null, truncated: false, ghFailed: false });
  assert.equal(signed.calls.length, 1);
  const unsigned = fakeGh({ signedIn: false });
  const preview = await sendFeedback(feedback, 'b', true, unsigned.run);
  assert.equal(preview.method, 'url'); assert.equal(unsigned.calls.length, 1);
});

test('a body too long for the address is cut to fit and marked', () => {
  const body = '긴 본문 '.repeat(3000);
  const { url, truncated } = newIssueUrl('제목', body, '\n(잘림)');
  assert.equal(truncated, true); assert.ok(url.length <= ISSUE_URL_LIMIT, String(url.length));
  const kept = new URL(url).searchParams.get('body');
  assert.ok(kept.endsWith('\n(잘림)')); assert.ok(body.startsWith(kept.slice(0, -'\n(잘림)'.length)));
  assert.equal(newIssueUrl('제목', '짧은 본문', '\n(잘림)').truncated, false);
});

test('feedback reads its input like a commit and refuses a bad one before anything is sent', t => {
  const f = projectFixture(t);
  const input = join(f.root, 'feedback.json');
  writeFileSync(input, JSON.stringify({ type: 'bug', title: '제목', body: '본문' }));
  // Every PATH variable points at an empty folder, so no gh is found and nothing reaches the network.
  const noGh = join(f.root, 'no-gh'); mkdirSync(noGh);
  const env = Object.fromEntries(Object.keys(f.env).filter(key => /^path$/i.test(key)).map(key => [key, noGh]));
  const preview = f.ok(['feedback', '--file', input, '--dry-run'], { env });
  assert.deepEqual([preview.contract, preview.version, preview.dryRun, preview.method, preview.title], ['feedback', 1, true, 'url', '제목']);
  assert.equal(new URL(preview.url).searchParams.get('body'), preview.body);
  assert.match(preview.body, /^본문\n\n---\n- Type: bug\n- Gitifact: .+\n- OS: .+\n- Node: .+\n- schemaVersion: 3\n$/);
  for (const [content, code] of [['{"type":"bug","title":"t"}', 'INVALID_INPUT'], ['not json', 'INVALID_INPUT']]) {
    writeFileSync(input, content);
    const failed = f.run(['feedback', '--file', input, '--format', 'json']);
    assert.equal(failed.status, 1); assert.equal(JSON.parse(failed.stderr).error.code, code);
  }
  assert.notEqual(f.run(['feedback']).status, 0);
});
