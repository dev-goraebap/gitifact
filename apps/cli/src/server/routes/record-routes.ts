import { browserCommitChangeQueryV1, browserCommitChangeV1, browserCommitQueryV2, browserCommitV4, browserCommitFileQueryV1, browserCommitFileV1, browserCommitFilesQueryV2, browserCommitFilesV2,
  browserHistoryQueryV4, browserHistorySummaryQueryV1, browserHistorySummaryV4, browserHistoryV6, browserSearchQueryV2, browserSearchV3, browserInstructionFileQueryV1, browserInstructionFileV1,
  browserRecordQueryV1, browserRecordV1, browserStampV1, browserWorkingChangeQueryV1, browserWorkingChangeV1, browserWorkingV1 } from '@gitifact/contracts';
import { storeReader } from '../../adapters/git/store-reader.js';
import { openCache } from '../../adapters/cache/index.js';
import { readPendingRecords } from '../../adapters/git/pending-records.js';
import { createCheckoutReader } from '../checkout/checkout-reader.js';
import { createStampReader } from '../checkout/stamp.js';
import { createCommitFiles } from '../commit/commit-files.js';
import { readInstructionFile } from '../../adapters/filesystem/instruction-folder.js';
import { workingChange, workingOverview, type WorkingSource } from '../../queries/working-changes.js';
import { searchRecords } from '../../queries/search.js';
import type { ListSource } from '../../queries/specs.js';
import { HttpError } from '../http/respond.js';
import { ok, route } from '../http/router.js';
import { t } from '../../shared/i18n/index.js';

/** Commits of history and changes of one commit a page holds unless the reader asks for another size. */
const PAGE = 20;

/**
 * The records: the checkout (current features, instructions and AGENTS.md, sent whole), history, which the server
 * filters, pages by commit, counts and searches over all of it, and the uncommitted work. They come from the cache the
 * CLI uses too (`.gitifact/cache/index.db`) and from the same queries (`apps/cli/src/queries/`).
 */
