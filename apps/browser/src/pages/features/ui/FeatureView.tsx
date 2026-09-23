import { useEffect, useState } from 'react';
import type { BrowserSessionV3, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Markdown } from '@astryxdesign/core/Markdown';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Table, pixel, proportional, useTableSortable, type TableColumn, type TablePlugin, type TableSortDirection } from '@astryxdesign/core/Table';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Pagination } from '@astryxdesign/core/Pagination';
import { Token } from '@astryxdesign/core/Token';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Avatar } from '@astryxdesign/core/Avatar';
import { AvatarGroup, AvatarGroupOverflow } from '@astryxdesign/core/AvatarGroup';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Link, useNavigate } from '@tanstack/react-router';
import { DesignDocument } from '../../../entities/document';
import { DocumentHistory } from './DocumentHistory';
import { avatarSource, contributorHref } from '../../../entities/contributor';
import type { RecordSearch } from '../../../widgets/records-page';
import { designsByRequirement } from '../model/design-sections';
import { pagesOf, type FeatureRow } from '../model/feature-rows';
import styles from './features.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { DocumentBody } from '../../../shared/ui/document';
import { t, useLanguage } from '../../../shared/i18n';

export function FeatureView({ features, featureId, search, change, session, head }: { features: SpecFeature[]; featureId?: string | undefined; search: RecordSearch; change: (s: RecordSearch) => void; session: BrowserSessionV3; head: string | null }) {
  useLanguage();
  if (!featureId) return <FeatureList features={features} search={search} change={change}/>;
  const selected = features.find(f => f.id === featureId);
  if (!selected) return <PageState kind="not-found" title={t('features.notFoundTitle')} description={t('features.notFoundDescription', { id: featureId })} actions={<Link to="/features">{t('features.backToList')}</Link>}/>;
  return <FeatureDetail feature={selected} features={features} search={search} change={change} session={session} head={head}/>;
}

/** Overlapping author avatars; the fourth and later collapse into a "+N" count. */
function Contributors({ people }: { people: SpecFeature['contributors'] }) {
  useLanguage();
  if (!people.length) return <Text type="supporting" color="secondary">{t('common.uncommitted')}</Text>;
  const shown = people.slice(0, 3);
  return <AvatarGroup size="sm" shape="circle">
    {shown.map(p => <Avatar key={p.email} name={p.name} src={avatarSource(p.email)} href={contributorHref(p.email)}/>)}
    {people.length > shown.length && <AvatarGroupOverflow count={people.length - shown.length}/>}
  </AvatarGroup>;
}

/** The columns a reader can order the list by; every other column holds nothing to compare. */
type SortKey = 'title' | 'requirements' | 'updatedAt';

