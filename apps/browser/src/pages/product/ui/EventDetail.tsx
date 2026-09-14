import type { SpecEvent } from '@tryce/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Token } from '@astryxdesign/core/Token';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Link } from '@tanstack/react-router';
import { Person } from './Person';
import styles from './product.module.css';
const names={created:'생성',modified:'수정',deleted:'삭제',moved:'이동'};
export function EventDetail({event:e,close}: {event:SpecEvent;close:()=>void}) {
  return <VStack as="aside" aria-label="변경 상세" gap={0} className={styles.readingPane}>
    <HStack gap={3} padding={4} className={styles.readingToolbar}>
      <Token label={e.types.map(type=>names[type]).join(' · ')}/>
      <Text type="supporting" color="secondary">{e.commit.slice(0,7)}</Text>
      <Button label="상세 닫기" variant="ghost" size="sm" onClick={close}/>
    </HStack>
    <VStack padding={6} gap={5}>
      <VStack gap={2}><Heading level={2}>{(e.after??e.before)?.title}</Heading><Text type="supporting" color="secondary">{e.id}</Text></VStack>
      <HStack gap={4} wrap="wrap" className={styles.readingAuthor}><Person name={e.author} email={e.email}/><Text type="supporting" color="secondary">{new Date(e.date).toLocaleString()}</Text></HStack>
      <VStack gap={4} className={styles.readingSection}>
        <Heading level={3}>변경 후</Heading>
        {e.after?<Markdown headingLevelStart={2}>{e.after.body.replace(/\r?\n([ \t]+)(기대 동작:)/g,'  \n$1$2')}</Markdown>:<Text color="secondary">삭제된 요구사항입니다. 아래에서 삭제 전 내용을 확인할 수 있습니다.</Text>}
      </VStack>
      {e.before&&<Collapsible key={e.key} trigger="변경 전" defaultIsOpen={!e.after}><Markdown headingLevelStart={2}>{e.before.body}</Markdown></Collapsible>}
      <VStack gap={3} className={styles.readingSection}>
        <Heading level={3}>변경 이유</Heading>{e.reasons.length?e.reasons.map((r,i)=><Text key={i}>{r}</Text>):<Text color="secondary">기록된 이유가 없습니다.</Text>}
        <Text type="supporting" color="secondary">{e.message} · 커미터 {e.committer}</Text>
      </VStack>
      <Link to="/features" search={{feature:(e.after??e.before)?.specId,selected:e.id}}>현재 기능 명세 보기 →</Link>
    </VStack>
  </VStack>;
}
