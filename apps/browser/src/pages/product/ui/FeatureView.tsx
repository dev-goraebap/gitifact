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
import { Link } from '@tanstack/react-router';
import { DesignDocument } from './DesignDocument';
import { avatarSource } from './Person';
import type { ProductSearch } from '../model/search';
import styles from './product.module.css';
import { PageState } from '../../../shared/ui/page-state';

export function FeatureView({ features, search, change }: { features: SpecFeature[]; search: ProductSearch; change: (s: ProductSearch) => void }) {
  const selected = features.find(f => f.id === search.feature || f.requirements.some(r => r.id === search.selected));
  return selected ? <FeatureDetail feature={selected} features={features} search={search} change={change}/> : <FeatureList features={features} search={search} change={change}/>;
}

/** Overlapping author avatars; the fourth and later collapse into a "+N" count. */
function Contributors({ people }: { people: SpecFeature['contributors'] }) {
  if (!people.length) return <Text type="supporting" color="secondary">미커밋</Text>;
  const shown = people.slice(0, 3);
  return <AvatarGroup size="sm" shape="circle">
    {shown.map(p => <Avatar key={p.email} name={p.name} src={avatarSource(p.email)}/>)}
    {people.length > shown.length && <AvatarGroupOverflow count={people.length - shown.length}/>}
  </AvatarGroup>;
}

function FeatureList({ features, search, change }: { features: SpecFeature[]; search: ProductSearch; change: (s: ProductSearch) => void }) {
  const mobile = useMediaQuery('(max-width: 767px)');
  const filtered = features.filter(f => !search.q || [f.title, f.id, ...f.requirements.map(r => r.title + ' ' + r.id)].join(' ').toLowerCase().includes(search.q.toLowerCase()));
  const open = (f: SpecFeature) => change({ ...search, feature: f.id, selected: undefined });
  const columns: TableColumn<SpecFeature>[] = [
    { key: 'title', header: '기능', width: proportional(1, { minWidth: 160 }), renderCell: f => <VStack gap={1}>
      <Link to="/features" search={{ ...search, feature: f.id, selected: undefined }} className={styles.featureTitle}>{f.title}</Link>
      <Text type="supporting" color="secondary" maxLines={1}>{f.description ? f.description.replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim() : f.id}</Text>
    </VStack> },
    { key: 'requirements', header: '요구사항', width: pixel(mobile ? 64 : 88), align: 'end', renderCell: f => <Text>{f.requirements.length}</Text> },
  ];
  if (!mobile) columns.push({ key: 'design', header: '설계', width: pixel(80), renderCell: f => <Token label={f.design ? '있음' : '없음'} color={f.design ? 'green' : 'default'}/> });
  columns.push({ key: 'contributors', header: '참여자', width: pixel(mobile ? 88 : 120), renderCell: f => <Contributors people={f.contributors}/> });
  if (!mobile) columns.push({ key: 'updatedAt', header: '최근 변경', width: pixel(110), align: 'end', renderCell: f => f.updatedAt ? <Timestamp value={f.updatedAt} format="relative"/> : <Text type="supporting" color="secondary">작업 중</Text> });
  const interaction: TablePlugin<SpecFeature> = { transformBodyRow: (props, item) => ({ ...props, htmlProps: { ...props.htmlProps, tabIndex: 0,
    onClick: () => open(item), onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(item); } } } }) };
  if (!filtered.length) return <PageState kind={features.length ? 'search' : 'empty'} title="일치하는 기능이 없습니다." description={features.length ? '검색어를 바꿔 보세요.' : '에이전트와 기능 명세를 정리하고 커밋하면 이곳에서 볼 수 있습니다.'}/>;
  return <VStack gap={3} className={styles.featureTable}>
    <Text type="supporting" color="secondary">기능 명세 {filtered.length}개 · 참여자와 최근 변경은 커밋된 기록 기준입니다.</Text>
    <Table data={filtered} idKey="id" columns={columns} plugins={{ interaction }} density="compact" dividers="rows" hasHover textOverflow="truncate"/>
  </VStack>;
}

function FeatureDetail({ feature: selected, features, search, change }: { feature: SpecFeature; features: SpecFeature[]; search: ProductSearch; change: (s: ProductSearch) => void }) {
  const tab = search.tab === 'design' ? 'design' : 'requirements';
  return <VStack as="article" aria-label="기능 명세" gap={0} className={styles.featureDetail}>
    <Link to="/features" search={{ q: search.q }} className={styles.featureBack}>← 제품 기능</Link>
    <VStack gap={4} className={styles.documentHeading}>
      <Heading level={1}>{selected.title}</Heading>
      {selected.description && <Markdown>{selected.description}</Markdown>}
      <HStack gap={4} wrap="wrap" className={styles.entryLine}>
        <Text type="supporting" color="secondary">{selected.id}</Text>
        <Text type="supporting" color="secondary">요구사항 {selected.requirements.length}개</Text>
        <Contributors people={selected.contributors}/>
        {selected.updatedAt && <Timestamp value={selected.updatedAt} format="relative"/>}
        <Link to="/" search={{ feature: selected.id }}>기능 변경 이력 →</Link>
      </HStack>
    </VStack>
    <TabList role="tablist" value={tab} onChange={tab => change({ ...search, tab, selected: undefined })} hasDivider>
      <Tab value="requirements" label="요구사항" panelId="feature-requirements"/>
      <Tab value="design" label="설계" panelId="feature-design"/>
    </TabList>
    {tab === 'design' ? <VStack id="feature-design" role="tabpanel" aria-label="설계" gap={4} className={styles.designPanel}>
      {selected.design ? <DesignDocument design={selected.design} features={features}/> : <PageState isCompact title="아직 작성된 설계가 없습니다." description="에이전트와 구현 방식을 정리하면 이곳에서 볼 수 있습니다."/>}
    </VStack> : <VStack id="feature-requirements" role="tabpanel" aria-label="요구사항" gap={0}>
      <VStack as="nav" aria-label="명세 목차" gap={2} className={styles.documentIndex}>
        <Text type="supporting" color="secondary">이 명세의 요구사항</Text>
        {selected.requirements.map((r, index) => <a key={r.id} href={`#${r.id}`}>{String(index + 1).padStart(2, '0')}　{r.title}</a>)}
      </VStack>
      {selected.requirements.map((r, index) => (
        <VStack key={r.id} id={r.id} gap={4} className={`${styles.requirementSection} ${r.id === search.selected ? styles.highlight : ''}`}>
          <VStack gap={2}>
            <Text type="supporting" color="secondary">요구사항 {String(index + 1).padStart(2, '0')}</Text>
            <Heading level={3}>{r.title}</Heading>
            <Text type="supporting" color="secondary">{r.id}</Text>
          </VStack>
          <Markdown headingLevelStart={4}>{r.body.replace(/\r?\n([ \t]+)(기대 동작:)/g, '  \n$1$2')}</Markdown>
          <Link to="/" search={{ feature: selected.id, q: r.id }}>이 요구사항의 이력 →</Link>
        </VStack>
      ))}
      {!selected.requirements.length && <Text>현재 요구사항이 없는 기능입니다.</Text>}
    </VStack>}
  </VStack>;
}
