import { browserChangeQueryV2, browserChangeV2, browserHistoryQueryV2, browserHistorySummaryQueryV1, browserHistorySummaryV2, browserHistoryV3, browserSearchQueryV1, browserSearchV1 } from '@gitifact/contracts';
import { storeReader } from '../../adapters/git/store-reader.js';
import { openCache } from '../../adapters/cache/index.js';
import { createCheckoutReader } from '../checkout/checkout-reader.js';
import { HttpError } from '../http/respond.js';
import { ok, route } from '../http/router.js';
import { t } from '../../shared/i18n/index.js';

/** A page of history unless the reader asks for another size. */
const PAGE = 50;

/**
 * The records: the checkout (current features and wiki, sent whole), and history, which the server filters, pages,
 * counts and searches over all of it. Both come from the cache the CLI uses too (`.gitifact/cache/index.db`).
 */
export function recordRoutes(root: string, sessionId: string, env?: NodeJS.ProcessEnv) {
  const git = storeReader(root);
  const cache = openCache(root, { run: (args, input) => git.run(args, input), decode: git.decode });
  const readCheckout = createCheckoutReader(root, sessionId, cache, env);
  const unreadable = () => t('server.specsUnreadable');

  return [
    route({ method: 'GET', path: '/api/v1/specs', session: true, unreadable, handle: async () => ok((await readCheckout()).checkout) }),
    route({ method: 'GET', path: '/api/v1/history', session: true, query: browserHistoryQueryV2, unreadable, handle: async ({ query }) => {
      const offset = query.offset ?? 0;
      const page = await cache.history.page(query.head, { kind: query.kind, document: query.document, feature: query.feature, author: query.author, q: query.q }, offset, query.limit ?? PAGE);
      return ok(browserHistoryV3.parse({ contract: 'browser-history', version: 3, sessionId, head: query.head, offset, ...page }));
    } }),
    route({ method: 'GET', path: '/api/v1/history/summary', session: true, query: browserHistorySummaryQueryV1, unreadable, handle: async ({ query }) =>
      ok(browserHistorySummaryV2.parse({ contract: 'browser-history-summary', version: 2, sessionId, head: query.head, ...await cache.history.summary(query.head) })) }),
    route({ method: 'GET', path: '/api/v1/change', session: true, query: browserChangeQueryV2, unreadable, handle: async ({ query }) => {
      const change = await cache.history.change(query.key);
      if (!change) throw new HttpError(404, 'NOT_FOUND', t('server.changeNotFound'));
      return ok(browserChangeV2.parse({ contract: 'browser-change', version: 2, sessionId, ...change }));
    } }),
    route({ method: 'GET', path: '/api/v1/search', session: true, query: browserSearchQueryV1, unreadable, handle: async ({ query }) =>
      ok(browserSearchV1.parse({ contract: 'browser-search', version: 1, sessionId, query: query.q, hits: await cache.search(query.head ?? null, query.q) })) }),
  ];
}
