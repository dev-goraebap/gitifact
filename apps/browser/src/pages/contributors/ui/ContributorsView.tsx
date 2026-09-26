import type { BrowserContributorV1, BrowserSessionV3, Contributor } from '@gitifact/contracts';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { contributorOptions, contributorsOptions, historyOptions } from '../../../entities/project';
import { ApiError } from '../../../shared/api/client';
import { RequestState } from '../../../shared/ui/request-state';
import { LoadMore } from '../../../shared/ui/load-more';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Avatar } from '@astryxdesign/core/Avatar';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link } from '@tanstack/react-router';
import { avatarSource, contributorHref } from '../../../entities/contributor';
import { ChangeBadge } from '../../../entities/document';
import { ListSkeleton, type RecordSearch } from '../../../widgets/records-page';
import styles from './contributors.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { t, tNodes, useLanguage } from '../../../shared/i18n';

export function ContributorsView({session,head,email,search}: {session:BrowserSessionV3;head:string|null;email?:string|undefined;search:RecordSearch}) {
  useLanguage();
  if (!email) return <ContributorGrid session={session} search={search}/>;
  return <ContributorPage session={session} head={head} email={email}/>;
}

/** One person as the server gives them; someone who never committed to HEAD says so with a way back. */
function ContributorPage({session,head,email}: {session:BrowserSessionV3;head:string|null;email:string}) {
  const query = useQuery(contributorOptions(session, email));
  if (query.error instanceof ApiError && query.error.code === 'NOT_FOUND') return <PageState kind="not-found" title={t('contributors.notFoundTitle')} description={t('contributors.notFoundDescription', { email })} actions={<Link to="/contributors">{t('contributors.backToList')}</Link>}/>;
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!query.data) return <ListSkeleton/>;
  return <ContributorDetail session={session} head={head} person={query.data.person} features={query.data.features}/>;
}

/** Card per Git author, most commits first and twenty at a time; the whole card opens the contributor page. */
function ContributorGrid({session,search}: {session:BrowserSessionV3;search:RecordSearch}) {
  useLanguage();
  const query = useInfiniteQuery(contributorsOptions(session, search.q));
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!query.data) return <ListSkeleton/>;
  const people = query.data.pages.flatMap(page => page.people);
  if (!people.length) return <PageState kind={search.q ? 'search' : 'empty'} title={t('contributors.emptyTitle')} description={t('contributors.emptyDescription')}/>;
  return <VStack gap={3}>
    <Text type="supporting" color="secondary">{t('contributors.count', { count: query.data.pages[0]!.total })}</Text>
    <Grid columns={{ minWidth: 220, repeat: 'fill' }} gap={3}>
      {people.map(p => <ClickableCard key={p.email} label={p.name} href={contributorHref(p.email)} padding={4} elevation="none">
          <VStack gap={3} className={styles.personCard}>
            {/* The card is the link; a nested avatar link would be invalid markup. */}
            <Avatar name={p.name} src={avatarSource(p.email)} shape="circle" size="lg"/>
            <VStack gap={1} className={styles.personCardBody}>
              <Text weight="semibold" className={styles.oneLine}>{p.name}</Text>
              <Text type="supporting" color="secondary" className={styles.oneLine}>{p.email}</Text>
            </VStack>
            <HStack gap={3} wrap="wrap" className={styles.personStats}>
              <Text type="supporting" color="secondary">{t('contributors.cardCommits', { count: p.commits })}</Text>
              <Text type="supporting" color="secondary">{t('contributors.cardFeatures', { count: p.features })}</Text>
              <Timestamp value={p.latest} format="relative"/>
            </HStack>
          </VStack>
        </ClickableCard>)}
    </Grid>
    <HStack gap={0}><LoadMore label={t('contributors.more')} query={query}/></HStack>
  </VStack>;
}

function ContributorDetail({session,head,person,features}: {session:BrowserSessionV3;head:string|null;person:Contributor;features:BrowserContributorV1['features']}) {
  useLanguage();
  // This person's ten newest changes in all of history, asked of the server rather than looked for in loaded pages.
  const recent = useInfiniteQuery({ ...historyOptions(session, head ?? '', { author: person.email }, 10), enabled: !!head });
  const activities = recent.data?.pages[0]?.events ?? [];
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
          <Link to="/records" search={{author:person.email}}>{t('contributors.activity')}</Link>
        </HStack>
      </VStack>
    </HStack>
    <VStack gap={4} className={styles.personSection}>
      <Heading level={3}>{t('contributors.features')}</Heading>
      {features.length ? <Grid columns={{ minWidth: 220, repeat: 'fill' }} gap={3}>
        {features.map(feature => <ClickableCard key={feature.id} label={feature.title} href={`/features/${encodeURIComponent(feature.id)}`} padding={4} elevation="none">
          <VStack gap={1}>
            <Text weight="semibold" className={styles.oneLine}>{feature.title}</Text>
            <Text type="supporting" color="secondary">{t('contributors.featureShare', { commits: feature.commits, requirements: feature.requirements })}</Text>
          </VStack>
        </ClickableCard>)}
      </Grid> : <Text color="secondary">{t('contributors.noSpecCommits')}</Text>}
    </VStack>
    <VStack gap={4} className={styles.personSection}>
      <Heading level={3}>{t('activity.recent')}</Heading>
      {activities.length ? <VStack gap={0} className={styles.personActivity}>
        {activities.map(e => <HStack key={e.key} gap={3} className={styles.personActivityRow}>
          <ChangeBadge event={e}/>
          <Link to="/records/commits/$commit" params={{commit:e.commit}} hash={e.id} className={styles.entryTitle}>{(e.after ?? e.before)?.title ?? e.id}</Link>
          <Timestamp value={e.date} format="relative"/>
        </HStack>)}
      </VStack> : <Text color="secondary">{t('contributors.noRecentActivity')}</Text>}
    </VStack>
  </VStack>;
}
