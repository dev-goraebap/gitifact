import { useDeferredValue, useEffect, useState } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, Contributor, FeatureRow, IndexFeature, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Markdown } from '@astryxdesign/core/Markdown';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Table, pixel, proportional, useTableSortable, type TableColumn, type TablePlugin, type TableSortDirection } from '@astryxdesign/core/Table';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Token } from '@astryxdesign/core/Token';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Avatar } from '@astryxdesign/core/Avatar';
import { AvatarGroup, AvatarGroupOverflow } from '@astryxdesign/core/AvatarGroup';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Link, useNavigate } from '@tanstack/react-router';
import { DesignDocument, StateToken } from '../../../entities/document';
import { avatarSource, contributorHref } from '../../../entities/contributor';
import type { RecordSearch } from '../../../widgets/records-page';
import { featureOptions, featuresOptions } from '../../../entities/project';
import { ApiError } from '../../../shared/api/client';
import { RequestState } from '../../../shared/ui/request-state';
import { LoadMore } from '../../../shared/ui/load-more';
import { designsByRequirement } from '../model/design-sections';
import { featureFilterOf, sortKeyOf, type SortKey } from '../model/feature-filter';
import styles from './features.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { DocumentBody } from '../../../shared/ui/document';
import { RelatedList, RelatedItem } from '../../../shared/ui/related-list';
import { t, useLanguage } from '../../../shared/i18n';

export function FeatureView({ session, index, featureId, search, change }: { session: BrowserSessionV3; index: IndexFeature[]; featureId?: string | undefined; search: RecordSearch; change: (s: RecordSearch) => void }) {
  useLanguage();
  if (!featureId) return <FeatureList session={session} search={search} change={change}/>;
  return <FeatureDetailPage session={session} index={index} featureId={featureId} search={search} change={change}/>;
}

/** One feature as its page reads it, asked of the server; a feature the checkout lacks says so with a way back. */
function FeatureDetailPage({ session, index, featureId, search, change }: { session: BrowserSessionV3; index: IndexFeature[]; featureId: string; search: RecordSearch; change: (s: RecordSearch) => void }) {
  const query = useQuery(featureOptions(session, featureId));
  // Drawn in the background so the loader keeps moving while a long feature is laid out.
  const data = useDeferredValue(query.data);
  if (query.error instanceof ApiError && query.error.code === 'NOT_FOUND') return <PageState kind="not-found" title={t('features.notFoundTitle')} description={t('features.notFoundDescription', { id: featureId })} actions={<Link to="/features">{t('features.backToList')}</Link>}/>;
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!data) return <RequestState/>;
  return <FeatureDetail feature={data.feature} features={index} search={search} change={change}/>;
}

/** Overlapping author avatars; the fourth and later collapse into a "+N" count. */
function Contributors({ people }: { people: Contributor[] }) {
  useLanguage();
  if (!people.length) return <Text type="supporting" color="secondary">{t('common.uncommitted')}</Text>;
  const shown = people.slice(0, 3);
  return <AvatarGroup size="sm" shape="circle">
    {shown.map(p => <Avatar key={p.email} name={p.name} src={avatarSource(p.email)} href={contributorHref(p.email)}/>)}
    {people.length > shown.length && <AvatarGroupOverflow count={people.length - shown.length}/>}
  </AvatarGroup>;
}

/** A row of the table: a feature heading its group, one of its requirements, or the rest of a long feature. */
type Row = { id: string; kind: 'feature' | 'requirement' | 'more'; feature: FeatureRow; requirement?: FeatureRow['requirements'][number]; number?: number; [key: string]: unknown };

/**
 * The feature list as the server gives it: filtered, ordered and cut into pages of whole features, each with its first
 * requirements. The table draws the rows and asks for the next page; it neither filters nor sorts.
 */
