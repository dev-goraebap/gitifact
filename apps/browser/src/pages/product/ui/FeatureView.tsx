import type { SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Markdown } from '@astryxdesign/core/Markdown';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { DesignDocument } from './DesignDocument';
import { List, ListItem } from '@astryxdesign/core/List';
import { Link } from '@tanstack/react-router';
import type { ProductSearch } from '../model/search';
import styles from './product.module.css';
import { PageState } from '../../../shared/ui/page-state';

export function FeatureView({ features, search, change }: {
  features: SpecFeature[];
  search: ProductSearch;
  change: (s: ProductSearch) => void;
}) {
  const selected = features.find(f => f.id === search.feature || f.requirements.some(r => r.id === search.selected));
  const tab = search.tab === 'design' ? 'design' : 'requirements';
  const filtered = features.filter(f => !search.q || [f.title, f.id, ...f.requirements.map(r => r.title + ' ' + r.id)].join(' ').toLowerCase().includes(search.q.toLowerCase()));

  return (
    <VStack gap={0} className={`${styles.featureWorkspace} ${selected ? styles.featureSelected : ''}`}>
      <VStack gap={0} className={styles.featureList}>
        <VStack padding={5} gap={4}>
          <TextInput label="검색" isLabelHidden placeholder="기능·요구사항 검색" value={search.q ?? ''} hasClear onChange={q => change({ ...search, q: q || undefined })} />
          <Text type="supporting" color="secondary">기능 명세 · {filtered.length}개</Text>
        </VStack>
        <List density="spacious" hasDividers>
          {filtered.map(f => (
            <ListItem key={f.id} label={f.title} isSelected={selected?.id === f.id}
              description={<Text type="supporting" color="secondary">요구사항 {f.requirements.length}개 · {f.id}</Text>}
              onClick={() => change({ ...search, feature: f.id, selected: undefined })} />
          ))}
        </List>
        {!filtered.length && <PageState kind={features.length?'search':'empty'} isCompact title="일치하는 기능이 없습니다." description="검색어를 바꾸거나 에이전트와 기능 명세를 정리해보세요."/>}
      </VStack>
      {selected ? (
        <VStack as="aside" aria-label="기능 명세" gap={0} className={styles.specDocument}>
          <HStack gap={3} wrap="wrap" className={styles.documentToolbar}>
            <Text type="supporting" color="secondary">기능 명세 / {selected.id}</Text>
            <Button label="상세 닫기" variant="ghost" size="sm" onClick={() => change({ ...search, feature: undefined, selected: undefined })} />
          </HStack>
          <VStack gap={4} className={styles.documentHeading}>
            <Heading level={2}>{selected.title}</Heading>
            {selected.description && <Markdown>{selected.description}</Markdown>}
            <HStack gap={4} wrap="wrap">
              <Text type="supporting" color="secondary">요구사항 {selected.requirements.length}개</Text>
              <Link to="/" search={{ feature: selected.id }}>기능 변경 이력 →</Link>
            </HStack>
          </VStack>
          <TabList role="tablist" value={tab} onChange={tab => change({...search, tab, selected: undefined})} hasDivider>
            <Tab value="requirements" label="요구사항" panelId="feature-requirements"/>
            <Tab value="design" label="설계" panelId="feature-design"/>
          </TabList>
          {tab === 'design' ? <VStack id="feature-design" role="tabpanel" aria-label="설계" padding={5} gap={4}>
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
        </VStack>
      ) : <VStack className={styles.documentEmpty}><PageState title="제품의 기능을 살펴보세요." description="왼쪽에서 기능을 선택하면 요구사항과 수용 조건을 읽을 수 있습니다."/></VStack>}
    </VStack>
  );
}
