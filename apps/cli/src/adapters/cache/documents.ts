import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DocumentError, classifyDocPath, docProblem, isWikiPage, parseDocumentFile, HISTORY_PATH, INSTRUCTIONS_ROOT, SPEC_ROOT, WIKI_ROOT, type Doc, type DocProblem } from '@gitifact/core';
import { transaction, type CacheDatabase } from './database.js';
import { containing, plain, snippet } from './search-text.js';

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

  /**
   * Every file under the document roots with its modification time and size. The entries of a folder are looked at
   * side by side: opening files is what a walk costs, and asking for many at once is about three times faster than
   * one after another. The result is sorted by path, so it does not depend on which answer came first.
   */
  async function walk(): Promise<Map<string, Seen>> {
    const found: [string, Seen][] = [];
    async function visit(relative: string, depth: number): Promise<void> {
      const info = await lstat(join(root, ...relative.split('/'))).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
      // Past the limit the walk keeps going a little so the files kept are the first by path, not the first to answer.
      if (!info || found.length >= 2 * COUNT_LIMIT) return;
      if (info.isDirectory() && !info.isSymbolicLink()) {
        if (depth > 10) return;
        await Promise.all((await readdir(join(root, ...relative.split('/')))).map(name => visit(relative + '/' + name, depth + 1)));
        return;
      }
      found.push([relative, { mtime: info.mtimeMs, size: info.size, link: info.isSymbolicLink() || !info.isFile() }]);
    }
    await Promise.all([visit(SPEC_ROOT, 0), visit(WIKI_ROOT, 0), visit(INSTRUCTIONS_ROOT, 0)]);
    found.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return new Map(found.slice(0, COUNT_LIMIT));
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
      // Read side by side, then gathered in path order so the result does not depend on which read finished first.
      const read = await Promise.all([...seen].map(async ([path, s]): Promise<{ path: string; text?: string; problem?: DocProblem }> => {
        if (!readable(path)) return { path };
        // The other files of an instruction folder are references and images: the check needs their paths, and the
        // text of the Markdown ones only, for the links an instruction must not make.
        if (instructionFile(path) && !path.endsWith('.md')) return { path, text: '' };
        if (s.link) return { path, problem: docProblem('PATH_UNSUPPORTED', path) };
        // The reason file grows with every commit, so it alone may pass the one-document limit.
        if (s.size > (path === HISTORY_PATH ? 64 * FILE_LIMIT : FILE_LIMIT)) return { path, problem: docProblem('FILE_TOO_LARGE', path) };
        try { return { path, text: decode(await readFile(join(root, ...path.split('/')))) }; }
        catch (error) { if (error instanceof TypeError) return { path, problem: docProblem('INVALID_CHARACTERS', path) }; throw error; }
      }));
      const files = new Map<string, string>(); const problems: DocProblem[] = [];
      for (const r of read) { if (r.text !== undefined) files.set(r.path, r.text); if (r.problem) problems.push(r.problem); }
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
    /**
     * Every working document whose title, place, description or text holds the query, by ID with the line that
     * matched: what `--q` of the lists filters by. The same search rows as the browser's search box.
     */
    async matching(raw: string): Promise<Map<string, string>> {
      const query = raw.trim().toLowerCase();
      if (!query) return new Map();
      await sync();
      return database.with(db => {
        // Pattern characters are matched literally with instr, which scans but is never wrong; LIKE uses the index.
        const literal = /[\\%_]/.test(query);
        const match = (column: string) => literal ? `instr(${column}, ?) > 0` : `${column} LIKE ?`;
        const needle = literal ? query : containing(query);
        const rows = db.prepare(`SELECT payload FROM search WHERE scope = 'checkout' AND (${match('title')} OR ${match('place')} OR ${match('body')})`)
          .all(needle, needle, needle) as { payload: string }[];
        return new Map(rows.map(r => { const p = JSON.parse(r.payload) as { id: string; body: string }; return [p.id, snippet(p.body, query)]; }));
      });
    },
    /**
     * The working documents of one kind whose title, place or text holds the query, a page at a time: a title that
     * starts with it first, then a title, a place, and the text; by title within each. `after` is the ID of the last
     * hit of the page before; one that no longer matches answers undefined. Each hit names its feature's ID.
     */
    async searchKind(kind: 'feature' | 'requirement' | 'design' | 'instruction', raw: string, after: string | undefined, limit: number) {
      const query = raw.trim().toLowerCase();
      await sync();
      return database.with(db => {
        // The trigram index answers LIKE from three characters on; pattern characters are matched literally with instr.
        const literal = /[\\%_]/.test(query);
        const match = (column: string) => literal ? `instr(${column}, :q) > 0` : `${column} LIKE :like`;
        const ordered = `WITH hits AS (
            SELECT json_extract(payload, '$.id') AS id, payload, title, ref,
              CASE WHEN substr(title, 1, length(:q)) = :q THEN 0 WHEN instr(title, :q) > 0 THEN 1 WHEN instr(place, :q) > 0 THEN 2 ELSE 3 END AS rank
            FROM search WHERE scope = 'checkout' AND kind = :kind AND (${match('title')} OR ${match('place')} OR ${match('body')})),
          ordered AS (SELECT *, row_number() OVER (ORDER BY rank, title, ref) AS n FROM hits)`;
        const params = { q: query, kind, ...(literal ? {} : { like: containing(query) }) };
        const total = Number((db.prepare(`${ordered} SELECT count(*) AS n FROM ordered`).get(params) as { n: number }).n);
        let start = 0;
        if (after !== undefined) {
          const at = db.prepare(`${ordered} SELECT n FROM ordered WHERE id = :after`).get({ ...params, after }) as { n: number } | undefined;
          if (!at) return undefined;
          start = Number(at.n);
        }
        const rows = db.prepare(`${ordered} SELECT payload FROM ordered WHERE n > :start ORDER BY n LIMIT :limit`).all({ ...params, start, limit: limit + 1 }) as { payload: string }[];
        const features = new Map((db.prepare("SELECT feature, id FROM documents WHERE kind = 'feature'").all() as { feature: string; id: string }[]).map(r => [r.feature, r.id]));
        const hits = rows.slice(0, limit).map(r => {
          const p = JSON.parse(r.payload) as { id: string; title: string; where: string; body: string; feature: string | null };
          const featureId = p.feature ? features.get(p.feature) : undefined;
          return { id: p.id, kind, title: p.title, where: p.where, line: snippet(p.body, query), ...(featureId ? { featureId } : {}) };
        });
        return { total, next: rows.length > limit ? hits[hits.length - 1]!.id : null, hits };
      });
    },
    /** Documents that refer to `id` from their frontmatter: designs naming a requirement or a source. */
    async referencing(id: string): Promise<{ from: string; type: string }[]> {
      await sync();
      return database.with(db => (db.prepare('SELECT from_id AS "from", type FROM doc_references WHERE to_id = ? ORDER BY from_id').all(id) as { from: string; type: string }[]).map(r => ({ from: r.from, type: r.type })));
    },
  };
}
