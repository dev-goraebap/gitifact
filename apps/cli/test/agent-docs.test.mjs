import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_END, AGENT_START, boilerplateFor, injectBlock, isWrapperFile, legacyBlockLanguage, removeBlock, renderAgentBlock, resolveAgentPaths } from '../.test-build/commands/agent-block.js';
import { applyAgentDocs, planAgentDocs } from '../.test-build/commands/agent-docs.js';
import { fileURLToPath } from 'node:url';
import { fixture, fingerprint } from './git-fixture.mjs';

// The block body ships as Markdown next to the built entry point, so unit tests read the source instead.
const source = readFileSync(fileURLToPath(new URL('../src/shared/i18n/ko/block.md', import.meta.url)), 'utf8');
// The block names no release. Each release's block text is stood in by a marker line, so a newer release has other text.
const bodyFor = version => source.replace('## Gitifact Guide\n', `## Gitifact Guide\n\n<!-- release ${version} -->\n`);
const render = version => renderAgentBlock({ readBlock: async () => bodyFor(version) });
const plan = (root, options) => planAgentDocs(root, { ...options, readBlock: async () => bodyFor(options.version) });
const block = await render('1.2.3');
const shipped = await renderAgentBlock({ readBlock: async () => source });
const agents = boilerplateFor('AGENTS.md');
const noop = async () => {};

