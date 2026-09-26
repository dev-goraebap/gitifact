import { useLocation } from '@tanstack/react-router';
import { RecordsPage } from '../../../widgets/records-page';
import { WorkingView } from './WorkingView';
import type { WorkingSearch } from '../model/working-search';
import { PageHeader } from '../../../widgets/page-header';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * What is not committed yet, as its own page of the decision records: `changes list` on screen. `tab` picks the records
 * or the documents; the fragment names a document to open at.
 */
export function WorkingPage({ search }: { search: WorkingSearch }) {
  useLanguage();
  const documentId = useLocation({ select: location => location.hash }) || undefined;
  return <RecordsPage header={PageHeader} title={t('nav.history')} root="/records" hasTitle={false} isWide
    trail={() => [{ label: t('working.title') }]}>
    {({ checkout, session }) => <WorkingView search={search} documentId={documentId} session={session} features={checkout.index.features} head={checkout.head}/>}
  </RecordsPage>;
}
