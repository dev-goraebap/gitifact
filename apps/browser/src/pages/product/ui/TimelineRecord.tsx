import type { SpecEvent, SpecFeature } from '@gitifact/contracts';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Link } from '@tanstack/react-router';
import styles from './product.module.css';
import { t, useLanguage } from '../../../shared/i18n';

const names=() => ({created:t('change.created'),modified:t('change.modified'),deleted:t('change.deleted'),moved:t('change.moved')});
const colors={created:'green',modified:'blue',deleted:'red',moved:'purple'} as const;
const kinds=() => ({feature:t('kind.feature'),requirement:t('kind.requirement'),design:t('kind.design'),wiki:t('kind.wiki')});

/**
 * One record a commit changed, on one line: what happened to it, what kind of record it is, its title, and where it
 * now lives. The columns hold a width so the rows under one reason line up and the eye reads down them.
 * The title is cut by CSS, not by Text's maxLines: maxLines measures every element to decide on a tooltip, which
 * forces a layout per row, and a list of 334 rows took 2.7 s to draw again when the reader came back to it.
 */
export function TimelineRecord({event:e,features,current}: {event:SpecEvent;features:SpecFeature[];current:boolean}) {
  useLanguage();
 const spec=e.after??e.before;
 const kind=e.types.includes('deleted')?'deleted':e.types.includes('modified')?'modified':e.types.includes('moved')?'moved':'created';
 const feature=e.kind==='wiki'?undefined:features.find(f=>f.id===spec?.specId);
 const page=e.kind==='wiki'?(e.after??e.before)?.path.replace(/^\.gitifact\/wiki\//,''):undefined;
 return <HStack as="li" gap={2} className={styles.record} aria-current={current?true:undefined}>
  <HStack gap={0} className={styles.recordType}><Token label={e.types.map(type=>names()[type]).join(' · ')} color={colors[kind]} size="sm"/></HStack>
  <Text type="supporting" color="secondary" className={styles.recordKind}>{kinds()[e.kind]}</Text>
  <Link to="/activity" search={s=>({...s,selected:e.key})} className={styles.recordTitle}>{spec?.title??e.id}</Link>
  {(feature??page)&&<Text type="supporting" color="secondary" className={styles.recordDot}>·</Text>}
  {feature&&<Link to="/features/$featureId" params={{featureId:feature.id}} className={styles.recordTarget}>{feature.title}</Link>}
  {page&&e.after&&<Link to="/wiki/$documentId" params={{documentId:e.id}} className={styles.recordTarget}>{page}</Link>}
  {/* A deleted page has nowhere to go; its last path still says where it was. */}
  {page&&!e.after&&<Text type="supporting" color="secondary" className={styles.recordTarget}>{page}</Text>}
 </HStack>;
}
