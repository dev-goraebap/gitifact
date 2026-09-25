import { Selector } from '@astryxdesign/core/Selector';
import { RecordsPage, SearchFilter, ListSkeleton, type RecordSearch, type ChangeSearch } from '../../../widgets/records-page';
import { TimelineSkeleton } from '../../../widgets/activity-timeline';
import { HistoryView } from './HistoryView';
import { PageHeader } from '../../../widgets/page-header';
import { ChangeKindIcon, DocumentKindIcon, FeatureIcon, PersonIcon } from '../../../shared/ui/icons/filter-icons';
import { t, useLanguage } from '../../../shared/i18n';

/** The decision records: every committed change of the documents by the record that explains it, filtered by the server over all of history. */
export function ActivityPage({ search, change }: { search: RecordSearch; change: ChangeSearch }) {
  useLanguage();
  return <RecordsPage header={PageHeader} title={t('nav.history')} description={t('pageDescription.history')} root="/records" hasTitle
    skeleton={<ListSkeleton selectors={4}><TimelineSkeleton/></ListSkeleton>}
    filters={checkout => <>
      <SearchFilter label={t('filters.search')} placeholder={t('filters.searchEvents')} value={search.q ?? ''} onChange={q => change({ ...search, q: q || undefined }, true)}/>
      <Selector label={t('filters.feature')} isLabelHidden startIcon={FeatureIcon} value={search.feature ?? ''} options={[{ value: '', label: t('filters.allFeatures') }, ...checkout.features.map(f => ({ value: f.id, label: f.title }))]} onChange={feature => change({ ...search, feature: feature || undefined })}/>
      <Selector label={t('filters.document')} isLabelHidden startIcon={DocumentKindIcon} value={search.document ?? ''} options={[{ value: '', label: t('filters.allDocuments') }, { value: 'feature', label: t('kind.feature') }, { value: 'requirement', label: t('kind.requirement') }, { value: 'design', label: t('kind.design') }, { value: 'wiki', label: t('kind.wiki') }, { value: 'instruction', label: t('kind.instruction') }]} onChange={document => change({ ...search, document: document || undefined })}/>
      <Selector label={t('filters.change')} isLabelHidden startIcon={ChangeKindIcon} value={search.kind ?? ''} options={[{ value: '', label: t('filters.allChanges') }, { value: 'created', label: t('change.created') }, { value: 'modified', label: t('change.modified') }, { value: 'moved', label: t('change.moved') }, { value: 'deleted', label: t('change.deleted') }]} onChange={kind => change({ ...search, kind: kind || undefined })}/>
      <Selector label={t('filters.author')} isLabelHidden startIcon={PersonIcon} value={search.author ?? ''} options={[{ value: '', label: t('filters.allAuthors') }, ...checkout.contributors.map(p => ({ value: p.email, label: p.name }))]} onChange={author => change({ ...search, author: author || undefined })}/>
    </>}>
    {({ checkout, session }) => <HistoryView features={checkout.features} search={search} session={session} head={checkout.head}/>}
  </RecordsPage>;
}
