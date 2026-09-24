import type { SpecEvent, SpecFeature } from '@gitifact/contracts';
import { HStack } from '@astryxdesign/core/HStack';
import { Link } from '@tanstack/react-router';
import { ChangeBadge } from '../../../entities/document';
import styles from './timeline.module.css';
import { useLanguage } from '../../../shared/i18n';


/**
 * One document a commit changed, on one line: a badge of what happened to it and what kind of document it is, then
 * where it sits, the feature in quiet text and a dot before the document the link opens — its part of the record's
 * page under a record (`record`), its section of the commit page otherwise. A wiki page (from before the wiki left
 * the browser) and a feature's own introduction are named by their title alone. The title follows its badge directly
 * rather than a column of fixed width, so a short badge leaves no gap.
 * The title is cut by CSS, not by Text's maxLines: maxLines measures every element to decide on a tooltip, which
 * forces a layout per row, and a list of 334 rows took 2.7 s to draw again when the reader came back to it.
 */
export function TimelineRecord({event:e,features,record}: {event:SpecEvent;features:SpecFeature[];record?:string}) {
  useLanguage();
 const spec=e.after??e.before;
 // The feature a requirement or design belongs to now; a feature removed since then leaves the title on its own.
 const feature=e.kind==='requirement'||e.kind==='design'?features.find(f=>f.id===spec?.specId):undefined;
 return <HStack as="li" gap={2} className={styles.record}>
  <HStack gap={0} className={styles.recordBadge}><ChangeBadge event={e}/></HStack>
  <span className={styles.recordPath}>
   {feature&&<><span className={styles.recordFeature}>{feature.title}</span><span className={styles.recordDot} aria-hidden>·</span></>}
   {record
    ? <Link to="/records/$recordId" params={{recordId:record}} hash={e.id} className={styles.recordTitle}>{spec?.title??e.id}</Link>
    : <Link to="/records/commits/$commit" params={{commit:e.commit}} hash={e.id} className={styles.recordTitle}>{spec?.title??e.id}</Link>}
  </span>
 </HStack>;
}
