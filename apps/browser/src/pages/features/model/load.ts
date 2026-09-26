import type { QueryClient } from '@tanstack/react-query';
import { featureOptions, featuresOptions, primeFrame, settle } from '../../../entities/project';
import { prepareDiagrams } from '../../../shared/ui/document';
import type { RecordSearch } from '../../../widgets/records-page';
import { featureFilterOf } from './feature-filter';

/**
 * Primes what the features screen draws first: the frame, then the list the address asks for, or one feature with the
 * diagrams of the tab it opens on drawn.
 */
export async function loadFeatures(client: QueryClient, featureId: string | undefined, search: RecordSearch) {
  const { session } = await primeFrame(client);
  if (!session) return;
  if (!featureId) { await settle(client.ensureInfiniteQueryData(featuresOptions(session, featureFilterOf(search)))); return; }
  const answer = await client.ensureQueryData(featureOptions(session, featureId)).catch(() => undefined);
  if (!answer) return;
  const { feature } = answer;
  await prepareDiagrams(search.tab === 'design' ? feature.designs.map(d => d.body) : [feature.body, ...feature.requirements.map(r => r.body)]);
}