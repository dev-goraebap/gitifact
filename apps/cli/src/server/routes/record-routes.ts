import type { PreviewBundle } from '@gitifact/core';
import { browserChangeQueryV1, browserChangeV1, browserHistoryQueryV1, browserHistorySummaryQueryV1, browserHistorySummaryV1, browserHistoryV1, browserSearchQueryV1, browserSearchV1 } from '@gitifact/contracts';
import { specPreviewReader } from '../../adapters/git/spec-preview-reader.js';
import { createCheckoutReader } from '../checkout/checkout-reader.js';
import { createHistoryIndex } from '../history/history-index.js';
import { HttpError } from '../http/respond.js';
import { ok, route } from '../http/router.js';
import { t } from '../../shared/i18n/index.js';

/** A page of history unless the reader asks for another size. */
const PAGE = 50;

/**
 * The records: the checkout (current specs and wiki, sent whole), and history, which the server filters, pages,
 * counts and searches over all of it through the local index.
 */
export function recordRoutes(root: string, sessionId: string, env?: NodeJS.ProcessEnv) {
  const reader = specPreviewReader(root);
  // Whole-store snapshots, for the few commits the index cannot read by their changed files alone.
  const snapshots = new Map<string, Promise<PreviewBundle>>();
  const snapshot = (oid: string) => {
    let value = snapshots.get(oid);
    if (!value) { value = reader.readBundle(oid).catch(e => { snapshots.delete(oid); throw e; }); snapshots.set(oid, value); }
    if (snapshots.size > 128) snapshots.delete(snapshots.keys().next().value!);
    return value;
  };
  const readCheckout = createCheckoutReader(root, sessionId, env);
  const history = createHistoryIndex(root, snapshot);
  // The search rows describe the checkout this worktree last showed, so a search finds what is on screen.
  const scope = 'checkout:' + root;
  const unreadable = t('server.specsUnreadable');
  // Reading the checkout writes its search rows; the first search of a server that has not read one yet reads it.
  let synced: Promise<void> | undefined;
  const checkout = async () => {
    const read = await readCheckout();
    synced = history.syncCheckout(scope, read.stamp, read.search);
    await synced;
    return read.checkout;
  };

  return [
    route({ method: 'GET', path: '/api/v1/specs', session: true, unreadable, handle: async () => {
      return ok(await checkout());
    } }),
    route({ method: 'GET', path: '/api/v1/history', session: true, query: browserHistoryQueryV1, unreadable, handle: async ({ query }) => {
      const offset = query.offset ?? 0;
      const page = await history.page(query.head, { kind: query.kind, document: query.document, feature: query.feature, author: query.author, q: query.q }, offset, query.limit ?? PAGE);
      return ok(browserHistoryV1.parse({ contract: 'browser-history', version: 1, sessionId, head: query.head, offset, ...page }));
    } }),
    route({ method: 'GET', path: '/api/v1/history/summary', session: true, query: browserHistorySummaryQueryV1, unreadable, handle: async ({ query }) =>
      ok(browserHistorySummaryV1.parse({ contract: 'browser-history-summary', version: 1, sessionId, head: query.head, ...await history.summary(query.head) })) }),
    route({ method: 'GET', path: '/api/v1/change', session: true, query: browserChangeQueryV1, unreadable, handle: async ({ query }) => {
      const change = await history.change(query.key);
      if (!change) throw new HttpError(404, 'NOT_FOUND', t('server.changeNotFound'));
      return ok(browserChangeV1.parse({ contract: 'browser-change', version: 1, sessionId, ...change }));
    } }),
    route({ method: 'GET', path: '/api/v1/search', session: true, query: browserSearchQueryV1, unreadable, handle: async ({ query }) => {
      // The palette may open before any screen read the checkout; then it is read once so there is something to find.
      await (synced ?? checkout()).catch(() => undefined);
      return ok(browserSearchV1.parse({ contract: 'browser-search', version: 1, sessionId, query: query.q, hits: await history.search(scope, query.head ?? null, query.q) }));
    } }),
  ];
}
