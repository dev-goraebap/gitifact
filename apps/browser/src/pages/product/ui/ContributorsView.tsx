import type { BrowserSpecsV1, SpecEvent, SpecFeature } from '@tryce/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Table, proportional } from '@astryxdesign/core/Table';
import { Link } from '@tanstack/react-router';
import { Person } from './Person';
import type { ProductSearch } from '../model/search';
import styles from './product.module.css';
import { PageState } from '../../../shared/ui/page-state';
export function ContributorsView({people,events,features,search,change}: {people:BrowserSpecsV1['contributors'];events:SpecEvent[];features:SpecFeature[];search:ProductSearch;change:(s:ProductSearch)=>void}) {
 const selected=people.find(p=>p.email===search.author);const activities=events.filter(e=>e.email===selected?.email);
 const filtered=people.filter(p=>!search.q||(p.name+' '+p.email).toLowerCase().includes(search.q.toLowerCase()));
 return <VStack gap={0} className={selected?styles.split:undefined}><VStack className={styles.list}>
 {!filtered.length?<PageState kind={search.q?'search':'empty'} title="표시할 기여자가 없습니다" description="검색어를 확인하거나 첫 커밋을 남겨보세요."/>:<Table data={filtered} idKey="email" density="compact" columns={[
 {key:'name',header:'기여자',width:proportional(2),renderCell:p=><Button variant="ghost" label={p.name} onClick={()=>change({...search,author:p.email})}/>},
 {key:'email',header:'이메일',width:proportional(3),renderCell:p=><Person name={p.email} email={p.email}/>},
 {key:'commits',header:'Git 커밋',width:proportional(1)},
 {key:'latest',header:'최근 활동',width:proportional(2),renderCell:p=><Text type="supporting">{new Date(p.latest).toLocaleDateString()}</Text>}]}/>}
 </VStack>{selected&&<VStack as="aside" aria-label="기여자 상세" padding={5} gap={4} className={styles.detail}>
 <Button label="상세 닫기" size="sm" onClick={()=>change({...search,author:undefined})}/><Person name={selected.name} email={selected.email}/><Text>{selected.email}</Text>
 <Link to="/" search={{author:selected.email}}>이 기여자의 활동 →</Link><Heading level={3}>최근 불러온 명세 활동</Heading>
 {[...new Set(activities.flatMap(e=>[e.before?.specId,e.after?.specId]).filter(Boolean))].map(id=><Link key={id} to="/features" search={{feature:id}}>{features.find(f=>f.id===id)?.title??id}</Link>)}
 {activities.slice(0,10).map(e=><Link key={e.key} to="/" search={{selected:e.key}}>{(e.after??e.before)?.title}</Link>)}
 {!activities.length&&<Text>불러온 범위에 명세 활동이 없습니다. 코드 커밋 참여와 명세 활동은 다를 수 있습니다.</Text>}
 </VStack>}</VStack>;
}
