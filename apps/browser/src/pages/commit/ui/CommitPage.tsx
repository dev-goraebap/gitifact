import { useLocation } from '@tanstack/react-router';
import { RecordsPage } from '../../../widgets/records-page';
import { CommitView } from './CommitView';
import type { CommitSearch } from '../model/commit-search';
import { PageHeader } from '../../../widgets/page-header';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * One commit of the decision records. `tab` picks its records, documents or code; the fragment names a document to
 * open at, as links from elsewhere write it, and opens the documents without a `tab`.
 */
export function CommitPage({ commit, search }: { commit: string; search: CommitSearch }) {
  useLanguage();
  const documentId = useLocation({ select: location => location.hash }) || undefined;
  return <RecordsPage header={PageHeader} title={t('nav.history')} root="/records" hasTitle={false} isWide
    trail={() => [{ label: commit.slice(0, 12) }]}>
    {({ checkout, session }) => <CommitView commit={commit} search={search} documentId={documentId} session={session} features={checkout.index.features} head={checkout.head}/>}
  </RecordsPage>;
}