function FeatureList({ features, search, change }: { features: SpecFeature[]; search: RecordSearch; change: (s: RecordSearch) => void }) {
  useLanguage();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 767px)');
  // The column headers carry the order now, so the state is a column and a direction rather than a named preset.
  // Ascending first suits a name; a count and a date are read newest-and-largest first, so they open descending.
  const opens: Record<SortKey, TableSortDirection> = { title: 'ascending', requirements: 'descending', updatedAt: 'descending' };
  const key: SortKey = search.sort === 'title' || search.sort === 'requirements' ? search.sort : 'updatedAt';
  const direction: TableSortDirection = search.dir === 'asc' ? 'ascending' : search.dir === 'desc' ? 'descending' : opens[key];
  const way = direction === 'ascending' ? 1 : -1;
  const query = search.q?.toLowerCase();
  // A word may name the feature or one of its requirements. Naming the feature keeps all of them; naming a
  // requirement keeps that one, so the list answers with the requirement rather than the document holding it.
  const named = (f: SpecFeature) => !query || (f.title + ' ' + f.id).toLowerCase().includes(query);
  const groups = features
    .filter(f => !search.design || (search.design === 'yes') === f.designs.length > 0)
    .filter(f => !search.author || f.contributors.some(p => p.email === search.author))
    .map(f => ({ feature: f, requirements: named(f) ? f.requirements : f.requirements.filter(r => (r.title + ' ' + r.id).toLowerCase().includes(query!)) }))
    .filter(g => named(g.feature) || g.requirements.length)
    // Recent first by default: the list is read to see where the work is, and the store order says nothing. The
    // order is the features', not the rows': a requirement keeps the place its document gives it.
    .sort((a, b) => way * (key === 'requirements' ? a.feature.requirements.length - b.feature.requirements.length
      : key === 'title' ? a.feature.title.localeCompare(b.feature.title)
      : (a.feature.updatedAt ?? '').localeCompare(b.feature.updatedAt ?? '')) || a.feature.title.localeCompare(b.feature.title));
  const carried = { q: search.q, design: search.design, author: search.author, sort: search.sort, dir: search.dir, page: search.page };
  const mostRequirements = Math.max(1, ...features.map(f => f.requirements.length));
  const pages = pagesOf(groups);
  const page = Math.min(Math.max(1, search.page ?? 1), Math.max(1, pages.length));
  const rows = pages[page - 1] ?? [];
  const shown = groups.reduce((sum, g) => sum + g.requirements.length, 0);
  const sections = new Map(groups.map(g => [g.feature.id, designsByRequirement(g.feature.designs)]));
  // The list row has room for one link: the first design, in `order`, that explains the requirement.
  const designOf = (row: FeatureRow) => sections.get(row.feature.id)?.get(row.requirement?.id ?? '')?.[0];
  const open = (row: FeatureRow) => {
    const requirement = row.kind === 'requirement' ? row.requirement!.id : undefined;
    void navigate({ to: '/features/$featureId', params: { featureId: row.feature.id },
      search: { ...carried, ...(requirement ? { selected: requirement, tab: 'requirements' } : {}) }, ...(requirement ? { hash: requirement } : {}) });
  };
  const columns: TableColumn<FeatureRow>[] = [
    // One column carries both kinds of row: a feature names the group and its requirements sit under it, indented.
    // A design is the norm here, so only its absence is marked, beside the feature it belongs to rather than in a
    // column whose cells would otherwise all be empty.
    { key: 'title', header: t('features.column.feature'), sortable: true, width: proportional(1, { minWidth: 200 }), renderCell: row => row.kind === 'feature'
      ? <HStack gap={3} className={styles.featureTitleRow}>
        <Link to="/features/$featureId" params={{ featureId: row.feature.id }} search={carried} className={styles.featureTitle}>{row.feature.title}</Link>
        {!row.feature.designs.length && <Token label={t('features.noDesignMark')} color="yellow" size="sm"/>}
        {row.feature.description && <Text type="supporting" color="secondary" className={`${styles.featureDescription} ${styles.oneLine}`}>{row.feature.description.replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim()}</Text>}
      </HStack>
      : row.kind === 'more'
        ? <Link to="/features/$featureId" params={{ featureId: row.feature.id }} search={carried} className={styles.requirementMore}>{t('features.moreRequirements', { count: row.hidden! })}</Link>
        : <HStack gap={3} className={styles.requirementRow}>
          <Text type="supporting" color="secondary" className={styles.requirementNumber}>{String(row.number!).padStart(2, '0')}</Text>
          <Link to="/features/$featureId" params={{ featureId: row.feature.id }} search={{ ...carried, selected: row.requirement!.id, tab: 'requirements' }} hash={row.requirement!.id} className={styles.requirementLink}>{row.requirement!.title}</Link>
          {designOf(row) && <Link to="/features/$featureId" params={{ featureId: row.feature.id }} search={{ ...carried, selected: designOf(row)!, tab: 'design' }} className={styles.requirementDesignLink}>{t('features.designMark')}</Link>}
        </HStack> },
    // The count with a bar of its share of the largest feature: the number answers "how many", the bar "how big is
    // this one next to the rest" without reading every row.
    { key: 'requirements', header: t('features.column.requirements'), sortable: true, width: pixel(mobile ? 64 : 128), align: 'end', renderCell: row => row.kind !== 'feature' ? null : <HStack gap={3} className={styles.countCell}>
      <Text>{row.feature.requirements.length}</Text>
      {!mobile && <ProgressBar label={t('features.requirementShare', { title: row.feature.title })} isLabelHidden value={row.feature.requirements.length} max={mostRequirements} variant="accent"/>}
    </HStack> },
  ];
  columns.push({ key: 'contributors', header: t('features.column.contributors'), width: pixel(mobile ? 88 : 120), renderCell: row => row.kind !== 'feature' ? null : <Contributors people={row.feature.contributors}/> });
  if (!mobile) columns.push({ key: 'updatedAt', header: t('common.recentChange'), sortable: true, width: pixel(110), align: 'end', renderCell: row => row.kind !== 'feature' ? null : row.feature.updatedAt ? <Timestamp value={row.feature.updatedAt} format="relative"/> : <Text type="supporting" color="secondary">{t('common.inProgress')}</Text> });
  const sorting = useTableSortable<FeatureRow, SortKey>({ sort: [{ sortKey: key, direction }], allowUnsortedState: false,
    // A column the reader has just reached opens the way that column is normally read, not always ascending.
    onSortChange: next => { const entry = next[0]; if (!entry) return;
      const way = entry.sortKey === key ? entry.direction : opens[entry.sortKey];
      change({ ...search, sort: entry.sortKey === 'updatedAt' ? undefined : entry.sortKey, dir: way === opens[entry.sortKey] ? undefined : way === 'ascending' ? 'asc' : 'desc', page: undefined }); } });
  const interaction: TablePlugin<FeatureRow> = { transformBodyRow: (props, item) => ({ ...props, htmlProps: { ...props.htmlProps, tabIndex: 0, 'data-row': item.kind,
    // Links inside the row (title, contributor avatars) navigate on their own; only bare surface clicks open it.
    onClick: (event: { target: EventTarget | null }) => { if (!(event.target as HTMLElement | null)?.closest('a, button')) open(item); }, onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(item); } } } }) };
  if (!groups.length) return <PageState kind={features.length ? 'search' : 'empty'} title={t('features.emptyTitle')} description={features.length ? t('features.changeFilters') : t('features.emptyDescription')}/>;
  return <VStack gap={3} className={styles.featureTable}>
    <Text type="supporting" color="secondary">{t('features.count', { count: groups.length })}{groups.length < features.length ? t('features.ofTotal', { total: features.length }) : ''} · {t('features.requirementCount', { count: shown })} · {t('features.countNote')}</Text>
    <Table data={rows} idKey="id" columns={columns} plugins={{ sorting, interaction }} density="compact" dividers="rows" hasHover textOverflow="truncate"/>
    {/* data-page-footer asks the records frame to stretch to the card, so the pager rests on its floor. */}
    {pages.length > 1 && <VStack gap={0} className={styles.featurePager} data-page-footer><Pagination page={page} totalPages={pages.length} onChange={(next: number) => change({ ...search, page: next === 1 ? undefined : next })}/></VStack>}
  </VStack>;
}

