import type { BrowserSpecsV1, SpecEvent, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Avatar } from '@astryxdesign/core/Avatar';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link } from '@tanstack/react-router';
import { avatarSource, contributorHref } from './Person';
import type { ProductSearch } from '../model/search';
import styles from './product.module.css';
import { PageState } from '../../../shared/ui/page-state';

type Contributor = BrowserSpecsV1['contributors'][number];
const names = {created:'추가',modified:'변경',deleted:'제거',moved:'이동'};

export function ContributorsView({people,events,features,search}: {people:Contributor[];events:SpecEvent[];features:SpecFeature[];search:ProductSearch;change:(s:ProductSearch)=>void}) {
  const selected = people.find(p => p.email === search.author);
  return selected ? <ContributorDetail person={selected} events={events} features={features}/> : <ContributorGrid people={people} features={features} search={search}/>;
}

/** Card per Git author; the whole card opens the contributor page. */
function ContributorGrid({people,features,search}: {people:Contributor[];features:SpecFeature[];search:ProductSearch}) {
  const filtered = people.filter(p => !search.q || (p.name + ' ' + p.email).toLowerCase().includes(search.q.toLowerCase()));
  if (!filtered.length) return <PageState kind={search.q ? 'search' : 'empty'} title="표시할 기여자가 없습니다" description="검색어를 확인하거나 첫 커밋을 남겨보세요."/>;
  return <VStack gap={3}>
    <Text type="supporting" color="secondary">기여자 {filtered.length}명 · Git author 기준이며 커밋 수는 코드 커밋을 포함합니다.</Text>
    <Grid columns={{ minWidth: 220, repeat: 'fill' }} gap={3}>
      {filtered.map(p => {
        const touched = features.filter(f => f.contributors.some(c => c.email === p.email)).length;
        return <ClickableCard key={p.email} label={p.name} href={contributorHref(p.email)} padding={4} elevation="none">
          <VStack gap={3} className={styles.personCard}>
            {/* The card is the link; a nested avatar link would be invalid markup. */}
            <Avatar name={p.name} src={avatarSource(p.email)} shape="circle" size="lg"/>
            <VStack gap={1} className={styles.personCardBody}>
              <Text weight="semibold" maxLines={1}>{p.name}</Text>
              <Text type="supporting" color="secondary" maxLines={1}>{p.email}</Text>
            </VStack>
            <HStack gap={3} wrap="wrap" className={styles.personStats}>
              <Text type="supporting" color="secondary">커밋 {p.commits}</Text>
              <Text type="supporting" color="secondary">기능 {touched}</Text>
              <Timestamp value={p.latest} format="relative"/>
            </HStack>
          </VStack>
        </ClickableCard>;
      })}
    </Grid>
  </VStack>;
}

function ContributorDetail({person,events,features}: {person:Contributor;events:SpecEvent[];features:SpecFeature[]}) {
  const activities = events.filter(e => e.email === person.email);
  const touched = features.map(f => ({ feature: f, share: f.contributors.find(c => c.email === person.email) })).filter(x => x.share);
  return <VStack as="article" aria-label="기여자 상세" gap={0} className={styles.featureDetail}>
    <Link to="/contributors" className={styles.featureBack}>← 기여자</Link>
    <HStack gap={5} className={styles.personHero}>
      <Avatar name={person.name} src={avatarSource(person.email)} shape="circle" size={72}/>
      <VStack gap={2} className={styles.entryBody}>
        <Heading level={1}>{person.name}</Heading>
        <Text color="secondary">{person.email}</Text>
        <HStack gap={4} wrap="wrap">
          <Text type="supporting" color="secondary">Git 커밋 {person.commits}개</Text>
          <Text type="supporting" color="secondary">최근 활동 <Timestamp value={person.latest} format="relative" type="inherit" color="inherit"/></Text>
          <Link to="/" search={{author:person.email}}>이 기여자의 활동 →</Link>
        </HStack>
      </VStack>
    </HStack>
    <VStack gap={4} className={styles.readingSection}>
      <Heading level={3}>참여한 기능</Heading>
      {touched.length ? <Grid columns={{ minWidth: 220, repeat: 'fill' }} gap={3}>
        {touched.map(({feature, share}) => <ClickableCard key={feature.id} label={feature.title} href={`/features?feature=${encodeURIComponent(feature.id)}`} padding={4} elevation="none">
          <VStack gap={1}>
            <Text weight="semibold" maxLines={1}>{feature.title}</Text>
            <Text type="supporting" color="secondary">명세 커밋 {share!.commits}개 · 요구사항 {feature.requirements.length}개</Text>
          </VStack>
        </ClickableCard>)}
      </Grid> : <Text color="secondary">명세 폴더를 바꾼 커밋이 없습니다. 코드 커밋 참여와 명세 활동은 다를 수 있습니다.</Text>}
    </VStack>
    <VStack gap={4} className={styles.readingSection}>
      <Heading level={3}>최근 불러온 명세 활동</Heading>
      {activities.length ? <VStack gap={0} className={styles.personActivity}>
        {activities.slice(0, 10).map(e => <HStack key={e.key} gap={3} className={styles.personActivityRow}>
          <Token label={e.types.map(t => names[t]).join(' · ')} color={e.types.includes('deleted') ? 'red' : e.types.includes('modified') ? 'blue' : e.types.includes('moved') ? 'purple' : 'green'}/>
          <Text type="supporting" color="secondary">{e.kind === 'design' ? '설계' : '요구사항'}</Text>
          <Link to="/" search={{selected:e.key}} className={styles.entryTitle}>{(e.after ?? e.before)?.title ?? e.id}</Link>
          <Timestamp value={e.date} format="relative"/>
        </HStack>)}
      </VStack> : <Text color="secondary">불러온 범위에 명세 활동이 없습니다. 활동 페이지에서 이전 이력을 더 불러오면 늘어날 수 있습니다.</Text>}
    </VStack>
  </VStack>;
}
