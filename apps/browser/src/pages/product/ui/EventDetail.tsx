import type { BrowserChangeV2, SpecEvent, SpecFeature, SpecSnapshot } from '@gitifact/contracts';
import type { UseQueryResult } from '@tanstack/react-query';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@tanstack/react-router';
import { DesignDocument } from './DesignDocument';
import { Person } from './Person';
import { ChangeDiff } from './ChangeDiff';
import styles from './product.module.css';
import { t, useLanguage, getLanguage } from '../../../shared/i18n';
import { DocumentBody } from '../../../shared/ui/document';
/** Body of one activity entry: the change (a line diff when both sides exist, the document otherwise) and reasons. The surrounding drawer owns the title and close control. */
export function EventDetail({event:e,change,features}: {event:SpecEvent;change:UseQueryResult<BrowserChangeV2>;features:SpecFeature[]}) {
  useLanguage();
  // Snapshot bodies resolve their links from the path they were committed at.
  const body=(spec:SpecSnapshot)=>e.kind==='design'?<DesignDocument design={spec} path={spec.path} features={features}/>:<DocumentBody headingLevelStart={2} path={spec.path}>{spec.body}</DocumentBody>;
  return <VStack gap={5} className={styles.readingPane}>
      <HStack gap={4} wrap="wrap" className={styles.readingAuthor}><Person name={e.author} email={e.email}/><Text type="supporting" color="secondary">{new Date(e.date).toLocaleString(getLanguage())}</Text></HStack>
      <VStack gap={4} className={styles.readingSection}>
        <Heading level={3}>{e.after&&e.before?t('event.changes'):e.after?t('compare.after'):t('event.deletedContent')}</Heading>
        {change.data
          ?(change.data.after&&change.data.before?<ChangeDiff key={e.key} before={change.data.before} after={change.data.after} features={features}/>:change.data.after?body(change.data.after):change.data.before?body(change.data.before):<Text color="secondary">{t('event.noContent')}</Text>)
          :change.error
            ?<VStack gap={3} role="alert"><Text>{t('event.bodyFailed')}</Text><Text type="supporting" color="secondary">{change.error.message}</Text></VStack>
            // Shaped like a few lines of text, so the reveal below does not jump when the body arrives.
            :<VStack gap={3} role="status" aria-label={t('event.bodyLoading')}>{[92,86,74,58].map((w,i)=><Skeleton key={i} index={i} width={`${w}%`} height="var(--spacing-4)"/>)}</VStack>}
      </VStack>
      <VStack gap={3} className={styles.readingSection}>
        <Heading level={3}>{t('event.reasons')}</Heading>{e.reasons.length?e.reasons.map((r,i)=><Text key={i}>{r}</Text>):<Text color="secondary">{t('event.noReasons')}</Text>}
        <Text type="supporting" color="secondary">{e.message} · {t('event.committer', { name: e.committer })}</Text>
      </VStack>
      {e.kind==='wiki'
        ?(e.after&&<Link to="/wiki/$documentId" params={{documentId:e.id}}>{t('event.currentDocument')}</Link>)
        :<Link to="/features/$featureId" params={{featureId:(e.after??e.before)?.specId??''}} search={{selected:e.kind==='feature'?undefined:e.id,tab:e.kind==='design'?'design':'requirements'}} {...(e.kind==='feature'?{}:{hash:e.id})}>{t('event.currentFeature')}</Link>}
  </VStack>;
}
