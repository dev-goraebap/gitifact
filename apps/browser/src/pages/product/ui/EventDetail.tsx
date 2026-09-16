import type { SpecEvent, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Link } from '@tanstack/react-router';
import { DesignDocument } from './DesignDocument';
import { Person } from './Person';
import { ChangeCompare } from './ChangeCompare';
import styles from './product.module.css';
type SpecBody = NonNullable<SpecEvent['after']>;
/** Body of one activity entry: the change (a before/after reveal when both exist) and reasons. The surrounding drawer owns the title and close control. */
export function EventDetail({event:e,features}: {event:SpecEvent;features:SpecFeature[]}) {
  const body=(spec:SpecBody)=>e.kind==='design'?<DesignDocument design={{...spec,requirements:[]}} features={features}/>:<Markdown headingLevelStart={2}>{spec.body.replace(/\r?\n([ \t]+)(기대 동작:)/g,'  \n$1$2')}</Markdown>;
  return <VStack gap={5} className={styles.readingPane}>
      <HStack gap={4} wrap="wrap" className={styles.readingAuthor}><Person name={e.author} email={e.email}/><Text type="supporting" color="secondary">{new Date(e.date).toLocaleString()}</Text></HStack>
      <VStack gap={4} className={styles.readingSection}>
        <Heading level={3}>{e.after&&e.before?'변경 내용':e.after?'변경 후':'삭제 전 내용'}</Heading>
        {e.after&&e.before?<ChangeCompare key={e.key} before={body(e.before)} after={body(e.after)}/>:e.after?body(e.after):e.before?body(e.before):<Text color="secondary">내용이 없습니다.</Text>}
      </VStack>
      <VStack gap={3} className={styles.readingSection}>
        <Heading level={3}>변경 이유</Heading>{e.reasons.length?e.reasons.map((r,i)=><Text key={i}>{r}</Text>):<Text color="secondary">기록된 이유가 없습니다.</Text>}
        <Text type="supporting" color="secondary">{e.message} · 커미터 {e.committer}</Text>
      </VStack>
      {e.kind==='product'||e.kind==='guide'
        ?(e.after&&(e.kind==='product'?<Link to="/product">현재 제품 개요 보기 →</Link>:<Link to="/guides/$documentId" params={{documentId:e.id}}>현재 문서 보기 →</Link>))
        :<Link to="/features/$featureId" params={{featureId:(e.after??e.before)?.specId??''}} search={{selected:e.kind==='design'?undefined:e.id,tab:e.kind==='design'?'design':'requirements'}}>현재 기능 명세 보기 →</Link>}
  </VStack>;
}
