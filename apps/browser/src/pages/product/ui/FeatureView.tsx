import type { SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Markdown } from '@astryxdesign/core/Markdown';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Table, pixel, proportional, type TableColumn, type TablePlugin } from '@astryxdesign/core/Table';
import { Token } from '@astryxdesign/core/Token';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Avatar } from '@astryxdesign/core/Avatar';
import { AvatarGroup, AvatarGroupOverflow } from '@astryxdesign/core/AvatarGroup';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Link, useNavigate } from '@tanstack/react-router';
import { DesignDocument } from './DesignDocument';
import { avatarSource, contributorHref } from './Person';
import type { ProductSearch } from '../model/search';
import styles from './product.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { DocumentBody } from '../../../shared/ui/document';
import { t } from '../../../shared/i18n';

export function FeatureView({ features, featureId, search, change }: { features: SpecFeature[]; featureId?: string | undefined; search: ProductSearch; change: (s: ProductSearch) => void }) {
  if (!featureId) return <FeatureList features={features} search={search}/>;
  const selected = features.find(f => f.id === featureId);
  if (!selected) return <PageState kind="not-found" title={t('features.notFoundTitle')} description={t('features.notFoundDescription', { id: featureId })} actions={<Link to="/features">{t('features.backToList')}</Link>}/>;
  return <FeatureDetail feature={selected} features={features} search={search} change={change}/>;
}

/** Overlapping author avatars; the fourth and later collapse into a "+N" count. */
function Contributors({ people }: { people: SpecFeature['contributors'] }) {
  if (!people.length) return <Text type="supporting" color="secondary">{t('common.uncommitted')}</Text>;
  const shown = people.slice(0, 3);
  return <AvatarGroup size="sm" shape="circle">
    {shown.map(p => <Avatar key={p.email} name={p.name} src={avatarSource(p.email)} href={contributorHref(p.email)}/>)}
    {people.length > shown.length && <AvatarGroupOverflow count={people.length - shown.length}/>}
  </AvatarGroup>;
}

function FeatureList({ features, search }: { features: SpecFeature[]; search: ProductSearch }) {
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 767px)');
  const filtered = features.filter(f => !search.q || [f.title, f.id, ...f.requirements.map(r => r.title + ' ' + r.id)].join(' ').toLowerCase().includes(search.q.toLowerCase()));
  const open = (f: SpecFeature) => { void navigate({ to: '/features/$featureId', params: { featureId: f.id }, search: { q: search.q } }); };
  const columns: TableColumn<SpecFeature>[] = [
    { key: 'title', header: t('features.column.feature'), width: proportional(1, { minWidth: 160 }), renderCell: f => <VStack gap={1}>
      <Link to="/features/$featureId" params={{ featureId: f.id }} search={{ q: search.q }} className={styles.featureTitle}>{f.title}</Link>
      <Text type="supporting" color="secondary" maxLines={1}>{f.description ? f.description.replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim() : f.id}</Text>
    </VStack> },
    { key: 'requirements', header: t('features.column.requirements'), width: pixel(mobile ? 64 : 88), align: 'end', renderCell: f => <Text>{f.requirements.length}</Text> },
  ];
  if (!mobile) columns.push({ key: 'design', header: t('features.column.design'), width: pixel(80), renderCell: f => <Token label={f.design ? t('features.hasDesign') : t('features.noDesign')} color={f.design ? 'green' : 'default'}/> });
  columns.push({ key: 'contributors', header: t('features.column.contributors'), width: pixel(mobile ? 88 : 120), renderCell: f => <Contributors people={f.contributors}/> });
  if (!mobile) columns.push({ key: 'updatedAt', header: t('common.recentChange'), width: pixel(110), align: 'end', renderCell: f => f.updatedAt ? <Timestamp value={f.updatedAt} format="relative"/> : <Text type="supporting" color="secondary">{t('common.inProgress')}</Text> });
  const interaction: TablePlugin<SpecFeature> = { transformBodyRow: (props, item) => ({ ...props, htmlProps: { ...props.htmlProps, tabIndex: 0,
    // Links inside the row (title, contributor avatars) navigate on their own; only bare surface clicks open the feature.
    onClick: (event: { target: EventTarget | null }) => { if (!(event.target as HTMLElement | null)?.closest('a, button')) open(item); }, onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(item); } } } }) };
  if (!filtered.length) return <PageState kind={features.length ? 'search' : 'empty'} title={t('features.emptyTitle')} description={features.length ? t('features.changeSearch') : t('features.emptyDescription')}/>;
  return <VStack gap={3} className={styles.featureTable}>
    <Text type="supporting" color="secondary">{t('features.count', { count: filtered.length })}</Text>
    <Table data={filtered} idKey="id" columns={columns} plugins={{ interaction }} density="compact" dividers="rows" hasHover textOverflow="truncate"/>
  </VStack>;
}