test('rendered block is marker-delimited, Markdown-structured, short and names no version or language', () => {
  const lines = shipped.split('\n');
  assert.equal(lines[0], AGENT_START); assert.equal(lines.at(-1), AGENT_END);
  // A heading opens the block and a rule closes it, so it reads as its own section beside the user's text.
  assert.equal(lines[1], '## Gitifact Guide'); assert.equal(lines.at(-2), '---'); assert.equal(lines.at(-3), '');
  // The release and the block language live in .gitifact/config.json; the block carries neither.
  assert.ok(!/gitifact v\d|schemaVersion|· ko ·/.test(shipped));
  assert.equal(legacyBlockLanguage(shipped), undefined);
  // Markdown joins consecutive plain lines, so every non-blank line must be a heading, list item (bullet or numbered), table row or its own paragraph.
  for (const [index, line] of lines.entries()) {
    if (!line || /^(#{2,3} |- |\d+\. |\| |---$|<!--)/.test(line)) continue;
    assert.ok(!lines[index + 1] || /^\| /.test(line), 'plain line runs into the next: ' + line);
  }
  // A missing CLI is installed globally at the project's release, and a version notice is answered with now or later.
  // The agent shows the exact command, asks, and runs it itself; PowerShell without scripts gets the .cmd form.
  for (const pinned of ['.gitifact/config.json', '`cli`', 'npm i -g gitifact@<버전>', 'gitifact update --later', '명령 그대로 보여 주며', '떠넘기지 않는다', '`npm.cmd`']) assert.ok(shipped.includes(pinned), pinned);
  assert.ok(!shipped.includes('npx'));
  assert.ok(lines.length >= 25 && lines.length <= 50, String(lines.length));
  for (const topic of ['guide show spec', 'guide show commit', 'guide show <topic>', 'specs list', 'specs new', 'instructions list', 'records list --doc', 'gitifact check', 'changes commit', 'SELF-CHECK']) assert.ok(shipped.includes(topic), topic);
  for (const removed of ['spec working', 'spec save', 'spec commit', '`docs <topic>`', 'docs list', 'docs check']) assert.ok(!shipped.includes(removed), removed);
  assert.equal(boilerplateFor('.claude/CLAUDE.md'), '# CLAUDE\n\nProject-specific guidance for AI coding agents.\n');
  assert.equal(boilerplateFor('.cursorrules'), '# cursorrules\n\nProject-specific guidance for AI coding agents.\n');
});

test('the language of a block written before 0.8.3 is read from its header, with or without the language token', () => {
  // Blocks written before the language token existed are Korean; they must stay readable.
  assert.equal(legacyBlockLanguage('gitifact v0.3.1 · 저장 규약 schemaVersion 1'), 'ko');
  assert.equal(legacyBlockLanguage('gitifact v0.3.1 · ko · 저장 규약 schemaVersion 1'), 'ko');
  // The text between the language and schemaVersion is localized.
  assert.equal(legacyBlockLanguage('gitifact v1.0.0 · en · storage schemaVersion 2'), 'en');
  assert.equal(legacyBlockLanguage('gitifact v1.0.0 · ja · storage schemaVersion 2'), undefined);
  assert.equal(legacyBlockLanguage('gitifact 0.3.1 schemaVersion 1'), undefined);
});

test('the block summary matches the workflow document it summarizes', () => {
  // The block abbreviates the handling column, so only the example requests are compared. A request that
  // exists in the block but not in the source table would teach agents a rule the full document never states.
  const workflow = readFileSync(fileURLToPath(new URL('../src/shared/i18n/ko/docs/workflow.md', import.meta.url)), 'utf8');
  const requests = text => text.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| ---')).map(line => line.split(' | ')[0]);
  // Only the table under the requirements heading: the block has other tables.
  const heading = shipped.indexOf('### 무엇을 요구사항으로 남기는가');
  const section = shipped.slice(heading, shipped.indexOf('### ', heading + 4));
  const rows = section.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| ---') && !line.startsWith('| 요청 '));
  assert.equal(rows.length, 4);
  const sourceRequests = requests(workflow);
  for (const request of requests(rows.join('\n'))) assert.ok(sourceRequests.includes(request), request);
});

test('inject creates, appends, replaces idempotently and keeps CRLF', async () => {
  const created = injectBlock(null, block, agents);
  assert.equal(created, agents + '\n' + block + '\n');
  const appended = injectBlock('# Mine\n\nKeep this.\n\n\n', block, agents);
  assert.equal(appended, '# Mine\n\nKeep this.\n\n' + block + '\n');
  assert.equal(injectBlock(appended, block, agents), appended);
  const newer = await render('2.0.0');
  const replaced = injectBlock(appended + '\n## After\n', newer, agents);
  assert.equal(replaced, '# Mine\n\nKeep this.\n\n' + newer + '\n\n## After\n');
  assert.equal(injectBlock('', block, agents), block + '\n');
  const crlf = injectBlock('# Win\r\n\r\nText\r\n', block, agents);
  assert.equal(crlf, '# Win\r\n\r\nText\r\n\r\n' + block.split('\n').join('\r\n') + '\r\n');
  assert.equal(crlf.includes('\n\n'), false);
  assert.equal(injectBlock(crlf, newer, agents), crlf.replaceAll('1.2.3', '2.0.0'));
});

test('malformed markers are refused and remove restores or deletes', () => {
  for (const text of [AGENT_START + '\nno end\n', 'x\n' + AGENT_END + '\n', block + '\n' + block + '\n']) {
    assert.throws(() => injectBlock(text, block, agents), { code: 'AGENT_DOCS_MALFORMED' });
    assert.throws(() => removeBlock(text, agents), { code: 'AGENT_DOCS_MALFORMED' });
  }
  assert.equal(removeBlock(injectBlock(null, block, agents), agents), null);
  assert.equal(removeBlock(agents + '\n' + block + '\n', boilerplateFor('CLAUDE.md')), agents);
  assert.equal(removeBlock('# Mine\n\nKeep this.\n\n' + block + '\n\n## After\n', agents), '# Mine\n\nKeep this.\n\n## After\n');
  assert.equal(removeBlock('# Mine\n\n' + block + '\n', agents), '# Mine\n');
  assert.equal(removeBlock('unrelated\n', agents), 'unrelated\n');
  assert.equal(removeBlock(block + '\n', agents), null);
});

test('wrapper detection and preset resolution follow the search order', () => {
  assert.equal(isWrapperFile('@AGENTS.md\n'), true);
  assert.equal(isWrapperFile('@./AGENTS.md\r\n\r\n@CLAUDE.md\r\n'), true);
  assert.equal(isWrapperFile('@AGENTS.md\n\nAlso read the guides.\n'), false);
  assert.equal(isWrapperFile('@other.md\n'), false);
  assert.equal(isWrapperFile('@AGENTS.md\n\n' + block + '\n'), true);
  assert.equal(boilerplateFor('AGENTS.md'), '# AGENTS.md\n\nProject-specific guidance for AI coding agents.\n');
  assert.equal(isWrapperFile(''), false);
  const files = entries => new Map(entries);
  assert.deepEqual(resolveAgentPaths('claude', files([])), { inject: [], create: '.claude/CLAUDE.md' });
  assert.deepEqual(resolveAgentPaths('claude', files([['.claude/CLAUDE.md', 'x'], ['CLAUDE.md', 'y']])), { inject: ['CLAUDE.md'], create: null });
  assert.deepEqual(resolveAgentPaths('cursor', files([['AGENTS.md', 'x']])), { inject: ['AGENTS.md'], create: null });
  assert.deepEqual(resolveAgentPaths('codex', files([['CLAUDE.md', 'x']])), { inject: [], create: 'AGENTS.md' });
  assert.deepEqual(resolveAgentPaths('hermes', files([])), { inject: [], create: 'AGENTS.md' });
  assert.deepEqual(resolveAgentPaths(undefined, files([])), { inject: [], create: 'AGENTS.md' });
  assert.deepEqual(resolveAgentPaths('all', files([])), { inject: [], create: 'AGENTS.md' });
  assert.deepEqual(resolveAgentPaths(undefined, files([['CLAUDE.md', '@AGENTS.md\n'], ['AGENTS.md', '# A\n'], ['.cursorrules', 'rules']])),
    { inject: ['AGENTS.md', '.cursorrules'], create: null });
  assert.deepEqual(resolveAgentPaths(undefined, files([['CLAUDE.md', '@AGENTS.md\n']])), { inject: [], create: 'AGENTS.md' });
});

test('plan and apply write the block, refresh in place and preserve user text', async t => {
  const f = fixture(t);
  const installed = await plan(f.repo, { version: '1.2.3' });
  assert.deepEqual([installed.mode, installed.paths, installed.missing], ['install', ['AGENTS.md', 'CLAUDE.md'], []]);
  assert.deepEqual(await applyAgentDocs(f.repo, installed, noop), ['AGENTS.md', 'CLAUDE.md']);
  const first = readFileSync(join(f.repo, 'AGENTS.md'), 'utf8');
  assert.equal(first, agents + '\n' + block + '\n');
  // Claude Code reads CLAUDE.md, not AGENTS.md, so init adds a root file that only imports it.
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  const again = await plan(f.repo, { version: '1.2.3' });
  assert.deepEqual([again.paths, again.writes], [['AGENTS.md'], []]);
  f.write('AGENTS.md', first + '\n## Team rules\n\nNever push.\n');
  const before = fingerprint(f.repo);
  const upgraded = await plan(f.repo, { version: '2.0.0' });
  await applyAgentDocs(f.repo, upgraded, noop);
  const text = readFileSync(join(f.repo, 'AGENTS.md'), 'utf8');
  assert.equal(text, agents + '\n' + await render('2.0.0') + '\n\n## Team rules\n\nNever push.\n');
  assert.notDeepEqual(fingerprint(f.repo), before);
  assert.deepEqual(Object.keys(fingerprint(f.repo)).filter(k => !k.startsWith('.git/')), ['AGENTS.md', 'CLAUDE.md']);
  const removal = await plan(f.repo, { version: '2.0.0', remove: true });
  assert.deepEqual([removal.mode, removal.paths], ['remove', ['AGENTS.md']]);
  await applyAgentDocs(f.repo, removal, noop);
  assert.equal(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), agents + '\n## Team rules\n\nNever push.\n');
  // AGENTS.md keeps the user's rules, so the wrapper that imports them stays.
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  await applyAgentDocs(f.repo, await plan(f.repo, { version: '2.0.0' }), noop);
  f.write('AGENTS.md', agents + '\n' + await render('2.0.0') + '\n');
  const emptied = await plan(f.repo, { version: '2.0.0', remove: true });
  assert.deepEqual(emptied.paths, ['AGENTS.md', 'CLAUDE.md']);
  await applyAgentDocs(f.repo, emptied, noop);
  assert.equal(existsSync(join(f.repo, 'AGENTS.md')), false);
  assert.equal(existsSync(join(f.repo, 'CLAUDE.md')), false);
  assert.deepEqual(await plan(f.repo, { version: '2.0.0', remove: true }), { mode: 'remove', paths: [], writes: [], missing: [], language: 'ko' });
  assert.deepEqual(await plan(f.repo, { version: '2.0.0', skip: true }), { mode: 'skip', paths: [], writes: [], missing: [], language: 'ko' });
});

test('the CLAUDE.md wrapper is added only when no Claude file exists and never replaces user files', async t => {
  // An existing .claude/CLAUDE.md already reaches Claude Code, so no root file is added next to it.
  const f = fixture(t);
  f.write('AGENTS.md', '# Mine\n'); mkdirSync(join(f.repo, '.claude')); f.write('.claude/CLAUDE.md', '# Nested\n');
  assert.deepEqual((await plan(f.repo, { version: '1.0.0' })).paths, ['AGENTS.md', '.claude/CLAUDE.md']);
  // A preset that writes AGENTS.md adds it too, following the line endings of AGENTS.md.
  const g = fixture(t);
  g.write('AGENTS.md', '# Win\r\n');
  const cursor = await plan(g.repo, { version: '1.0.0', agent: 'cursor' });
  assert.deepEqual(cursor.paths, ['AGENTS.md', 'CLAUDE.md']);
  await applyAgentDocs(g.repo, cursor, noop);
  assert.equal(readFileSync(join(g.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\r\n');
  // An update plan reports the missing wrapper instead of creating it.
  const h = fixture(t);
  h.write('AGENTS.md', '# Mine\n\n' + block + '\n');
  const refresh = await plan(h.repo, { version: '1.2.3', onlyExisting: true });
  assert.deepEqual([refresh.paths, refresh.writes, refresh.missing], [['AGENTS.md'], [], ['CLAUDE.md']]);
  // A CLAUDE.md the user extended is kept even when removal deletes AGENTS.md.
  h.write('AGENTS.md', agents + '\n' + block + '\n'); h.write('CLAUDE.md', '@AGENTS.md\n\nAlso read docs/.\n');
  assert.deepEqual((await plan(h.repo, { version: '1.2.3', remove: true })).paths, ['AGENTS.md']);
});

test('presets, wrappers and malformed files on disk', async t => {
  const f = fixture(t);
  f.write('CLAUDE.md', '@AGENTS.md\n');
  await applyAgentDocs(f.repo, await plan(f.repo, { version: '1.0.0' }), noop);
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  assert.ok(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8').includes(AGENT_START));
  const claude = await plan(f.repo, { version: '1.0.0', agent: 'claude' });
  assert.deepEqual(claude.paths, ['CLAUDE.md']);
  await applyAgentDocs(f.repo, claude, noop);
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n\n' + await render('1.0.0') + '\n');
  // The next unscoped run takes the block back out of the wrapper.
  const cleanup = await plan(f.repo, { version: '1.0.0' });
  assert.deepEqual([cleanup.paths, cleanup.writes.map(w => w.path)], [['AGENTS.md'], ['CLAUDE.md']]);
  await applyAgentDocs(f.repo, cleanup, noop);
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  const cursor = await plan(f.repo, { version: '1.0.0', agent: 'cursor' });
  assert.deepEqual(cursor.paths, ['AGENTS.md']);
  const g = fixture(t);
  const nested = await plan(g.repo, { version: '1.0.0', agent: 'claude' });
  await applyAgentDocs(g.repo, nested, noop);
  assert.equal(readFileSync(join(g.repo, '.claude/CLAUDE.md'), 'utf8'), boilerplateFor('.claude/CLAUDE.md') + '\n' + await render('1.0.0') + '\n');
  assert.equal(existsSync(join(g.repo, 'AGENTS.md')), false);
  const h = fixture(t);
  h.write('AGENTS.md', AGENT_START + '\nbroken\n');
  const before = fingerprint(h.repo);
  await assert.rejects(plan(h.repo, { version: '1.0.0' }), { code: 'AGENT_DOCS_MALFORMED' });
  assert.deepEqual(fingerprint(h.repo), before);
  mkdirSync(join(h.repo, 'link-target'));
  writeFileSync(join(h.repo, 'AGENTS.md'), '# ok\n');
  const { symlinkSync } = await import('node:fs');
  symlinkSync(join(h.repo, 'link-target'), join(h.repo, '.claude'), 'junction');
  await assert.rejects(plan(h.repo, { version: '1.0.0', agent: 'claude' }), { code: 'PATH_CONFLICT' });
});

test('every block is written in one language: --lang, then the config, then the language an older block names', async t => {
  const f = fixture(t);
  // A block from 0.8.2 names its language in the header; a project whose config has none keeps it.
  f.write('AGENTS.md', '# Mine\n\n' + AGENT_START + '\n## Gitifact Guide\n\ngitifact v0.8.2 · en · storage schemaVersion 3\n' + AGENT_END + '\n');
  const bodies = { ko: 'ko body', en: 'en body' };
  const planned = options => planAgentDocs(f.repo, { version: '0.8.3', onlyExisting: true, readBlock: async lang => bodies[lang], ...options });
  const legacy = await planned({});
  assert.equal(legacy.language, 'en');
  assert.match(legacy.writes[0].next, /en body/);
  // The config wins over the old header, and the header is gone once the block is rewritten.
  const configured = await planned({ language: 'ko' });
  assert.equal(configured.language, 'ko');
  assert.match(configured.writes[0].next, /ko body/);
  assert.doesNotMatch(configured.writes[0].next, /gitifact v0\.8\.2/);
  // Neither: the display language decides.
  const g = fixture(t);
  assert.equal((await planAgentDocs(g.repo, { version: '0.8.3', readBlock: async lang => bodies[lang] })).language, 'ko');
});
