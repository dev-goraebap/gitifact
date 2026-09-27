import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { Selector } from '@astryxdesign/core/Selector';
import type { BrowserCheckoutV1, BrowserSessionV3 } from '@gitifact/contracts';
import { RecordsPage, SearchFilter, type RecordSearch, type ChangeSearch } from '../../../widgets/records-page';
import { HistoryView } from './HistoryView';
import { PageHeader } from '../../../widgets/page-header';
import { historyOptions } from '../../../entities/project';
import { historyFilterOf } from '../model/load';
import { DocumentKindIcon, FeatureIcon, PersonIcon, RecordIcon } from '../../../shared/ui/icons/filter-icons';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * The decision records: the commits whose changes the filters are about, each with the records that explain them,
 * filtered by the server over all of history. The target is a feature or an instruction.
 */
export function ActivityPage({ search, change }: { search: RecordSearch; change: ChangeSearch }) {
  useLanguage();
  return <RecordsPage header={PageHeader} title={t('nav.history')} description={t('pageDescription.history')} root="/records" hasTitle
    filters={(checkout, session) => <>
      <SearchFilter label={t('filters.search')} placeholder={t('filters.searchEvents')} value={search.q ?? ''} onChange={q => change({ ...search, q: q || undefined }, true)}/>
      <Selector label={t('filters.target')} isLabelHidden startIcon={FeatureIcon} value={search.target ?? ''} options={[{ value: '', label: t('filters.allTargets') },
        ...(checkout.index.features.length ? [{ type: 'section' as const, title: t('nav.features'), options: checkout.index.features.map(f => ({ value: f.id, label: f.title })) }] : []),
        ...(checkout.index.instructions.length ? [{ type: 'section' as const, title: t('nav.instructions'), options: checkout.index.instructions.map(i => ({ value: i.id, label: i.title })) }] : [])]}
        onChange={target => change({ ...search, target: target || undefined })}/>
      <DocumentKindFilter checkout={checkout} session={session} search={search} change={change}/>
      <Selector label={t('filters.record')} isLabelHidden startIcon={RecordIcon} value={search.record ?? ''} options={[{ value: '', label: t('filters.allRecords') }, { value: 'missing', label: t('filters.recordMissing') }]} onChange={record => change({ ...search, record: record || undefined })}/>
      <Selector label={t('filters.author')} isLabelHidden startIcon={PersonIcon} value={search.author ?? ''} options={[{ value: '', label: t('filters.allAuthors') }, ...checkout.index.people.map(p => ({ value: p.email, label: p.name }))]} onChange={author => change({ ...search, author: author || undefined })}/>
    </>}>
    {({ checkout, session }) => <HistoryView features={checkout.index.features} search={search} session={session} head={checkout.head}/>}
  </RecordsPage>;
}

/**
 * The kind of document. Wiki pages left the project, so they are offered only when the history holds one — the list's
 * own answer says which kinds it holds — or when the address already asks for them.
 */
function DocumentKindFilter({ checkout, session, search, change }: { checkout: BrowserCheckoutV1; session: BrowserSessionV3; search: RecordSearch; change: ChangeSearch }) {
  // The same query the list asks, so it is answered once.
  const history = useInfiniteQuery({ ...historyOptions(session, checkout.head ?? '', historyFilterOf(search)), enabled: !!checkout.head, placeholderData: keepPreviousData });
  const wiki = search.document === 'wiki' || !!history.data?.pages[0]?.kinds.includes('wiki');
  const kinds = ['feature', 'requirement', 'design', 'instruction', ...(wiki ? ['wiki'] as const : [])] as const;
  return <Selector label={t('filters.document')} isLabelHidden startIcon={DocumentKindIcon} value={search.document ?? ''}
    options={[{ value: '', label: t('filters.allDocuments') }, ...kinds.map(kind => ({ value: kind, label: t(`kind.${kind}`) }))]}
    onChange={document => change({ ...search, document: document || undefined })}/>;
}