function FeatureList({ session, search, change }: { session: BrowserSessionV3; search: RecordSearch; change: (s: RecordSearch) => void }) {
  useLanguage();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 767px)');
  // The column headers carry the order, so the state is a column and a direction rather than a named preset.
  // Ascending first suits a name; a count and a date are read newest-and-largest first, so they open descending.
  const opens: Record<SortKey, TableSortDirection> = { title: 'ascending', requirements: 'descending', updatedAt: 'descending' };
  const key = sortKeyOf(search);
  const direction: TableSortDirection = search.dir === 'asc' ? 'ascending' : search.dir === 'desc' ? 'descending' : opens[key];
  // A new filter or order keeps the rows on screen until the next answer replaces them.
  const query = useInfiniteQuery({ ...featuresOptions(session, featureFilterOf(search)), placeholderData: keepPreviousData });
  // The rows are drawn in the background, a slice at a time, so the loader keeps moving while the table is built.
  const data = useDeferredValue(query.data);
  const carried = { q: search.q, design: search.design, author: search.author, sort: search.sort, dir: search.dir };
  const sorting = useTableSortable<Row, SortKey>({ sort: [{ sortKey: key, direction }], allowUnsortedState: false,
    // A column the reader has just reached opens the way that column is normally read, not always ascending.
    onSortChange: next => { const entry = next[0]; if (!entry) return;
      const way = entry.sortKey === key ? entry.direction : opens[entry.sortKey];
      change({ ...search, sort: entry.sortKey === 'updatedAt' ? undefined : entry.sortKey, dir: way === opens[entry.sortKey] ? undefined : way === 'ascending' ? 'asc' : 'desc' }); } });
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!data) return <RequestState/>;
  const first = data.pages[0]!;
  const features = data.pages.flatMap(page => page.features);
  const rows: Row[] = features.flatMap(feature => [
    { id: feature.id, kind: 'feature' as const, feature },
    ...feature.requirements.map((requirement, index) => ({ id: feature.id + ':' + requirement.id, kind: 'requirement' as const, feature, requirement, number: index + 1 })),
    ...(feature.hidden ? [{ id: feature.id + ':more', kind: 'more' as const, feature }] : []),
  ]);
  const mostRequirements = Math.max(1, first.mostRequirements);
  const oneLine = (text: string) => text.replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim();
  const open = (row: Row) => {
    const requirement = row.kind === 'requirement' ? row.requirement!.id : undefined;
    void navigate({ to: '/features/$featureId', params: { featureId: row.feature.id },
      search: { ...carried, ...(requirement ? { selected: requirement, tab: 'requirements' } : {}) }, ...(requirement ? { hash: requirement } : {}) });
  };
  const columns: TableColumn<Row>[] = [
    // One column carries both kinds of row: a feature names the group and its requirements sit under it, indented.
    // A feature stacks its title over its description inside the height one line used to take, and ends with one
    // link to its designs. A requirement reads as number, title and its one-line description.
    { key: 'title', header: t('features.column.feature'), sortable: true, width: proportional(1, { minWidth: 200 }), renderCell: row => row.kind === 'feature'
      ? <HStack gap={4} className={styles.featureTitleRow}>
        <VStack gap={0} className={styles.featureHeading}>
          <HStack gap={2} className={styles.featureNameLine}>
            <Link to="/features/$featureId" params={{ featureId: row.feature.id }} search={carried} className={styles.featureTitle} data-state-title>{row.feature.title}</Link>
            <StateToken state={row.feature.state}/>
            {!row.feature.designs && <Token label={t('features.noDesignMark')} color="yellow" size="sm"/>}
          </HStack>
          {/* The second line is kept even without a description, so every feature row has the same height. */}
          <Text type="supporting" color="secondary" className={`${styles.featureDescription} ${styles.oneLine}`}>{oneLine(row.feature.description) || ' '}</Text>
        </VStack>
        {row.feature.designs > 0 && <Link to="/features/$featureId" params={{ featureId: row.feature.id }} search={{ ...carried, tab: 'design' }} className={styles.featureDesignLink}>{t('features.designMark', { count: row.feature.designs })}</Link>}
      </HStack>
      : row.kind === 'more'
        ? <Link to="/features/$featureId" params={{ featureId: row.feature.id }} search={carried} className={styles.requirementMore}>{t('features.moreRequirements', { count: row.feature.hidden })}</Link>
        : <HStack gap={3} className={styles.requirementRow}>
          <Text type="supporting" color="secondary" className={styles.requirementNumber}>{String(row.number!).padStart(2, '0')}</Text>
          <Link to="/features/$featureId" params={{ featureId: row.feature.id }} search={{ ...carried, selected: row.requirement!.id, tab: 'requirements' }} hash={row.requirement!.id} className={styles.requirementLink} data-state-title>{row.requirement!.title}</Link>
          <StateToken state={row.requirement!.state}/>
          {row.requirement!.description && <Text type="supporting" color="secondary" className={`${styles.requirementDescription} ${styles.oneLine}`}>{oneLine(row.requirement!.description)}</Text>}
          {/* Designs are the norm, so a requirement marks only that no design of its feature explains it. */}
          {row.feature.designs > 0 && !row.requirement!.designed && <Text type="supporting" color="secondary" className={styles.requirementNoDesign}>{t('features.noDesignMark')}</Text>}
        </HStack> },
    // The count with a bar of its share of the largest feature: the number answers "how many", the bar "how big is
    // this one next to the rest" without reading every row. A requirement row puts its acceptance criteria count here.
    { key: 'requirements', header: t('features.column.requirements'), sortable: true, width: pixel(128), align: 'end', renderCell: row => row.kind === 'requirement'
      ? row.requirement!.acceptance === null ? null : <Text type="supporting" color="secondary" className={styles.acceptanceCount}>{t('features.acceptanceCount', { count: row.requirement!.acceptance })}</Text>
      : row.kind !== 'feature' ? null : <HStack gap={3} className={styles.countCell}>
      <Text>{row.feature.requirementCount}</Text>
      {!mobile && <ProgressBar label={t('features.requirementShare', { title: row.feature.title })} isLabelHidden value={row.feature.requirementCount} max={mostRequirements} variant="accent"/>}
    </HStack> },
  ];
  // A phone keeps the feature and its count: the people and the last change are on the feature page, and with them the
  // count column was cut to 64px, which clipped its sortable header and the acceptance counts.
  if (!mobile) columns.push({ key: 'contributors', header: t('features.column.contributors'), width: pixel(120), renderCell: row => row.kind !== 'feature' ? null : <Contributors people={row.feature.contributors}/> });
  if (!mobile) columns.push({ key: 'updatedAt', header: t('common.recentChange'), sortable: true, width: pixel(110), align: 'end', renderCell: row => row.kind !== 'feature' ? null : row.feature.updatedAt ? <Timestamp value={row.feature.updatedAt} format="relative"/> : <Text type="supporting" color="secondary">{t('common.inProgress')}</Text> });
  // A row not committed as it is carries its state, which draws the bar at its start (global.css).
  const stateOf = (row: Row) => { const state = row.kind === 'feature' ? row.feature.state : row.kind === 'requirement' ? row.requirement!.state : undefined; return state === 'committed' ? undefined : state; };
  const interaction: TablePlugin<Row> = { transformBodyRow: (props, item) => ({ ...props, htmlProps: { ...props.htmlProps, tabIndex: 0, 'data-row': item.kind, 'data-state': stateOf(item),
    // Links inside the row (title, contributor avatars) navigate on their own; only bare surface clicks open it.
    onClick: (event: { target: EventTarget | null }) => { if (!(event.target as HTMLElement | null)?.closest('a, button')) open(item); }, onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(item); } } } }) };
  if (!features.length) return <PageState kind={first.all ? 'search' : 'empty'} title={t('features.emptyTitle')} description={first.all ? t('features.changeFilters') : t('features.emptyDescription')}/>;
  return <VStack gap={3} className={styles.featureTable}>
    <Text type="supporting" color="secondary">{t('features.count', { count: first.total })}{first.total < first.all ? t('features.ofTotal', { total: first.all }) : ''} · {t('features.requirementCount', { count: first.requirements })} · {t('features.countNote')}</Text>
    <Table data={rows} idKey="id" columns={columns} plugins={{ sorting, interaction }} density="compact" dividers="rows" hasHover textOverflow="truncate"/>
    <HStack gap={0}><LoadMore label={t('features.more')} query={query}/></HStack>
  </VStack>;
}

