import type { FeatureFilter } from '../../../entities/project';
import type { RecordSearch } from '../../../widgets/records-page';

/** The columns a reader can order the list by; every other column holds nothing to compare. */
export type SortKey = 'title' | 'requirements' | 'updatedAt';
/** The column the address orders by: the most recent change unless it names another. */
export const sortKeyOf = (search: RecordSearch): SortKey => search.sort === 'title' || search.sort === 'requirements' ? search.sort : 'updatedAt';
/**
 * The list the address asks the server for. The route's loader and the list build it the same way, so what the loader
 * primed is what the list reads.
 */
export function featureFilterOf(search: RecordSearch): FeatureFilter {
  const key = sortKeyOf(search);
  return { q: search.q, design: search.design, author: search.author, sort: key === 'updatedAt' ? undefined : key, dir: search.dir };
}
