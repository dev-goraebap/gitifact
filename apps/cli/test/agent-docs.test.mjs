import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_END, AGENT_START, boilerplateFor, injectBlock, isWrapperFile, parseAgentBlock, removeBlock, renderAgentBlock, resolveAgentPaths } from '../.test-build/commands/agent-block.js';
import { applyAgentDocs, planAgentDocs } from '../.test-build/commands/agent-docs.js';
import { fileURLToPath } from 'node:url';
import { fixture, fingerprint } from './git-fixture.mjs';

// The block body ships as Markdown next to the built entry point, so unit tests read the source instead.
const source = readFileSync(fileURLToPath(new URL('../src/shared/i18n/ko/block.md', import.meta.url)), 'utf8');
const controls = { readBlock: async () => source };
const render = version => renderAgentBlock(version, controls);
const plan = (root, options) => planAgentDocs(root, { ...options, ...controls });
const block = await render('1.2.3');
const agents = boilerplateFor('AGENTS.md');
const noop = async () => {};

test('rendered block is versioned, marker-delimited, Markdown-structured and short', () => {
  const lines = block.split('\n');
  assert.equal(lines[0], AGENT_START); assert.equal(lines.at(-1), AGENT_END);
  // A heading opens the block and a rule closes it, so it reads as its own section beside the user's text.
  assert.equal(lines[1], '## Gitifact Guide'); assert.equal(lines.at(-2), '---'); assert.equal(lines.at(-3), '');
  assert.equal(lines[3], 'gitifact v1.2.3 · ko · 저장 규약 schemaVersion 2');
  // Markdown joins consecutive plain lines, so every non-blank line must be a heading, list item, table row or its own paragraph.
  for (const [index, line] of lines.entries()) {
    if (!line || /^(#{2,3} |- |\| |---$|<!--)/.test(line)) continue;
    assert.ok(!lines[index + 1] || /^\| /.test(line), 'plain line runs into the next: ' + line);
  }
  assert.ok(block.includes('npm install -g gitifact@1.2.3'), 'install hint pins the block version');
  assert.ok(lines.length >= 25 && lines.length <= 50, String(lines.length));
  assert.deepEqual(parseAgentBlock(block), { version: '1.2.3', language: 'ko', schemaVersion: 2 });
  assert.equal(parseAgentBlock('no block'), null);
  for (const topic of ['docs spec', 'docs commit', 'docs <topic>', 'spec working', 'SELF-CHECK']) assert.ok(block.includes(topic), topic);
  assert.equal(boilerplateFor('.claude/CLAUDE.md'), '# CLAUDE\n\nProject-specific guidance for AI coding agents.\n');
  assert.equal(boilerplateFor('.cursorrules'), '# cursorrules\n\nProject-specific guidance for AI coding agents.\n');
});

test('the header parses with and without the language token', () => {
  // Blocks written before the language token existed are Korean; they must stay readable.
  assert.deepEqual(parseAgentBlock('gitifact v0.3.1 · 저장 규약 schemaVersion 1'), { version: '0.3.1', language: 'ko', schemaVersion: 1 });
  assert.deepEqual(parseAgentBlock('gitifact v0.3.1 · ko · 저장 규약 schemaVersion 1'), { version: '0.3.1', language: 'ko', schemaVersion: 1 });
  // The text between the language and schemaVersion is localized, so a future language still parses.
  assert.deepEqual(parseAgentBlock('gitifact v1.0.0 · en · storage schemaVersion 2'), { version: '1.0.0', language: 'en', schemaVersion: 2 });
  assert.equal(parseAgentBlock('gitifact 0.3.1 schemaVersion 1'), null);
});

test('the block summary matches the workflow document it summarizes', () => {
  // The block abbreviates the handling column, so only the example requests are compared. A request that
  // exists in the block but not in the source table would teach agents a rule the full document never states.
  const workflow = ['workflow.md', 'workflow.default.md'].map(name => readFileSync(fileURLToPath(new URL('../src/shared/i18n/ko/docs/' + name, import.meta.url)), 'utf8')).join('\n');
  const requests = text => text.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| ---')).map(line => line.split(' | ')[0]);
  const rows = block.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| ---') && !line.startsWith('| 요청 '));
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
  assert.equal(injectBlock(crlf, newer, agents), crlf.replace('v1.2.3', 'v2.0.0').replace('gitifact@1.2.3', 'gitifact@2.0.0'));
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
  assert.deepEqual(await plan(f.repo, { version: '2.0.0', remove: true }), { mode: 'remove', paths: [], writes: [], missing: [] });
  assert.deepEqual(await plan(f.repo, { version: '2.0.0', skip: true }), { mode: 'skip', paths: [], writes: [], missing: [] });
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
