import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_END, AGENT_START, boilerplateFor, injectBlock, isWrapperFile, parseAgentBlock, removeBlock, renderAgentBlock, resolveAgentPaths } from '../.test-build/commands/agent-block.js';
import { applyAgentDocs, planAgentDocs } from '../.test-build/commands/agent-docs.js';
import { fixture, fingerprint } from './git-fixture.mjs';

const block = renderAgentBlock('1.2.3');
const agents = boilerplateFor('AGENTS.md');
const noop = async () => {};

test('rendered block is versioned, marker-delimited and about thirty lines', () => {
  const lines = block.split('\n');
  assert.equal(lines[0], AGENT_START); assert.equal(lines.at(-1), AGENT_END);
  assert.equal(lines[1], 'gitifact v1.2.3 · 저장 규약 schemaVersion 1');
  assert.ok(lines.length >= 25 && lines.length <= 40, String(lines.length));
  assert.deepEqual(parseAgentBlock(block), { version: '1.2.3', schemaVersion: 1 });
  assert.equal(parseAgentBlock('no block'), null);
  for (const topic of ['docs spec', 'docs commit', 'docs <topic>', 'spec working', 'SELF-CHECK']) assert.ok(block.includes(topic), topic);
  assert.equal(boilerplateFor('.claude/CLAUDE.md'), '# CLAUDE\n\nProject-specific guidance for AI coding agents.\n');
  assert.equal(boilerplateFor('.cursorrules'), '# cursorrules\n\nProject-specific guidance for AI coding agents.\n');
});

test('inject creates, appends, replaces idempotently and keeps CRLF', () => {
  const created = injectBlock(null, block, agents);
  assert.equal(created, agents + '\n' + block + '\n');
  const appended = injectBlock('# Mine\n\nKeep this.\n\n\n', block, agents);
  assert.equal(appended, '# Mine\n\nKeep this.\n\n' + block + '\n');
  assert.equal(injectBlock(appended, block, agents), appended);
  const newer = renderAgentBlock('2.0.0');
  const replaced = injectBlock(appended + '\n## After\n', newer, agents);
  assert.equal(replaced, '# Mine\n\nKeep this.\n\n' + newer + '\n\n## After\n');
  assert.equal(injectBlock('', block, agents), block + '\n');
  const crlf = injectBlock('# Win\r\n\r\nText\r\n', block, agents);
  assert.equal(crlf, '# Win\r\n\r\nText\r\n\r\n' + block.split('\n').join('\r\n') + '\r\n');
  assert.equal(crlf.includes('\n\n'), false);
  assert.equal(injectBlock(crlf, newer, agents), crlf.replace('v1.2.3', 'v2.0.0'));
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
  const plan = await planAgentDocs(f.repo, { version: '1.2.3' });
  assert.deepEqual([plan.mode, plan.paths], ['install', ['AGENTS.md']]);
  assert.deepEqual(await applyAgentDocs(f.repo, plan, noop), ['AGENTS.md']);
  const first = readFileSync(join(f.repo, 'AGENTS.md'), 'utf8');
  assert.equal(first, agents + '\n' + block + '\n');
  const again = await planAgentDocs(f.repo, { version: '1.2.3' });
  assert.deepEqual([again.paths, again.writes], [['AGENTS.md'], []]);
  f.write('AGENTS.md', first + '\n## Team rules\n\nNever push.\n');
  const before = fingerprint(f.repo);
  const upgraded = await planAgentDocs(f.repo, { version: '2.0.0' });
  await applyAgentDocs(f.repo, upgraded, noop);
  const text = readFileSync(join(f.repo, 'AGENTS.md'), 'utf8');
  assert.equal(text, agents + '\n' + renderAgentBlock('2.0.0') + '\n\n## Team rules\n\nNever push.\n');
  assert.notDeepEqual(fingerprint(f.repo), before);
  assert.deepEqual(Object.keys(fingerprint(f.repo)).filter(k => !k.startsWith('.git/')), ['AGENTS.md']);
  const removal = await planAgentDocs(f.repo, { version: '2.0.0', remove: true });
  assert.deepEqual([removal.mode, removal.paths], ['remove', ['AGENTS.md']]);
  await applyAgentDocs(f.repo, removal, noop);
  assert.equal(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), agents + '\n## Team rules\n\nNever push.\n');
  await applyAgentDocs(f.repo, await planAgentDocs(f.repo, { version: '2.0.0' }), noop);
  f.write('AGENTS.md', agents + '\n' + renderAgentBlock('2.0.0') + '\n');
  await applyAgentDocs(f.repo, await planAgentDocs(f.repo, { version: '2.0.0', remove: true }), noop);
  assert.equal(existsSync(join(f.repo, 'AGENTS.md')), false);
  assert.deepEqual(await planAgentDocs(f.repo, { version: '2.0.0', remove: true }), { mode: 'remove', paths: [], writes: [] });
  assert.deepEqual(await planAgentDocs(f.repo, { version: '2.0.0', skip: true }), { mode: 'skip', paths: [], writes: [] });
});

test('presets, wrappers and malformed files on disk', async t => {
  const f = fixture(t);
  f.write('CLAUDE.md', '@AGENTS.md\n');
  await applyAgentDocs(f.repo, await planAgentDocs(f.repo, { version: '1.0.0' }), noop);
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  assert.ok(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8').includes(AGENT_START));
  const claude = await planAgentDocs(f.repo, { version: '1.0.0', agent: 'claude' });
  assert.deepEqual(claude.paths, ['CLAUDE.md']);
  await applyAgentDocs(f.repo, claude, noop);
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n\n' + renderAgentBlock('1.0.0') + '\n');
  // The next unscoped run takes the block back out of the wrapper.
  const cleanup = await planAgentDocs(f.repo, { version: '1.0.0' });
  assert.deepEqual([cleanup.paths, cleanup.writes.map(w => w.path)], [['AGENTS.md'], ['CLAUDE.md']]);
  await applyAgentDocs(f.repo, cleanup, noop);
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  const cursor = await planAgentDocs(f.repo, { version: '1.0.0', agent: 'cursor' });
  assert.deepEqual(cursor.paths, ['AGENTS.md']);
  const g = fixture(t);
  const nested = await planAgentDocs(g.repo, { version: '1.0.0', agent: 'claude' });
  await applyAgentDocs(g.repo, nested, noop);
  assert.equal(readFileSync(join(g.repo, '.claude/CLAUDE.md'), 'utf8'), boilerplateFor('.claude/CLAUDE.md') + '\n' + renderAgentBlock('1.0.0') + '\n');
  assert.equal(existsSync(join(g.repo, 'AGENTS.md')), false);
  const h = fixture(t);
  h.write('AGENTS.md', AGENT_START + '\nbroken\n');
  const before = fingerprint(h.repo);
  await assert.rejects(planAgentDocs(h.repo, { version: '1.0.0' }), { code: 'AGENT_DOCS_MALFORMED' });
  assert.deepEqual(fingerprint(h.repo), before);
  mkdirSync(join(h.repo, 'link-target'));
  writeFileSync(join(h.repo, 'AGENTS.md'), '# ok\n');
  const { symlinkSync } = await import('node:fs');
  symlinkSync(join(h.repo, 'link-target'), join(h.repo, '.claude'), 'junction');
  await assert.rejects(planAgentDocs(h.repo, { version: '1.0.0', agent: 'claude' }), { code: 'PATH_CONFLICT' });
});
