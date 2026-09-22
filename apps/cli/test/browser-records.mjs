import { specPreviewReader } from '../.test-build/adapters/git/spec-preview-reader.js';
import { createCheckoutReader } from '../.test-build/server/checkout/checkout-reader.js';
import { createHistoryIndex } from '../.test-build/server/history/history-index.js';

/**
 * The browser's records as the server builds them: `read()` gives the checkout with the first page of history (up to
 * `limit` changes) beside it, `read.change(key)` one change with its text, and `read.history` the index itself.
 */
export function openRecords(root, env, limit = 100) {
  const reader = specPreviewReader(root);
  const checkout = createCheckoutReader(root, 'fixture', env);
  const history = createHistoryIndex(root, oid => reader.readBundle(oid));
  async function read() {
    const { checkout: current } = await checkout();
    if (!current.head) return { ...current, events: [], total: 0 };
    const page = await history.page(current.head, {}, 0, limit);
    return { ...current, events: page.events, total: page.total };
  }
  read.change = key => history.change(key);
  read.history = history;
  read.checkout = checkout;
  return read;
}
