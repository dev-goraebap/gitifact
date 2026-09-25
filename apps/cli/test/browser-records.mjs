import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderDocumentFile, renderReasonLine } from '@gitifact/core';
import { storeReader } from '../.test-build/adapters/git/store-reader.js';
import { openCache } from '../.test-build/adapters/cache/index.js';
import { createCheckoutReader } from '../.test-build/server/checkout/checkout-reader.js';

/**
 * The browser's records as the server builds them: `read()` gives the checkout with the first page of history (up to
 * `limit` changes) beside it, `read.change(key)` one change with its text (from its commit, as the commit page reads it),
 * `read.history` the history in the cache and
 * `read.cache` the cache itself.
 */
export function openRecords(root, env, limit = 100) {
  const git = storeReader(root);
  const cache = openCache(root, { run: (args, input) => git.run(args, input), decode: git.decode, legacyBundles: oids => git.readBundles(oids) });
  const checkout = createCheckoutReader(root, 'fixture', cache, env);
  async function read() {
    const { checkout: current } = await checkout();
    if (!current.head) return { ...current, events: [], total: 0 };
    // History comes a page of whole commits at a time; the fixture reads on until it has `limit` changes.
    let events = []; let after; let total = 0;
    do { const page = await cache.history.commits(current.head, {}, after, 50); total = page.total; events.push(...page.events); after = page.next ?? undefined; }
    while (after && events.length < limit);
    return { ...current, events: events.slice(0, limit), total };
  }
  read.change = key => cache.history.commitChange(key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1));
  read.history = cache.history;
  read.cache = cache;
  read.checkout = checkout;
  return read;
}

/** Writes 0.8.0 documents into a fixture repository: `docs(f).requirement('posts', 'save', 'R-…', {…})`. */
export function docs(f) {
  const put = (path, text) => { mkdirSync(dirname(join(f.repo, path)), { recursive: true }); writeFileSync(join(f.repo, path), text); return path; };
  const doc = (kind, path, id, { title = id, description = title + ' 설명', body = title + ' 본문', ...rest } = {}) =>
    put(path, renderDocumentFile({ kind, path, id, title, description, body, feature: path.split('/')[2], order: 10, requirements: [], sources: [], ...rest }));
  return {
    put,
    feature: (folder, id, fields) => doc('feature', `.gitifact/spec/${folder}/index.md`, id, fields),
    requirement: (folder, slug, id, fields) => doc('requirement', `.gitifact/spec/${folder}/requirements/${slug}.md`, id, fields),
    design: (folder, slug, id, fields) => doc('design', `.gitifact/spec/${folder}/design/${slug}.md`, id, fields),
    wiki: (path, id, fields) => doc('wiki', `.gitifact/wiki/${path}`, id, fields),
    /** An instruction folder's index.md; `name` is the folder. */
    instruction: (name, id, fields) => doc('instruction', `.gitifact/instructions/${name}/index.md`, id, { name, ...fields }),
    /** Writes a record file: `record({ id, docs, reason })`, with the reason as its context and the title as its decision. */
    record: ({ id, docs, reason, title = reason, day = '20260924' }) => put(`.gitifact/records/${day}/${id}.md`,
      `---\nid: ${id}\ntitle: ${title}\ndocs:\n${docs.map(d => '  - ' + d + '\n').join('')}---\n\n`
      + `## 맥락\n\n${reason}\n\n## 결정\n\n${title}\n`),
    /** Appends lines to the reason file records replaced, `.gitifact/history.jsonl`, as commits before records did. */
    reasons: (...lines) => {
      const path = '.gitifact/history.jsonl';
      let text = ''; try { text = readFileSync(join(f.repo, path), 'utf8'); } catch { /* new file */ }
      return put(path, text + lines.map(l => renderReasonLine(l) + '\n').join(''));
    },
  };
}

/** The reason text of each record on an event: what a reason line or a record's context section says. */
export const reasonsOf = event => event.records.map(r => r.sections.find(s => s.key === 'context')?.body);