function FeatureDetail({ feature: selected, features, search, change }: { feature: SpecFeature; features: SpecFeature[]; search: ProductSearch; change: (s: ProductSearch) => void }) {
  const tab = search.tab === 'design' ? 'design' : 'requirements';
  return <VStack as="article" aria-label={t('features.detail')} gap={0} className={styles.featureDetail}>
    <Link to="/features" search={{ q: search.q }} className={styles.featureBack}>{t('features.back')}</Link>
    <VStack gap={4} className={styles.documentHeading}>
      <Heading level={1}>{selected.title}</Heading>
      {selected.description && <Markdown>{selected.description}</Markdown>}
      <HStack gap={4} wrap="wrap" className={styles.entryLine}>
        <Text type="supporting" color="secondary">{selected.id}</Text>
        <Text type="supporting" color="secondary">{t('features.requirementCount', { count: selected.requirements.length })}</Text>
        <Contributors people={selected.contributors}/>
        {selected.updatedAt && <Timestamp value={selected.updatedAt} format="relative"/>}
        <Link to="/" search={{ feature: selected.id }}>{t('features.history')}</Link>
      </HStack>
    </VStack>
    <TabList role="tablist" value={tab} onChange={tab => change({ ...search, tab, selected: undefined })} hasDivider>
      <Tab value="requirements" label={t('features.tab.requirements')} panelId="feature-requirements"/>
      <Tab value="design" label={t('features.tab.design')} panelId="feature-design"/>
    </TabList>
    {tab === 'design' ? <VStack id="feature-design" role="tabpanel" aria-label={t('features.tab.design')} gap={4} className={styles.designPanel}>
      {selected.design ? <DesignDocument design={selected.design} features={features}/> : <PageState isCompact title={t('features.noDesignTitle')} description={t('features.noDesignDescription')}/>}
    </VStack> : <VStack id="feature-requirements" role="tabpanel" aria-label={t('features.tab.requirements')} gap={0}>
      <VStack as="nav" aria-label={t('features.index')} gap={2} className={styles.documentIndex}>
        <Text type="supporting" color="secondary">{t('features.indexTitle')}</Text>
        {selected.requirements.map((r, index) => <a key={r.id} href={`#${r.id}`}>{String(index + 1).padStart(2, '0')}　{r.title}</a>)}
      </VStack>
      {selected.requirements.map((r, index) => (
        <VStack key={r.id} id={r.id} gap={4} className={`${styles.requirementSection} ${r.id === search.selected ? styles.highlight : ''}`}>
          <VStack gap={2}>
            <Text type="supporting" color="secondary">{t('features.requirementNumber', { number: String(index + 1).padStart(2, '0') })}</Text>
            <Heading level={3}>{r.title}</Heading>
            <Text type="supporting" color="secondary">{r.id}</Text>
          </VStack>
          <DocumentBody headingLevelStart={4}>{r.body.replace(/\r?\n([ \t]+)(기대 동작:)/g, '  \n$1$2')}</DocumentBody>
          <Link to="/" search={{ feature: selected.id, q: r.id }}>{t('features.requirementHistory')}</Link>
        </VStack>
      ))}
      {!selected.requirements.length && <Text>{t('features.noRequirements')}</Text>}
    </VStack>}
  </VStack>;
}
