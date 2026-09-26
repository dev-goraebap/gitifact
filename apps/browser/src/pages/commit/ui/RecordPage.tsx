import { useLocation } from '@tanstack/react-router';
import { RecordsPage } from '../../../widgets/records-page';
import { RecordView } from './RecordView';
import { PageHeader } from '../../../widgets/page-header';
import { PageState } from '../../../shared/ui/page-state';
import { t, useLanguage } from '../../../shared/i18n';

/** One decision record. The fragment names a document it explains, as links from elsewhere write it. */
export function RecordPage({ recordId }: { recordId: string }) {
  useLanguage();
  const documentId = useLocation({ select: location => location.hash }) || undefined;
  return <RecordsPage header={PageHeader} title={t('nav.history')} root="/records" hasTitle={false} isWide
    trail={() => [{ label: recordId }]}
    skeleton={<></>}>
    {({ checkout, session }) => checkout.head
      ? <RecordView recordId={recordId} documentId={documentId} session={session} features={checkout.index.features} head={checkout.head}/>
      : <PageState kind="empty" title={t('history.emptyTitle')} description={t('history.emptyDescription')}/>}
  </RecordsPage>;
}
