import { browserCommitQueryV1, browserCommitV3, browserCommitFileQueryV1, browserCommitFileV1, browserCommitFilesQueryV1, browserCommitFilesV1, browserHistoryQueryV3, browserHistorySummaryQueryV1, browserHistorySummaryV4, browserHistoryV5, browserSearchQueryV1, browserSearchV2, browserInstructionFileQueryV1, browserInstructionFileV1, browserRecordQueryV1, browserRecordV1 } from '@gitifact/contracts';
import { storeReader } from '../../adapters/git/store-reader.js';
import { openCache } from '../../adapters/cache/index.js';
import { createCheckoutReader } from '../checkout/checkout-reader.js';
import { createCommitFiles } from '../commit/commit-files.js';
import { readInstructionFile } from '../../adapters/filesystem/instruction-folder.js';
import { HttpError } from '../http/respond.js';
import { ok, route } from '../http/router.js';
import { t } from '../../shared/i18n/index.js';

/** A page of history unless the reader asks for another size. */
const PAGE = 50;

/**
 * The records: the checkout (current features, instructions and AGENTS.md, sent whole), and history, which the server filters, pages,
 * counts and searches over all of it. Both come from the cache the CLI uses too (`.gitifact/cache/index.db`).
 */
export function recordRoutes(root: string, sessionId: string, env?: NodeJS.ProcessEnv) {
  const git = storeReader(root);
  // The 0.7 reader serves the history before a migration; it is read-only and goes with the 0.7 parser at 1.0.0.
  const cache = openCache(root, { run: (args, input) => git.run(args, input), decode: git.decode, legacyBundles: oids => git.readBundles(oids) });
  const readCheckout = createCheckoutReader(root, sessionId, cache, env);
  const commitFiles = createCommitFiles(git);
  const unreadable = () => t('server.specsUnreadable');

  return [
    route({ method: 'GET', path: '/api/v1/specs', session: true, unreadable, handle: async () => ok((await readCheckout()).checkout) }),
    route({ method: 'GET', path: '/api/v1/history', session: true, query: browserHistoryQueryV3, unreadable, handle: async ({ query }) => {
      const offset = query.offset ?? 0;
      const page = await cache.history.page(query.head, { kind: query.kind, document: query.document, feature: query.feature, author: query.author, q: query.q }, offset, query.limit ?? PAGE);
      return ok(browserHistoryV5.parse({ contract: 'browser-history', version: 5, sessionId, head: query.head, offset, ...page }));
    } }),
    route({ method: 'GET', path: '/api/v1/history/summary', session: true, query: browserHistorySummaryQueryV1, unreadable, handle: async ({ query }) =>
      ok(browserHistorySummaryV4.parse({ contract: 'browser-history-summary', version: 4, sessionId, head: query.head, ...await cache.history.summary(query.head) })) }),
    // One commit as its page reads it: its documents with both sides, and who made it even when it changed none.
    route({ method: 'GET', path: '/api/v1/commit', session: true, query: browserCommitQueryV1, unreadable, handle: async ({ query }) => {
      const changes = await cache.history.ofCommit(query.commit);
      const first = changes[0]?.event;
      // A commit that changed no document still has a page: its source files. Git names its author then.
      const line = first ? [] : git.decode(await git.run(['log', '-1', '--format=%aN%x00%aE%x00%cN%x00%aI%x00%s', query.commit, '--']).catch(() => Buffer.from(''))).split('\0');
      if (!first && line.length < 5) throw new HttpError(404, 'NOT_FOUND', t('server.commitNotFound'));
      const [author, email, committer, date, message] = first
        ? [first.author, first.email, first.committer, first.date, first.message]
        : [line[0] ?? '', line[1] ?? '', line[2] ?? '', line[3] ?? '', (line[4] ?? '').replace(/\n$/, '')];
      return ok(browserCommitV3.parse({ contract: 'browser-commit', version: 3, sessionId, commit: query.commit, author, email, committer, date, message, changes }));
    } }),
    // A record's page names the record; which commit added it is read from the history of the HEAD the reader is on.
    route({ method: 'GET', path: '/api/v1/record', session: true, query: browserRecordQueryV1, unreadable, handle: async ({ query }) => {
      const commit = await cache.history.commitOfRecord(query.head, query.id);
      if (!commit) throw new HttpError(404, 'NOT_FOUND', t('server.recordNotFound'));
      return ok(browserRecordV1.parse({ contract: 'browser-record', version: 1, sessionId, head: query.head, id: query.id, commit }));
    } }),

    // The source a commit changed beside its documents, read from Git when the commit or record page asks for it.
    route({ method: 'GET', path: '/api/v1/commit/files', session: true, query: browserCommitFilesQueryV1, unreadable, handle: async ({ query }) => {
      const found = await commitFiles.files(query.commit);
      if (!found) throw new HttpError(404, 'NOT_FOUND', t('server.commitNotFound'));
      return ok(browserCommitFilesV1.parse({ contract: 'browser-commit-files', version: 1, sessionId, commit: found.commit, total: found.total, files: found.files }));
    } }),
    route({ method: 'GET', path: '/api/v1/commit/file', session: true, query: browserCommitFileQueryV1, unreadable, handle: async ({ query }) => {
      const found = await commitFiles.file(query.commit, query.path);
      if (!found) throw new HttpError(404, 'NOT_FOUND', t('server.commitFileNotFound'));
      return ok(browserCommitFileV1.parse({ contract: 'browser-commit-file', version: 1, sessionId, commit: query.commit, ...found }));
    } }),
    // One file of an instruction folder, read from the working tree when the reader opens it; the checkout lists the files.
    route({ method: 'GET', path: '/api/v1/instructions/file', session: true, query: browserInstructionFileQueryV1, unreadable, handle: async ({ query }) => {
      const instruction = (await cache.documents.list()).documents.find(d => d.id === query.id && d.kind === 'instruction');
      const found = instruction && await readInstructionFile(root, instruction.path, query.path);
      if (!found) throw new HttpError(404, 'NOT_FOUND', t('server.instructionFileNotFound'));
      return ok(browserInstructionFileV1.parse({ contract: 'browser-instruction-file', version: 1, sessionId, id: query.id, path: query.path, ...found }));
    } }),
    route({ method: 'GET', path: '/api/v1/search', session: true, query: browserSearchQueryV1, unreadable, handle: async ({ query }) =>
      ok(browserSearchV2.parse({ contract: 'browser-search', version: 2, sessionId, query: query.q, hits: await cache.search(query.head ?? null, query.q) })) }),
  ];
}
