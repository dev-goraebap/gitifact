import { Selector } from '@astryxdesign/core/Selector';
import { RecordsPage, SearchFilter, ListSkeleton, type RecordSearch, type ChangeSearch } from '../../../widgets/records-page';
import { FeatureView } from './FeatureView';
import { PageHeader } from '../../../widgets/page-header';
import { DesignIcon, PersonIcon } from '../../../shared/ui/icons/filter-icons';
import { t, useLanguage } from '../../../shared/i18n';

/** The features and their requirements as a list, or one feature's requirements and designs when `featureId` is set. */
export function FeaturesPage({ featureId, search, change }: { featureId?: string | undefined; search: RecordSearch; change: ChangeSearch }) {
  useLanguage();
  return <RecordsPage header={PageHeader} title={t('nav.features')} description={t('pageDescription.features')} root="/features" hasTitle={!featureId} skeleton={<ListSkeleton/>}
    trail={checkout => { const feature = featureId ? checkout.index.features.find(f => f.id === featureId) : undefined; return feature ? [{ label: feature.title }] : []; }}
    {...(featureId ? {} : { filters: checkout => <>
      <SearchFilter label={t('filters.search')} placeholder={t('filters.searchFeatures')} value={search.q ?? ''} onChange={q => change({ ...search, q: q || undefined }, true)}/>
      <Selector label={t('filters.design')} isLabelHidden startIcon={DesignIcon} value={search.design ?? ''} options={[{ value: '', label: t('filters.allDesigns') }, { value: 'yes', label: t('filters.designWritten') }, { value: 'no', label: t('filters.designMissing') }]} onChange={design => change({ ...search, design: design || undefined })}/>
      <Selector label={t('filters.contributor')} isLabelHidden startIcon={PersonIcon} value={search.author ?? ''} options={[{ value: '', label: t('filters.allContributors') }, ...checkout.index.people.map(p => ({ value: p.email, label: p.name }))]} onChange={author => change({ ...search, author: author || undefined })}/>
    </> })}>
    {({ checkout, session }) => <FeatureView session={session} index={checkout.index.features} featureId={featureId} search={search} change={change}/>}
  </RecordsPage>;
}
