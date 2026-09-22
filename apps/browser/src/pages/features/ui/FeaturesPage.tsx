import { Selector } from '@astryxdesign/core/Selector';
import { RecordsPage, SearchFilter, ListSkeleton, type RecordSearch, type ChangeSearch } from '../../../widgets/records-page';
import { FeatureView } from './FeatureView';
import { PageHeader } from '../../../widgets/page-header';
import { t, useLanguage } from '../../../shared/i18n';

/** The features and their requirements as a list, or one feature's requirements and designs when `featureId` is set. */
export function FeaturesPage({ featureId, search, change }: { featureId?: string | undefined; search: RecordSearch; change: ChangeSearch }) {
  useLanguage();
  return <RecordsPage header={PageHeader} title={t('nav.features')} root="/features" hasTitle={!featureId} skeleton={<ListSkeleton/>}
    trail={checkout => { const feature = featureId ? checkout.features.find(f => f.id === featureId) : undefined; return feature ? [{ label: feature.title }] : []; }}
    {...(featureId ? {} : { filters: checkout => <>
      <SearchFilter label={t('filters.search')} placeholder={t('filters.searchFeatures')} value={search.q ?? ''} onChange={q => change({ ...search, q: q || undefined }, true)}/>
      <Selector label={t('filters.design')} isLabelHidden value={search.design ?? ''} options={[{ value: '', label: t('filters.allDesigns') }, { value: 'yes', label: t('filters.designWritten') }, { value: 'no', label: t('filters.designMissing') }]} onChange={design => change({ ...search, design: design || undefined })}/>
      <Selector label={t('filters.contributor')} isLabelHidden value={search.author ?? ''} options={[{ value: '', label: t('filters.allContributors') }, ...checkout.contributors.map(p => ({ value: p.email, label: p.name }))]} onChange={author => change({ ...search, author: author || undefined })}/>
    </> })}>
    {({ checkout, session }) => <FeatureView features={checkout.features} featureId={featureId} search={search} change={change} session={session} head={checkout.head}/>}
  </RecordsPage>;
}
