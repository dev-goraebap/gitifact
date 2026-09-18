import type { SpecEvent, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@tanstack/react-router';
import { DesignDocument } from './DesignDocument';
import { Person } from './Person';
import { ChangeCompare } from './ChangeCompare';
import styles from './product.module.css';
import { t } from '../../../shared/i18n';
import { DocumentBody } from '../../../shared/ui/document';
type SpecBody = NonNullable<SpecEvent['after']>;
/** Body of one activity entry: the change (a before/after reveal when both exist) and reasons. The surrounding drawer owns the title and close control. */
export function EventDetail({event:e,features}: {event:SpecEvent;features:SpecFeature[]}) {
  // Snapshot bodies resolve their links from the path they were committed at.
  const body=(spec:SpecBody)=>e.kind==='design'?<DesignDocument design={spec} path={spec.path} features={features}/>:<DocumentBody headingLevelStart={2} path={spec.path}>{spec.body.replace(/\r?\n([ \t]+)(기대 동작:)/g,'  \n$1$2')}</DocumentBody>;
  return <VStack gap={5} className={styles.readingPane}>
      <HStack gap={4} wrap="wrap" className={styles.readingAuthor}><Person name={e.author} email={e.email}/><Text type="supporting" color="secondary">{new Date(e.date).toLocaleString()}</Text></HStack>
      <VStack gap={4} className={styles.readingSection}>
        <Heading level={3}>{e.after&&e.before?t('event.changes'):e.after?t('compare.after'):t('event.deletedContent')}</Heading>
        {e.after&&e.before?<ChangeCompare key={e.key} before={body(e.before)} after={body(e.after)}/>:e.after?body(e.after):e.before?body(e.before):<Text color="secondary">{t('event.noContent')}</Text>}
      </VStack>
      <VStack gap={3} className={styles.readingSection}>
        <Heading level={3}>{t('event.reasons')}</Heading>{e.reasons.length?e.reasons.map((r,i)=><Text key={i}>{r}</Text>):<Text color="secondary">{t('event.noReasons')}</Text>}
        <Text type="supporting" color="secondary">{e.message} · {t('event.committer', { name: e.committer })}</Text>
      </VStack>
      {e.kind==='wiki'
        ?(e.after&&<Link to="/wiki/$documentId" params={{documentId:e.id}}>{t('event.currentDocument')}</Link>)
        :<Link to="/features/$featureId" params={{featureId:(e.after??e.before)?.specId??''}} search={{selected:e.kind==='design'?undefined:e.id,tab:e.kind==='design'?'design':'requirements'}}>{t('event.currentFeature')}</Link>}
  </VStack>;
}
