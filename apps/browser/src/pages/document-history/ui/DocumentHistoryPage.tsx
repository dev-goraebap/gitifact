import { RecordsPage } from '../../../widgets/records-page';
import { PageHeader } from '../../../widgets/page-header';
import { PageState } from '../../../shared/ui/page-state';
import { DocumentHistoryView } from './DocumentHistoryView';
import { t, useLanguage } from '../../../shared/i18n';

/** One document's history: every commit that changed it and the records that explain why, as `records list --doc` shows it. */
export function DocumentHistoryPage({ docId }: { docId: string }) {
  useLanguage();
  return <RecordsPage header={PageHeader} title={t('nav.history')} root="/records" hasTitle={false}
    trail={() => [{ label: docId }]}>
    {({ checkout, session }) => checkout.head
      ? <DocumentHistoryView docId={docId} session={session} checkout={checkout} head={checkout.head}/>
      : <PageState kind="empty" title={t('history.emptyTitle')} description={t('history.emptyDescription')}/>}
  </RecordsPage>;
}
