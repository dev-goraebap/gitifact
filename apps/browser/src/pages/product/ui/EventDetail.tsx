import type { SpecEvent, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Link } from '@tanstack/react-router';
import { DesignDocument } from './DesignDocument';
import { Person } from './Person';
import styles from './product.module.css';
/** Body of one activity entry: after, before (collapsed) and reasons. The surrounding drawer owns the title and close control. */
export function EventDetail({event:e,features}: {event:SpecEvent;features:SpecFeature[]}) {
  return <VStack gap={5} className={styles.readingPane}>
      <HStack gap={4} wrap="wrap" className={styles.readingAuthor}><Person name={e.author} email={e.email}/><Text type="supporting" color="secondary">{new Date(e.date).toLocaleString()}</Text></HStack>
      <VStack gap={4} className={styles.readingSection}>
        <Heading level={3}>변경 후</Heading>
        {e.after?(e.kind==='design'?<DesignDocument design={{...e.after,requirements:[]}} features={features}/>:<Markdown headingLevelStart={2}>{e.after.body.replace(/\r?\n([ \t]+)(기대 동작:)/g,'  \n$1$2')}</Markdown>):<Text color="secondary">삭제된 명세입니다. 아래에서 삭제 전 내용을 확인할 수 있습니다.</Text>}
      </VStack>
      {e.before&&<Collapsible key={e.key} trigger="변경 전" defaultIsOpen={!e.after}><Markdown headingLevelStart={2}>{e.before.body}</Markdown></Collapsible>}
      <VStack gap={3} className={styles.readingSection}>
        <Heading level={3}>변경 이유</Heading>{e.reasons.length?e.reasons.map((r,i)=><Text key={i}>{r}</Text>):<Text color="secondary">기록된 이유가 없습니다.</Text>}
        <Text type="supporting" color="secondary">{e.message} · 커미터 {e.committer}</Text>
      </VStack>
      <Link to="/features/$featureId" params={{featureId:(e.after??e.before)?.specId??''}} search={{selected:e.kind==='design'?undefined:e.id,tab:e.kind==='design'?'design':'requirements'}}>현재 기능 명세 보기 →</Link>
  </VStack>;
}