function FeatureDetail({ feature: selected, features, search, change }: { feature: SpecFeature; features: IndexFeature[]; search: RecordSearch; change: (s: RecordSearch) => void }) {
  useLanguage();
  const tab = search.tab === 'design' ? 'design' : 'requirements';
  const designSections = designsByRequirement(selected.designs);
  // Both tabs show every document of the feature in `order`, with an index to move between them. An older address
  // that selected a requirement on the design tab lands on the first design explaining it.
  const designs = selected.designs;
  const target = !search.selected ? undefined : tab === 'requirements' ? search.selected
    : designs.some(d => d.id === search.selected) ? search.selected : designSections.get(search.selected)?.[0];
  // The fragment of an address typed or shared from outside is read before this page has drawn the section it
  // names, so the browser has nothing to scroll to. Router navigation inside the app already lands on it.
  useEffect(() => { if (target) document.getElementById(target)?.scrollIntoView({ block: 'start' }); }, [target, tab]);
  const reading = useReadingSection((tab === 'requirements' ? selected.requirements : designs).map(d => d.id));

  return <VStack as="article" aria-label={t('features.detail')} gap={0} className={styles.featureDetail}>
    <Link to="/features" search={{ q: search.q, design: search.design, author: search.author, sort: search.sort }} className={styles.featureBack}>{t('features.back')}</Link>
    <VStack gap={4} className={styles.documentHeading}>
      <HStack gap={3} vAlign="center" wrap="wrap"><Heading level={1}>{selected.title}</Heading><StateToken state={selected.state}/></HStack>
      {selected.description && <Markdown>{selected.description}</Markdown>}
      <HStack gap={4} wrap="wrap" className={styles.entryLine}>
        <Text type="supporting" color="secondary">{selected.id}</Text>
        <Text type="supporting" color="secondary">{t('features.requirementCount', { count: selected.requirements.length })}</Text>
        <Contributors people={selected.contributors}/>
        {selected.updatedAt && <Timestamp value={selected.updatedAt} format="relative"/>}
        <Link to="/records" search={{ feature: selected.id }}>{t('features.history')}</Link>
      </HStack>
    </VStack>
    <TabList role="tablist" value={tab} onChange={tab => change({ ...search, tab, selected: undefined })} hasDivider>
      <Tab value="requirements" label={t('features.tab.requirements')} panelId="feature-requirements"/>
      <Tab value="design" label={t('features.tab.design')} panelId="feature-design"/>
    </TabList>
    {tab === 'design' ? (designs.length ? <VStack id="feature-design" role="tabpanel" aria-label={t('features.tab.design')} gap={0} className={styles.requirementLayout}>
      <DocumentIndex label={t('features.designIndex')} title={t('features.designIndexTitle')} documents={designs} reading={reading}/>
      <VStack gap={0} className={styles.requirementList}>
        {designs.map((d, index) => <VStack key={d.id} id={d.id} gap={0} className={styles.requirementSection} data-state={d.state === 'committed' ? undefined : d.state} {...(d.id === target ? { 'aria-current': 'location' as const } : {})}>
          <DesignDocument design={d} path={d.path} features={features}
            eyebrow={<HStack gap={2} vAlign="center"><NumberLine label={t('features.designNumber', { number: number(index) })} id={d.id}/><StateToken state={d.state}/></HStack>}
            footer={<RelatedList label={t('features.requirementHistoryLabel')}>
              <RelatedItem title={<Link to="/records" search={{ feature: selected.id, q: d.id }}>{t('features.designHistory')}</Link>}/>
            </RelatedList>}/>
        </VStack>)}
      </VStack>
    </VStack> : <VStack id="feature-design" role="tabpanel" aria-label={t('features.tab.design')} gap={0} className={styles.designPanel}>
      <PageState isCompact title={t('features.noDesignTitle')} description={t('features.noDesignDescription')}/>
    </VStack>) : <VStack id="feature-requirements" role="tabpanel" aria-label={t('features.tab.requirements')} gap={0} className={styles.requirementLayout}>
      {/* On a wide screen the index stands to the right from the top of the tab and stays in view; on a narrow one it heads them. */}
      <DocumentIndex label={t('features.index')} title={t('features.indexTitle')} documents={selected.requirements} reading={reading}/>
      <VStack gap={0} className={styles.requirementList}>
      {/* The feature's own introduction (index.md) is short; it heads the requirements once, at their width, instead of a tab of its own. */}
      <VStack gap={0} className={styles.featureIntro}><DocumentBody headingLevelStart={3} path={selected.path}>{selected.body}</DocumentBody></VStack>
      {selected.requirements.map((r, index) => {
        const explained = (designSections.get(r.id) ?? []).map(id => designs.find(d => d.id === id)!);
        return <VStack key={r.id} id={r.id} gap={4} className={styles.requirementSection} data-state={r.state === 'committed' ? undefined : r.state} {...(r.id === target ? { 'aria-current': 'location' as const } : {})}>
          <VStack gap={2}>
            <HStack gap={2} vAlign="center"><NumberLine label={t('features.requirementNumber', { number: number(index) })} id={r.id}/><StateToken state={r.state}/></HStack>
            {/* Every title carries the highlighter; the one the reader was sent to lies on hatching instead (the section above). */}
            <Heading level={3}><mark className={styles.titleMark} data-state-title>{r.title}</mark></Heading>
          </VStack>
          {/* Each requirement is its own file one folder below index.md; its links start from there. */}
          <DocumentBody headingLevelStart={4} path={r.path}>{r.body}</DocumentBody>
          {/* What the requirement connects to, each kind in its own block: the designs that name it, then its history. */}
          <VStack gap={4} className={styles.requirementRelations}>
            {/* A design names the requirements it explains; these are those links read the other way round, every design that names this one. */}
            {!!explained.length && <RelatedList label={t('features.requirementDesigns')}>
              {explained.map(d => <RelatedItem key={d.id} title={<Link to="/features/$featureId" params={{ featureId: selected.id }} search={{ ...search, tab: 'design', selected: d.id }} hash={d.id}>{d.title}</Link>} description={d.description}/>)}
            </RelatedList>}
            <RelatedList label={t('features.requirementHistoryLabel')}>
              <RelatedItem title={<Link to="/records" search={{ feature: selected.id, q: r.id }}>{t('features.requirementHistory')}</Link>}/>
            </RelatedList>
          </VStack>
        </VStack>;
      })}
      {!selected.requirements.length && <Text>{t('features.noRequirements')}</Text>}
      </VStack>
    </VStack>}
  </VStack>;
}

const number = (index: number) => String(index + 1).padStart(2, '0');

/** The line above a title: which one it is in the feature, a dot, and its ID. */
function NumberLine({ label, id }: { label: string; id: string }) {
  return <Text type="supporting" color="secondary" className={styles.numberLine}>{label}<span aria-hidden className={styles.numberDot}>·</span>{id}</Text>;
}

/** The documents of one tab in order, marking the one being read; on a wide screen it stands to the right and follows the scroll. */
function DocumentIndex({ label, title, documents, reading }: { label: string; title: string; documents: { id: string; title: string }[]; reading: string | undefined }) {
  return <VStack as="nav" aria-label={label} gap={2} className={styles.documentIndex}>
    <Text type="supporting" color="secondary">{title}</Text>
    {documents.map((d, index) => <a key={d.id} href={`#${d.id}`} {...(d.id === reading ? { 'aria-current': 'true' as const } : {})}>{number(index)}　{d.title}</a>)}
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
