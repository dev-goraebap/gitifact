import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3 } from '@gitifact/contracts';
import { sessionOptions, statusOptions } from './repository';
import { specsOptions } from './specs';

const noSession: BrowserSessionV3 = { contract: 'browser-session', version: 3, sessionId: '', repository: { key: '', worktreeKey: '' }, cliVersion: '0.0.0' };
/** Paths whose uncommitted changes count as spec work. */
const storePath = /^\.gitifact\//;

/**
 * Whether the working tree holds uncommitted spec or document changes; undefined until either source has answered.
 * Two sources: the specs answer's `working` flag from the cache the product pages fill (never fetched here, so repositories without a
 * gitifact store raise no errors on the Git or about pages), and the repository status every page already loads for the header,
 * which lists changed paths under the store folder even on a direct visit to the Git page.
 */
export function useWorkingChanges(): boolean | undefined {
  const session = useQuery(sessionOptions());
  const specs = useQuery({ ...specsOptions(session.data ?? noSession), enabled: false });
  const status = useQuery({ ...statusOptions(session.data ?? noSession), enabled: !!session.data && !session.error });
  const fromSpecs = specs.data?.working;
  const fromStatus = status.data ? status.data.changes.some(change => storePath.test(change.path)) : undefined;
  if (fromSpecs === undefined && fromStatus === undefined) return undefined;
  return !!fromSpecs || !!fromStatus;
}
