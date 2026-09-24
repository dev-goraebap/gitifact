import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DocumentError, classifyDocPath, docProblem, isWikiPage, parseDocumentFile, HISTORY_PATH, INSTRUCTIONS_ROOT, SPEC_ROOT, WIKI_ROOT, type Doc, type DocProblem } from '@gitifact/core';
import { transaction, type CacheDatabase } from './database.js';
import { plain } from './search-text.js';

// A document file larger than this is not read; the check reports it instead. The walk stops at these many files.
const FILE_LIMIT = 1024 * 1024;
const COUNT_LIMIT = 20000;
const decode = (bytes: Buffer) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);

interface Seen { mtime: number; size: number; link: boolean }
/** The search row of one document: what the box matches on and what a hit shows. */
const place = (doc: Doc) => doc.path.replace(/^\.gitifact\//, '');

/**
 * The working tree's documents in the cache. Agents edit the files directly, so every read first compares each file's
 * modification time and size with what the cache last saw and parses only the files that differ. Deleting the cache
 * loses nothing: the next read parses every file again.
 */
export function createDocumentCache(root: string, database: CacheDatabase) {
  let syncing: Promise<void> | undefined;

  async function walk(): Promise<Map<string, Seen>> {
    const found = new Map<string, Seen>();
    async function visit(relative: string, depth: number) {
      const info = await lstat(join(root, ...relative.split('/'))).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
      if (!info || found.size >= COUNT_LIMIT) return;
      if (info.isDirectory() && !info.isSymbolicLink()) {
        if (depth > 10) return;
        for (const name of (await readdir(join(root, ...relative.split('/')))).sort()) await visit(relative + '/' + name, depth + 1);
        return;
      }
      found.set(relative, { mtime: info.mtimeMs, size: info.size, link: info.isSymbolicLink() || !info.isFile() });
    }
    await visit(SPEC_ROOT, 0); await visit(WIKI_ROOT, 0); await visit(INSTRUCTIONS_ROOT, 0);
    return found;
  }

  async function read(path: string, seen: Seen): Promise<{ doc?: Doc; problem?: DocProblem }> {
    try {
      // Pages left from the wiki are named by the check and listed as unreadable until they are moved.
      if (isWikiPage(path)) return { problem: docProblem('WIKI_REMOVED', path) };
      if (classifyDocPath(path).type !== 'doc') return {};
      if (seen.link) return { problem: docProblem('PATH_UNSUPPORTED', path) };
      if (seen.size > FILE_LIMIT) return { problem: docProblem('FILE_TOO_LARGE', path) };
      return { doc: parseDocumentFile(path, decode(await readFile(join(root, ...path.split('/'))))) };
    } catch (error) {
      if (error instanceof DocumentError) return { problem: { code: error.code, path: error.path, message: error.message } };
      // Not UTF-8: the decoder refuses it.
      if (error instanceof TypeError) return { problem: docProblem('INVALID_CHARACTERS', path) };
      throw error;
    }
  }

  async function run() {
    const seen = await walk();
    const known = await database.with(db => new Map((db.prepare('SELECT path, mtime, size FROM files').all() as { path: string; mtime: number; size: number }[]).map(r => [r.path, r])));
    const changed = [...seen].filter(([path, s]) => { const k = known.get(path); return !k || k.mtime !== s.mtime || k.size !== s.size; });
    const gone = [...known.keys()].filter(path => !seen.has(path));
    if (!changed.length && !gone.length) return;
    const parsed = await Promise.all(changed.map(async ([path, s]) => ({ path, seen: s, ...await read(path, s) })));
    await database.with(db => transaction(db, () => {
      const forget = (path: string) => {
        const row = db.prepare('SELECT id FROM documents WHERE path = ?').get(path) as { id: string } | undefined;
        if (!row) return;
        db.prepare('DELETE FROM documents WHERE path = ?').run(path);
        db.prepare('DELETE FROM doc_references WHERE from_id = ?').run(row.id);
        db.prepare("DELETE FROM search WHERE scope = 'checkout' AND ref = ?").run(path);
      };
      for (const path of gone) { forget(path); db.prepare('DELETE FROM files WHERE path = ?').run(path); }
      const file = db.prepare('INSERT INTO files (path, mtime, size, problem) VALUES (?, ?, ?, ?) ON CONFLICT (path) DO UPDATE SET mtime = excluded.mtime, size = excluded.size, problem = excluded.problem');
      const document = db.prepare('INSERT INTO documents (path, id, kind, feature, title, description, ord, doc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const reference = db.prepare('INSERT INTO doc_references (from_id, to_id, type) VALUES (?, ?, ?)');
      const search = db.prepare('INSERT INTO search (scope, kind, ref, oid, payload, title, place, body) VALUES (?,?,?,?,?,?,?,?)');
      for (const p of parsed) {
        forget(p.path);
        file.run(p.path, p.seen.mtime, p.seen.size, p.problem ? JSON.stringify(p.problem) : null);
        const doc = p.doc; if (!doc) continue;
        const feature = doc.kind === 'wiki' || doc.kind === 'instruction' ? null : doc.feature;
        document.run(doc.path, doc.id, doc.kind, feature, doc.title, doc.description, doc.kind === 'requirement' || doc.kind === 'design' ? doc.order : null, JSON.stringify(doc));
        if (doc.kind === 'design') {
          for (const id of doc.requirements) reference.run(doc.id, id, 'requirement');
          for (const s of doc.sources) if ('id' in s) reference.run(doc.id, s.id, 'source');
        }
        // Search rows are keyed by path so a moved or deleted file takes its row with it.
        const body = plain(doc.body);
        search.run('checkout', doc.kind, doc.path, null, JSON.stringify({ id: doc.id, title: doc.title, where: place(doc), body, feature }),
          doc.title.toLowerCase(), place(doc).toLowerCase(), (doc.description + ' ' + body).toLowerCase());
      }
    }));
  }

  /** Brings the cache up to date with the working tree. Concurrent callers in one process share a run. */
  function sync(): Promise<void> {
    syncing ??= run().finally(() => { syncing = undefined; });
    return syncing;
  }

  /** Whether a walked path is read as a document or reason source; unknown paths are kept so the check names them. */
  const readable = (path: string) => { try { return classifyDocPath(path).type !== 'ignored'; } catch { return true; } };
  const instructionFile = (path: string) => { try { return classifyDocPath(path).type === 'instruction-file'; } catch { return false; } };

  return {
    sync,
    /**
     * The text of every document and reason file in the working tree, for the whole-set check and for commits,
     * which need the files themselves rather than what the cache parsed. A file that cannot be read as text is a
     * problem instead of an entry.
     */
    async files(): Promise<{ files: Map<string, string>; problems: DocProblem[] }> {
      const seen = await walk();
      const history = await lstat(join(root, ...HISTORY_PATH.split('/'))).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
      if (history) seen.set(HISTORY_PATH, { mtime: history.mtimeMs, size: history.size, link: history.isSymbolicLink() || !history.isFile() });
      const files = new Map<string, string>(); const problems: DocProblem[] = [];
      for (const [path, s] of seen) {
        if (!readable(path)) continue;
        // The other files of an instruction folder are references and images: the check needs their paths, and the
        // text of the Markdown ones only, for the links an instruction must not make.
        if (instructionFile(path) && !path.endsWith('.md')) { files.set(path, ''); continue; }
        if (s.link) { problems.push(docProblem('PATH_UNSUPPORTED', path)); continue; }
        // The reason file grows with every commit, so it alone may pass the one-document limit.
        if (s.size > (path === HISTORY_PATH ? 64 * FILE_LIMIT : FILE_LIMIT)) { problems.push(docProblem('FILE_TOO_LARGE', path)); continue; }
        try { files.set(path, decode(await readFile(join(root, ...path.split('/'))))); }
        catch (error) { if (error instanceof TypeError) problems.push(docProblem('INVALID_CHARACTERS', path)); else throw error; }
      }
      return { files, problems };
    },
    /** Every readable document of the working tree and the files that could not be read, after a sync. */
    async list(): Promise<{ documents: Doc[]; problems: DocProblem[] }> {
      await sync();
      return database.with(db => ({
        documents: (db.prepare('SELECT doc FROM documents ORDER BY path').all() as { doc: string }[]).map(r => JSON.parse(r.doc) as Doc),
        problems: (db.prepare('SELECT problem FROM files WHERE problem IS NOT NULL ORDER BY path').all() as { problem: string }[]).map(r => JSON.parse(r.problem) as DocProblem),
      }));
    },
    /** Documents that refer to `id` from their frontmatter: designs naming a requirement or a source. */
    async referencing(id: string): Promise<{ from: string; type: string }[]> {
      await sync();
      return database.with(db => (db.prepare('SELECT from_id AS "from", type FROM doc_references WHERE to_id = ? ORDER BY from_id').all(id) as { from: string; type: string }[]).map(r => ({ from: r.from, type: r.type })));
    },
  };
}
