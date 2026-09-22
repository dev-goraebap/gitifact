import { RecordsPage, type RecordSearch, type ChangeSearch } from '../../../widgets/records-page';
import { DocumentsView } from './DocumentsView';
import { WikiSkeleton } from './WikiSkeleton';
import { PageHeader } from '../../../widgets/page-header';
import { t, useLanguage } from '../../../shared/i18n';

/** The wiki explorer: the tree and a folder or a page, filling the whole card. */
export function WikiPage({ documentId, search, change }: { documentId?: string | undefined; search: RecordSearch; change: ChangeSearch }) {
  useLanguage();
  return <RecordsPage header={PageHeader} title={t('nav.wiki')} root="/wiki" hasTitle={false} isFill skeleton={<WikiSkeleton page={!!documentId}/>}
    trail={checkout => { const document = documentId ? checkout.documents.find(d => d.id === documentId) : undefined; return document ? [{ label: document.title }] : []; }}>
    {({ checkout }) => <DocumentsView documents={checkout.documents} documentId={documentId} search={search} change={change}/>}
  </RecordsPage>;
}