export function recordRoutes(root: string, sessionId: string, env?: NodeJS.ProcessEnv) {
  const git = storeReader(root);
  // The 0.7 reader serves the history before a migration; it is read-only and goes with the 0.7 parser at 1.0.0.
  const cache = openCache(root, { run: (args, input) => git.run(args, input), decode: git.decode, legacyBundles: oids => git.readBundles(oids) });
  const readCheckout = createCheckoutReader(root, sessionId, cache, env);
  const readStamp = createStampReader(root, env);
  const commitFiles = createCommitFiles(git);
  // What the list queries read: the same HEAD, Git and cache as the CLI's project.
  const source: ListSource = { head: async () => (await git.baseline()).head, reader: git, cache };
  const working: WorkingSource = { head: async () => (await git.baseline()).head, cache, pendingRecords: () => readPendingRecords(root, args => git.run(args)) };
  const unreadable = () => t('server.specsUnreadable');
  const cursorGone = () => new HttpError(404, 'NOT_FOUND', t('server.cursorNotFound'));

  return [
    route({ method: 'GET', path: '/api/v1/specs', session: true, unreadable, handle: async () => ok((await readCheckout()).checkout) }),
    // Whether the screen is behind, asked when the reader comes back to the tab; cheap enough to ask every time.
    route({ method: 'GET', path: '/api/v1/stamp', session: true, unreadable, handle: async () =>
      ok(browserStampV1.parse({ contract: 'browser-stamp', version: 1, sessionId, stamp: await readStamp() })) }),
    route({ method: 'GET', path: '/api/v1/history', session: true, query: browserHistoryQueryV4, unreadable, handle: async ({ query }) => {
      const page = await cache.history.commits(query.head, { kind: query.kind, document: query.document, feature: query.feature, author: query.author, q: query.q }, query.after, query.limit ?? PAGE);
      if (!page) throw cursorGone();
      return ok(browserHistoryV6.parse({ contract: 'browser-history', version: 6, sessionId, head: query.head, ...page }));
    } }),
    route({ method: 'GET', path: '/api/v1/history/summary', session: true, query: browserHistorySummaryQueryV1, unreadable, handle: async ({ query }) =>
      ok(browserHistorySummaryV4.parse({ contract: 'browser-history-summary', version: 4, sessionId, head: query.head, ...await cache.history.summary(query.head) })) }),
    // One commit as its page reads it: who made it and a page of the documents it changed, even when it changed none.
    route({ method: 'GET', path: '/api/v1/commit', session: true, query: browserCommitQueryV2, unreadable, handle: async ({ query }) => {
      const page = await cache.history.commitChanges(query.commit, query.after, query.limit ?? PAGE);
      if (!page) throw cursorGone();
      const first = page.events[0];
      // A commit that changed no document still has a page: its source files. Git names its author then.
      const line = first ? [] : git.decode(await git.run(['log', '-1', '--format=%aN%x00%aE%x00%cN%x00%aI%x00%s', query.commit, '--']).catch(() => Buffer.from(''))).split('\0');
      if (!first && line.length < 5) throw new HttpError(404, 'NOT_FOUND', t('server.commitNotFound'));
      const [author, email, committer, date, message] = first
        ? [first.author, first.email, first.committer, first.date, first.message]
        : [line[0] ?? '', line[1] ?? '', line[2] ?? '', line[3] ?? '', (line[4] ?? '').replace(/\n$/, '')];
      return ok(browserCommitV4.parse({ contract: 'browser-commit', version: 4, sessionId, commit: query.commit, author, email, committer, date, message,
        total: page.total, next: page.next, changes: page.events }));
    } }),
    // The text on both sides of one change, read from Git when the reader opens that document.
    route({ method: 'GET', path: '/api/v1/commit/change', session: true, query: browserCommitChangeQueryV1, unreadable, handle: async ({ query }) => {
      const change = await cache.history.commitChange(query.commit, query.id);
      if (!change) throw new HttpError(404, 'NOT_FOUND', t('server.commitNotFound'));
      return ok(browserCommitChangeV1.parse({ contract: 'browser-commit-change', version: 1, sessionId, commit: query.commit, event: change.event, before: change.before, after: change.after }));
    } }),
    // A record's page names the record; which commit added it is read from the history of the HEAD the reader is on.
    route({ method: 'GET', path: '/api/v1/record', session: true, query: browserRecordQueryV1, unreadable, handle: async ({ query }) => {
      const commit = await cache.history.commitOfRecord(query.head, query.id);
      if (!commit) throw new HttpError(404, 'NOT_FOUND', t('server.recordNotFound'));
      return ok(browserRecordV1.parse({ contract: 'browser-record', version: 1, sessionId, head: query.head, id: query.id, commit }));
    } }),
    // What is not committed yet, worked out again on every request: the uncommitted entry of the records list.
    route({ method: 'GET', path: '/api/v1/working', session: true, unreadable, handle: async () =>
      ok(browserWorkingV1.parse({ contract: 'browser-working', version: 1, sessionId, ...await workingOverview(working) })) }),
    route({ method: 'GET', path: '/api/v1/working/change', session: true, query: browserWorkingChangeQueryV1, unreadable, handle: async ({ query }) => {
      const change = await workingChange(working, query.id);
      if (!change) throw new HttpError(404, 'NOT_FOUND', t('server.workingChangeNotFound'));
      return ok(browserWorkingChangeV1.parse({ contract: 'browser-working-change', version: 1, sessionId, ...change }));
    } }),

    // The source a commit changed beside its documents, read from Git when the commit or record page asks for it.
    route({ method: 'GET', path: '/api/v1/commit/files', session: true, query: browserCommitFilesQueryV2, unreadable, handle: async ({ query }) => {
      const found = await commitFiles.files(query.commit, { after: query.after, limit: query.limit ?? PAGE });
      if (found === undefined) throw new HttpError(404, 'NOT_FOUND', t('server.commitNotFound'));
      if (found === null) throw cursorGone();
      return ok(browserCommitFilesV2.parse({ contract: 'browser-commit-files', version: 2, sessionId, commit: found.commit, total: found.total, next: found.next, files: found.files }));
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
    // The search box's groups as the query layer works them out (`queries/search.ts`); the browser only draws them.
    route({ method: 'GET', path: '/api/v1/search', session: true, query: browserSearchQueryV2, unreadable, handle: async ({ query }) => {
      const groups = await searchRecords(source, query);
      if (!groups) throw cursorGone();
      return ok(browserSearchV3.parse({ contract: 'browser-search', version: 3, sessionId, query: query.q, groups }));
    } }),
  ];
}
