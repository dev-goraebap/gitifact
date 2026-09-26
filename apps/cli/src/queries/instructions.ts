import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { InstructionDoc } from '@gitifact/core';
import { readInstructionFiles } from '../adapters/filesystem/instruction-folder.js';
import { documentStates } from './document-states.js';
import { byAuthor, type Change } from './filters.js';
import { pageOf, type PageRequest } from './paging.js';
import type { ListSource } from './specs.js';

const AGENTS = 'AGENTS.md';
export interface InstructionFilter { q?: string | undefined; author?: string | undefined; sort: 'name' | 'updated'; withUpdated?: boolean | undefined }

/**
 * `instructions list`: where AGENTS.md is, since its index says which instruction a kind of work reads, then each
 * instruction with the files of its folder besides index.md, each by its title and description, so an agent opens
 * only the ones the work needs. Each says where it stands against the last commit, and an instruction deleted since is
 * listed as to be deleted; its folder is gone, so it lists no files. A cursor that is gone answers undefined.
 */
export async function listInstructions(source: ListSource & { root: string }, options: InstructionFilter, request: PageRequest) {
  const listed = await source.cache.documents.list(); const problems = listed.problems;
  const states = await documentStates(source, listed.documents);
  const documents = states.documents;
  const agents = { path: AGENTS, exists: !!(await lstat(join(source.root, AGENTS)).catch(() => undefined))?.isFile() };
  const historyNeeded = options.sort === 'updated' || options.author !== undefined || !!options.withUpdated;
  const latest = new Map<string, Change>();
  // Each document's place in HEAD's history, newest first: the order of commits, not their dates, which may tie.
  const newest = new Map<string, number>();
  let touched: Set<string> | undefined;
  if (historyNeeded) {
    const head = await source.head();
    const changes = head ? await source.cache.history.changesOf(head) : [];
    changes.forEach((c, rank) => { if (!latest.has(c.id)) { latest.set(c.id, { commit: c.commit, date: c.date, author: c.author, email: c.email }); newest.set(c.id, rank); } });
    if (options.author !== undefined) { const by = byAuthor(options.author); touched = new Set(changes.filter(by).map(c => c.id)); }
  }
  const matched = options.q !== undefined ? await source.cache.documents.matching(options.q) : undefined;
  const instructions = documents.filter((d): d is InstructionDoc => d.kind === 'instruction')
    .filter(d => (!touched || touched.has(d.id)) && (!matched || matched.has(d.id)))
    .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const rows = await Promise.all(instructions.map(async d => {
    const state = states.state(d.id);
    const { files, limited } = state === 'deleted' ? { files: [], limited: false } : await readInstructionFiles(source.root, d.path);
    return {
      id: d.id, name: d.name, path: d.path, title: d.title, description: d.description, ...(d.draft ? { draft: true } : {}),
      state, ...(states.previousPath(d.id) ? { previousPath: states.previousPath(d.id) } : {}),
      files, ...(limited ? { filesLimited: true } : {}),
      ...(historyNeeded ? { updated: latest.get(d.id) ?? null } : {}),
      ...(matched ? { line: matched.get(d.id)! } : {}),
    };
  }));
  if (options.sort === 'updated') rows.sort((a, b) => (newest.get(a.id) ?? Infinity) - (newest.get(b.id) ?? Infinity));
  const page = pageOf(rows, r => r.id, request);
  if (!page) return undefined;
  return { agents, problems, page };
}
