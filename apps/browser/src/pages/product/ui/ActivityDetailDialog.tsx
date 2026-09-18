import type { SpecEvent, SpecFeature } from '@gitifact/contracts';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { VStack } from '@astryxdesign/core/VStack';
import { ResizeHandle, useResizable } from '@astryxdesign/core/Resizable';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { EventDetail } from './EventDetail';
import styles from './product.module.css';
import { t } from '../../../shared/i18n';
const names={created:t('change.created'),modified:t('change.modified'),deleted:t('change.deleted'),moved:t('change.moved')};
const kinds={requirement:t('kind.requirement'),design:t('kind.design'),wiki:t('kind.wiki')};
/** Detail drawer: full screen below the desktop breakpoint, otherwise a resizable panel docked to the end edge. The dialog itself scrolls; the header stays pinned. */
export function ActivityDetailDialog({event:e,features,close}: {event:SpecEvent;features:SpecFeature[];close:()=>void}) {
  const narrow=useMediaQuery('(max-width: 1023px)');
  const pane=useResizable({defaultSize:700,minSize:420,maxSize:1100,autoSaveId:'gitifact-activity-detail'});
  const subtitle=`${kinds[e.kind??'requirement']} ${e.types.map(type=>names[type]).join(' · ')} · ${e.id} · ${e.commit.slice(0,7)}`;
  const onOpenChange=(open:boolean)=>{if(!open)close();};
  const docked=narrow?{variant:'fullscreen' as const}:{variant:'standard' as const,width:pane.size,position:{end:0,top:0},className:styles.drawer};
  return <Dialog isOpen onOpenChange={onOpenChange} purpose="info" padding={0} maxHeight="100dvh" {...docked}>
    <VStack gap={0} className={styles.drawerHeader}><DialogHeader title={(e.after??e.before)?.title??e.id} subtitle={subtitle} onOpenChange={onOpenChange}/></VStack>
    <VStack padding={6} gap={0}><EventDetail event={e} features={features}/></VStack>
    {!narrow&&<VStack gap={0} className={styles.drawerHandle}><ResizeHandle resizable={pane.props} isReversed hasDivider label={t('activity.resizeDetail')}/></VStack>}
  </Dialog>;
}
