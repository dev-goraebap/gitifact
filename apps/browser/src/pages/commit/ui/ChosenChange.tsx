import type { IndexFeature } from '@gitifact/contracts';
import { ChangeSection } from './ChangeSection';
import type { UseChange } from './RecordDocuments';
import { RequestState } from '../../../shared/ui/request-state';
import { useLanguage } from '../../../shared/i18n';

/** The chosen document of a list of changes, its text read when it is opened. */
export function ChosenChange({ id, useChange, features, head }: { id: string; useChange: UseChange; features: IndexFeature[]; head: string | null }) {
  useLanguage();
  const query = useChange(id);
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!query.data) return <RequestState/>;
  return <ChangeSection change={query.data} features={features} head={head} current={false}/>;
}
