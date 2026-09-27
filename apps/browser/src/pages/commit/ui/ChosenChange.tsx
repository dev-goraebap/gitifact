import { useQueryClient } from '@tanstack/react-query';
import type { IndexFeature } from '@gitifact/contracts';
import { ChangeSection } from './ChangeSection';
import type { ChangeSource } from './RecordDocuments';
import { AreaSwap, RequestState, useSwap } from '../../../shared/ui/request-state';
import { useLanguage } from '../../../shared/i18n';

/**
 * The chosen document of a list of changes, its text read when it is opened. Choosing another keeps this one in view
 * and reads the next ahead, text and diagrams, then shows it whole: past 100ms the part is veiled as a page move is.
 */
export function ChosenChange({ id, source, features, head }: { id: string; source: ChangeSource; features: IndexFeature[]; head: string | null }) {
  useLanguage();
  const client = useQueryClient();
  const { shown, isPreparing } = useSwap(id, next => source.prepare(client, next));
  const query = source.use(shown);
  return <AreaSwap isPreparing={isPreparing} contentKey={shown}>
    {query.error ? <RequestState error={query.error} retry={() => { void query.refetch(); }}/>
      : !query.data ? <RequestState/>
      : <ChangeSection change={query.data} features={features} head={head} current={false}/>}
  </AreaSwap>;
}
