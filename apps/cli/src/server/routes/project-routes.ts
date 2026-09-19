import { parseChangelog } from '@gitifact/core';
import { changelogV1, changelogQueryV1 } from '@gitifact/contracts';
import type { createStatusSession } from '../status-session.js';
import { HttpError } from '../http/respond.js';
import { ok, route } from '../http/router.js';
import { defaultLanguage, t } from '../../shared/i18n/index.js';

/** The session, the repository status and the release notes: what every screen reads about the project itself. */
export function projectRoutes(store: ReturnType<typeof createStatusSession>, readChangelog: (language: string) => Promise<string | null>) {
  return [
    // Re-reading the session never contacts the registry; it returns the state the single startup check left.
    route({ method: 'GET', path: '/api/v1/session', session: false, handle: () => ok(store.session) }),
    route({ method: 'GET', path: '/api/v1/status', session: true, handle: () => ({ status: store.latest.ok ? 200 : 503, body: store.latest }) }),
    route({ method: 'POST', path: '/api/v1/status/refresh', session: true, handle: async ({ allowedOrigin }) => {
      if (!allowedOrigin) throw new HttpError(403, 'FORBIDDEN', t('server.refreshOrigin'));
      const value = await store.refresh();
      return { status: value.ok ? 200 : 503, body: value };
    } }),
    route({ method: 'GET', path: '/api/v1/changelog', session: true, query: changelogQueryV1, unreadable: t('server.changelogUnreadable'), handle: async ({ query }) => {
      // A language without notes falls back to the default one, and the answer says so.
      const language = query.lang ?? defaultLanguage;
      const own = await readChangelog(language);
      const text = own ?? (language === defaultLanguage ? null : await readChangelog(defaultLanguage));
      if (text === null) throw new HttpError(404, 'NOT_FOUND', t('server.changelogNotFound'));
      return ok(changelogV1.parse({ contract: 'changelog', version: 1, language: own === null ? defaultLanguage : language, fallback: own === null, entries: parseChangelog(text) }));
    } }),
  ];
}
