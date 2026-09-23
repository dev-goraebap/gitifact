import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, SpecEvent, SpecFeature, SpecSnapshot } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Link } from '@tanstack/react-router';
import { commitOptions } from '../../../entities/project';
import { Person } from '../../../entities/contributor';
import { ChangeBadge, DesignDocument, KindToken } from '../../../entities/document';
import { groupReasons } from '../../../widgets/activity-timeline';
import { ChangeDiff } from './ChangeDiff';
import { CommitSource } from './CommitSource';
import styles from './commit.module.css';
import { DocumentBody } from '../../../shared/ui/document';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
import { t, useLanguage } from '../../../shared/i18n';


/**
 * One commit, read as it was made: who wrote it and why, then each document it changed with its differences, then
 * the source beside them. A change is a section of this page, so the reader compares at the width of the screen and
 * keeps one address for the whole commit; a link that names a document opens the page at that section.
 */
export function CommitView({ commit, documentId, session, features, head }: { commit: string; documentId?: string | undefined; session: BrowserSessionV3; features: SpecFeature[]; head: string | null }) {
  useLanguage();
  const query = useQuery(commitOptions(session, commit));
  const data = query.data;
  // An address typed or shared from outside names its section before the page has drawn it, so the page lands on it.
  useEffect(() => { if (data && documentId) document.getElementById(documentId)?.scrollIntoView({ block: 'start' }); }, [data, documentId]);
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!data) return <VStack gap={4} role="status" aria-label={t('commit.loading')}>{[40, 90, 70, 96, 84].map((w, i) => <Skeleton key={i} index={i} width={`${w}%`} height="var(--spacing-5)"/>)}</VStack>;
  const reasons = groupReasons(data.changes.map(c => c.event));
  const body = (event: SpecEvent, spec: SpecSnapshot) => event.kind === 'design'
    ? <DesignDocument design={spec} path={spec.path} features={features}/>
    : <DocumentBody headingLevelStart={4} path={spec.path}>{spec.body}</DocumentBody>;
  return <VStack gap={0} as="article" aria-label={t('commit.title')} className={styles.commitPage}>
    <Link to="/activity" className={styles.commitBack}>{t('commit.back')}</Link>
    <VStack gap={4} className={styles.commitHeading}>
      <Heading level={1}>{data.message}</Heading>
      <HStack gap={4} wrap="wrap" className={styles.commitMeta}>
        <Person name={data.author} email={data.email}/>
        <Timestamp value={data.date} format="relative"/>
        <Text type="supporting" color="secondary">{new Date(data.date).toLocaleString()}</Text>
        <Text type="supporting" color="secondary" className={styles.commitHash}>{data.commit.slice(0, 12)}</Text>
        {data.committer !== data.author && <Text type="supporting" color="secondary">{t('event.committer', { name: data.committer })}</Text>}
      </HStack>
    </VStack>

    <VStack as="section" gap={3} aria-label={t('event.reasons')} className={styles.commitSection}>
      <Heading level={2}>{t('event.reasons')}</Heading>
      {reasons.length ? reasons.map((group, i) => <VStack key={i} gap={2} className={styles.reason}>
        {group.reasons.length ? group.reasons.map((reason, r) => <Text key={r}>{reason}</Text>) : <Text color="secondary">{t('event.noReasons')}</Text>}
        <HStack gap={2} wrap="wrap" className={styles.reasonRecords}>
          {/* The records this reason explains: each jumps to its section further down the page. */}
          {group.events.map(e => <a key={e.key} href={`#${e.id}`} className={styles.reasonRecord}>
            <KindToken kind={e.kind}/>{(e.after ?? e.before)?.title ?? e.id}
          </a>)}
        </HStack>
      </VStack>) : <Text color="secondary">{t('event.noReasons')}</Text>}
    </VStack>

    {data.changes.map(({ event, before, after }) => <VStack key={event.key} id={event.id} as="section" gap={4}
      aria-label={(after ?? before)?.title ?? event.id} className={styles.change} {...(event.id === documentId ? { 'aria-current': 'location' as const } : {})}>
      <VStack gap={2}>
        <HStack gap={2} wrap="wrap" className={styles.changeHead}>
          <ChangeBadge event={event}/>
          <Heading level={2}>{(after ?? before)?.title ?? event.id}</Heading>
        </HStack>
        <HStack gap={3} wrap="wrap" className={styles.changePlace}>
          <Text type="supporting" color="secondary">{event.id}</Text>
          <Text type="supporting" color="secondary">{(after ?? before)?.path}</Text>
          {event.kind === 'wiki'
            ? after && <Link to="/wiki/$documentId" params={{ documentId: event.id }}>{t('event.currentDocument')}</Link>
            : <Link to="/features/$featureId" params={{ featureId: (after ?? before)?.specId ?? '' }}
              search={{ ...(event.kind === 'feature' ? {} : { selected: event.id, tab: event.kind === 'design' ? 'design' : 'requirements' }) }}
              {...(event.kind === 'feature' ? {} : { hash: event.id })}>{t('event.currentFeature')}</Link>}
          {head && <Link to="/activity" search={{ q: event.id }}>{t('commit.documentHistory')}</Link>}
        </HStack>
      </VStack>
      {before && after ? <ChangeDiff before={before} after={after} features={features}/>
        : after ? body(event, after) : before ? body(event, before) : <Text color="secondary">{t('event.noContent')}</Text>}
    </VStack>)}
    {!data.changes.length && <PageState isCompact title={t('commit.noDocuments')} description={t('commit.noDocumentsDescription')}/>}

    <CommitSource session={session} commit={commit}/>
  </VStack>;
}
