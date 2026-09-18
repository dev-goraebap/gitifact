import type { BrowserSpecsV2, SpecEvent, SpecFeature } from '@gitifact/contracts';
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
import { t, tNodes } from '../../../shared/i18n';

type Contributor = BrowserSpecsV2['contributors'][number];
const names = {created:t('change.created'),modified:t('change.modified'),deleted:t('change.deleted'),moved:t('change.moved')};

export function ContributorsView({people,events,features,email,search}: {people:Contributor[];events:SpecEvent[];features:SpecFeature[];email?:string|undefined;search:ProductSearch}) {
  if (!email) return <ContributorGrid people={people} features={features} search={search}/>;
  const selected = people.find(p => p.email === email);
  if (!selected) return <PageState kind="not-found" title={t('contributors.notFoundTitle')} description={t('contributors.notFoundDescription', { email })} actions={<Link to="/contributors">{t('contributors.backToList')}</Link>}/>;
  return <ContributorDetail person={selected} events={events} features={features}/>;
}

/** Card per Git author; the whole card opens the contributor page. */
function ContributorGrid({people,features,search}: {people:Contributor[];features:SpecFeature[];search:ProductSearch}) {
  const filtered = people.filter(p => !search.q || (p.name + ' ' + p.email).toLowerCase().includes(search.q.toLowerCase()));
  if (!filtered.length) return <PageState kind={search.q ? 'search' : 'empty'} title={t('contributors.emptyTitle')} description={t('contributors.emptyDescription')}/>;
  return <VStack gap={3}>
    <Text type="supporting" color="secondary">{t('contributors.count', { count: filtered.length })}</Text>
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
              <Text type="supporting" color="secondary">{t('contributors.cardCommits', { count: p.commits })}</Text>
              <Text type="supporting" color="secondary">{t('contributors.cardFeatures', { count: touched })}</Text>
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
  return <VStack as="article" aria-label={t('contributors.detail')} gap={0} className={styles.featureDetail}>
    <Link to="/contributors" className={styles.featureBack}>{t('contributors.back')}</Link>
    <HStack gap={5} className={styles.personHero}>
      <Avatar name={person.name} src={avatarSource(person.email)} shape="circle" size={72}/>
      <VStack gap={2} className={styles.entryBody}>
        <Heading level={1}>{person.name}</Heading>
        <Text color="secondary">{person.email}</Text>
        <HStack gap={4} wrap="wrap">
          <Text type="supporting" color="secondary">{t('contributors.gitCommits', { count: person.commits })}</Text>
          <Text type="supporting" color="secondary">{tNodes('contributors.latest', { time: <Timestamp value={person.latest} format="relative" type="inherit" color="inherit"/> })}</Text>
          <Link to="/activity" search={{author:person.email}}>{t('contributors.activity')}</Link>
        </HStack>
      </VStack>
    </HStack>
    <VStack gap={4} className={styles.personSection}>
      <Heading level={3}>{t('contributors.features')}</Heading>
      {touched.length ? <Grid columns={{ minWidth: 220, repeat: 'fill' }} gap={3}>
        {touched.map(({feature, share}) => <ClickableCard key={feature.id} label={feature.title} href={`/features/${encodeURIComponent(feature.id)}`} padding={4} elevation="none">
          <VStack gap={1}>
            <Text weight="semibold" maxLines={1}>{feature.title}</Text>
            <Text type="supporting" color="secondary">{t('contributors.featureShare', { commits: share!.commits, requirements: feature.requirements.length })}</Text>
          </VStack>
        </ClickableCard>)}
      </Grid> : <Text color="secondary">{t('contributors.noSpecCommits')}</Text>}
    </VStack>
    <VStack gap={4} className={styles.personSection}>
      <Heading level={3}>{t('activity.recent')}</Heading>
      {activities.length ? <VStack gap={0} className={styles.personActivity}>
        {activities.slice(0, 10).map(e => <HStack key={e.key} gap={3} className={styles.personActivityRow}>
          <Token label={e.types.map(type => names[type]).join(' · ')} color={e.types.includes('deleted') ? 'red' : e.types.includes('modified') ? 'blue' : e.types.includes('moved') ? 'purple' : 'green'}/>
          <Text type="supporting" color="secondary">{e.kind === 'design' ? t('kind.design') : e.kind === 'wiki' ? t('kind.wiki') : t('kind.requirement')}</Text>
          <Link to="/activity" search={{selected:e.key}} className={styles.entryTitle}>{(e.after ?? e.before)?.title ?? e.id}</Link>
          <Timestamp value={e.date} format="relative"/>
        </HStack>)}
      </VStack> : <Text color="secondary">{t('contributors.noRecentActivity')}</Text>}
    </VStack>
  </VStack>;
}
