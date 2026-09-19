import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV2, SpecEvent, SpecFeature } from '@gitifact/contracts';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { ResizeHandle, useResizable } from '@astryxdesign/core/Resizable';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { changeOptions } from '../../../entities/project';
import { EventDetail } from './EventDetail';
import styles from './product.module.css';
import { t } from '../../../shared/i18n';
const names={created:t('change.created'),modified:t('change.modified'),deleted:t('change.deleted'),moved:t('change.moved')};
const kinds={requirement:t('kind.requirement'),design:t('kind.design'),wiki:t('kind.wiki')};
/**
 * Detail drawer for one change, opened by its key. The change is read by that key, so a link to any change opens —
 * one from a contributor's page or an old bookmark, not only one in the loaded list. When the entry is in the list
 * its heading shows at once while the text is read. Full screen below the desktop breakpoint, otherwise a resizable
 * panel docked to the end edge; the dialog scrolls and the header stays pinned.
 */
export function ActivityDetailDialog({changeKey,listed,features,session,close}: {changeKey:string;listed:SpecEvent|undefined;features:SpecFeature[];session:BrowserSessionV2;close:()=>void}) {
  const narrow=useMediaQuery('(max-width: 1023px)');
  const pane=useResizable({defaultSize:700,minSize:420,maxSize:1100,autoSaveId:'gitifact-activity-detail'});
  const change=useQuery(changeOptions(session,changeKey));
  const e=listed??change.data?.event;
  const subtitle=e?`${kinds[e.kind]} ${e.types.map(type=>names[type]).join(' · ')} · ${e.id} · ${e.commit.slice(0,7)}`:'';
  const onOpenChange=(open:boolean)=>{if(!open)close();};
  const docked=narrow?{variant:'fullscreen' as const}:{variant:'standard' as const,width:pane.size,position:{end:0,top:0},className:styles.drawer};
  return <Dialog isOpen onOpenChange={onOpenChange} purpose="info" padding={0} maxHeight="100dvh" {...docked}>
    <VStack gap={0} className={styles.drawerHeader}><DialogHeader title={e?(e.after??e.before)?.title??e.id:t('event.bodyLoading')} subtitle={subtitle} onOpenChange={onOpenChange}/></VStack>
    <VStack padding={6} gap={0}>
      {e?<EventDetail event={e} change={change} features={features}/>
        :change.error?<VStack role="alert" gap={2}><Text>{t('history.selectedMissing')}</Text><Text type="supporting" color="secondary">{change.error.message}</Text></VStack>
        :<VStack gap={3} role="status" aria-label={t('event.bodyLoading')}>{[60,92,86,74].map((w,i)=><Skeleton key={i} index={i} width={`${w}%`} height="var(--spacing-4)"/>)}</VStack>}
    </VStack>
    {!narrow&&<VStack gap={0} className={styles.drawerHandle}><ResizeHandle resizable={pane.props} isReversed hasDivider label={t('activity.resizeDetail')}/></VStack>}
  </Dialog>;
}