function FeatureDetail({ feature: selected, features, search, change, session, head }: { feature: SpecFeature; features: SpecFeature[]; search: RecordSearch; change: (s: RecordSearch) => void; session: BrowserSessionV3; head: string | null }) {
  useLanguage();
  const tab = search.tab === 'design' ? 'design' : 'requirements';
  const designSections = designsByRequirement(selected.designs);
  // The design tab shows one document at a time, the one `selected` names or else the first in `order`. An older
  // address that selected a requirement on the design tab opens the first design explaining it.
  const designs = selected.designs;
  const design = designs.find(d => d.id === search.selected) ?? designs.find(d => d.id === designSections.get(search.selected ?? '')?.[0]) ?? designs[0];
  const at = design ? designs.indexOf(design) : -1;
  const around = [designs[at - 1], designs[at + 1]] as const;
  // Where the reader was sent: the requirement itself, or the top of the design they picked.
  const target = search.selected ? (tab === 'design' ? design?.id : search.selected) : undefined;
  // The fragment of an address typed or shared from outside is read before this page has drawn the section it
  // names, so the browser has nothing to scroll to. Router navigation inside the app already lands on it.
  useEffect(() => { if (target) document.getElementById(target)?.scrollIntoView({ block: 'start' }); }, [target, tab]);
  const reading = useReadingSection(tab === 'requirements' ? selected.requirements.map(r => r.id) : []);

  return <VStack as="article" aria-label={t('features.detail')} gap={0} className={styles.featureDetail}>
    <Link to="/features" search={{ q: search.q, design: search.design, author: search.author, sort: search.sort }} className={styles.featureBack}>{t('features.back')}</Link>
    <VStack gap={4} className={styles.documentHeading}>
      <Heading level={1}>{selected.title}</Heading>
      {selected.description && <Markdown>{selected.description}</Markdown>}
      <HStack gap={4} wrap="wrap" className={styles.entryLine}>
        <Text type="supporting" color="secondary">{selected.id}</Text>
        <Text type="supporting" color="secondary">{t('features.requirementCount', { count: selected.requirements.length })}</Text>
        <Contributors people={selected.contributors}/>
        {selected.updatedAt && <Timestamp value={selected.updatedAt} format="relative"/>}
        <Link to="/activity" search={{ feature: selected.id }}>{t('features.history')}</Link>
      </HStack>
    </VStack>
    <TabList role="tablist" value={tab} onChange={tab => change({ ...search, tab, selected: undefined })} hasDivider>
      <Tab value="requirements" label={t('features.tab.requirements')} panelId="feature-requirements"/>
      <Tab value="design" label={t('features.tab.design')} panelId="feature-design"/>
    </TabList>
    {tab === 'design' ? (design ? <VStack id="feature-design" role="tabpanel" aria-label={t('features.tab.design')} gap={0} className={styles.requirementLayout}>
      {/* The feature's design files in `order`, beside the one being read, the way the requirements have their index. */}
      <VStack as="nav" aria-label={t('features.designIndex')} gap={2} className={`${styles.documentIndex} ${styles.designIndex}`}>
        <Text type="supporting" color="secondary">{t('features.designIndexTitle')}</Text>
        {designs.map(d => <Link key={d.id} to="/features/$featureId" params={{ featureId: selected.id }} search={{ ...search, tab: 'design', selected: d.id }}
          {...(d.id === design.id ? { 'aria-current': 'page' as const } : {})}>{d.title}</Link>)}
      </VStack>
      <VStack gap={0} className={`${styles.requirementList} ${styles.designPanel}`}>
        <VStack key={design.id} id={design.id} gap={6} className={styles.designSection}>
          <DesignDocument design={design} path={design.path} features={features}/>
          <DocumentHistory session={session} head={head} id={design.id} featureId={selected.id}/>
        </VStack>
        <HStack as="nav" aria-label={t('document.pager')} gap={4} className={styles.documentPager}>
          {around[0] && <Link to="/features/$featureId" params={{ featureId: selected.id }} search={{ ...search, tab: 'design', selected: around[0].id }}>{t('document.previous', { title: around[0].title })}</Link>}
          {around[1] && <Link to="/features/$featureId" params={{ featureId: selected.id }} search={{ ...search, tab: 'design', selected: around[1].id }} className={styles.pagerNext}>{t('document.next', { title: around[1].title })}</Link>}
        </HStack>
      </VStack>
    </VStack> : <VStack id="feature-design" role="tabpanel" aria-label={t('features.tab.design')} gap={0} className={styles.designPanel}>
      <PageState isCompact title={t('features.noDesignTitle')} description={t('features.noDesignDescription')}/>
    </VStack>) : <VStack id="feature-requirements" role="tabpanel" aria-label={t('features.tab.requirements')} gap={0}>
      {/* The feature's own introduction (index.md) is short; it heads the requirements once instead of a tab of its own. */}
      <VStack gap={0} className={styles.featureIntro}><DocumentBody headingLevelStart={3} path={selected.path}>{selected.body}</DocumentBody></VStack>
      {/* On a wide screen the index stands to the right of the requirements and stays in view; on a narrow one it heads them. */}
      <VStack gap={0} className={styles.requirementLayout}>
      <VStack as="nav" aria-label={t('features.index')} gap={2} className={styles.documentIndex}>
        <Text type="supporting" color="secondary">{t('features.indexTitle')}</Text>
        {selected.requirements.map((r, index) => <a key={r.id} href={`#${r.id}`} {...(r.id === reading ? { 'aria-current': 'true' as const } : {})}>{String(index + 1).padStart(2, '0')}　{r.title}</a>)}
      </VStack>
      <VStack gap={0} className={styles.requirementList}>
      {selected.requirements.map((r, index) => {
        const isCurrent = r.id === search.selected;
        const explained = (designSections.get(r.id) ?? []).map(id => designs.find(d => d.id === id)!);
        return <VStack key={r.id} id={r.id} gap={4} className={styles.requirementSection} {...(isCurrent ? { 'aria-current': 'location' as const } : {})}>
          <VStack gap={2}>
            <Text type="supporting" color="secondary">{t('features.requirementNumber', { number: String(index + 1).padStart(2, '0') })}</Text>
            {/* Every title carries the highlighter; the one the reader was sent to lies on hatching instead (the section above). */}
            <Heading level={3}><mark className={styles.titleMark}>{r.title}</mark></Heading>
            <Text type="supporting" color="secondary">{r.id}</Text>
          </VStack>
          {/* Each requirement is its own file one folder below index.md; its links start from there. */}
          <DocumentBody headingLevelStart={4} path={r.path}>{r.body}</DocumentBody>
          <HStack gap={4} wrap="wrap" className={styles.entryLine}>
            {/* A design names the requirements it explains; these are those links read the other way round, every design that names this one. */}
            {!!explained.length && <HStack gap={2} wrap="wrap" className={styles.entryLine}>
              <Text type="supporting" color="secondary">{t('features.requirementDesigns')}</Text>
              {explained.map(d => <Link key={d.id} to="/features/$featureId" params={{ featureId: selected.id }} search={{ ...search, tab: 'design', selected: d.id }}>{d.title}</Link>)}
            </HStack>}
            <Link to="/activity" search={{ feature: selected.id, q: r.id }}>{t('features.requirementHistory')}</Link>
          </HStack>
        </VStack>;
      })}
      {!selected.requirements.length && <Text>{t('features.noRequirements')}</Text>}
      </VStack>
      </VStack>
    </VStack>}
  </VStack>;
}

/**
 * The requirement being read: the last section in the reading band below the top bar, which is the one whose heading
 * most recently came into it, or the first requirement before any has reached it. The index marks it so a reader of a
 * long feature always sees where they are. Taking the first one in the band left the last requirement unmarked when
 * the page could not scroll far enough for the end of the one above it to leave the band.
 */
function useReadingSection(ids: string[]): string | undefined {
  const [reading, setReading] = useState<string>();
  const key = ids.join(',');
  useEffect(() => {
    const sections = ids.map(id => document.getElementById(id)).filter((s): s is HTMLElement => !!s);
    // Until a section reaches the band (the introduction may still fill the top), the first one is where reading starts.
    setReading(sections[0]?.id);
    if (!sections.length) return;
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) { if (entry.isIntersecting) inBand.add(entry.target.id); else inBand.delete(entry.target.id); }
      const last = sections.findLast(section => inBand.has(section.id));
      if (last) setReading(last.id);
    }, { rootMargin: '-96px 0px -55% 0px' });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
    // The ids are compared by value; a new array with the same requirements keeps the observer.
  }, [key]);
  return reading;
}
