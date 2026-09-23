import { useLocation } from '@tanstack/react-router';
import { RecordsPage } from '../../../widgets/records-page';
import { CommitView } from './CommitView';
import { PageHeader } from '../../../widgets/page-header';
import { t, useLanguage } from '../../../shared/i18n';

/** One commit of the activity. The fragment names the document to open at, as links from elsewhere write it. */
export function CommitPage({ commit }: { commit: string }) {
  useLanguage();
  const documentId = useLocation({ select: location => location.hash }) || undefined;
  return <RecordsPage header={PageHeader} title={t('nav.history')} root="/activity" hasTitle={false} isWide
    trail={() => [{ label: commit.slice(0, 12) }]}
    skeleton={<></>}>
    {({ checkout, session }) => <CommitView commit={commit} documentId={documentId} session={session} features={checkout.features} head={checkout.head}/>}
  </RecordsPage>;
}
