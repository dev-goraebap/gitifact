import type { SpecEvent, SpecFeature } from '@gitifact/contracts';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { VStack } from '@astryxdesign/core/VStack';
import { ResizeHandle, useResizable } from '@astryxdesign/core/Resizable';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { EventDetail } from './EventDetail';
import styles from './product.module.css';
const names={created:'추가',modified:'변경',deleted:'제거',moved:'이동'};
/** Detail drawer: full screen below the desktop breakpoint, otherwise a resizable panel docked to the end edge. The dialog itself scrolls; the header stays pinned. */
export function ActivityDetailDialog({event:e,features,close}: {event:SpecEvent;features:SpecFeature[];close:()=>void}) {
  const narrow=useMediaQuery('(max-width: 1023px)');
  const pane=useResizable({defaultSize:700,minSize:420,maxSize:1100,autoSaveId:'gitifact-activity-detail'});
  const subtitle=`${e.kind==='design'?'설계':'요구사항'} ${e.types.map(t=>names[t]).join(' · ')} · ${e.id} · ${e.commit.slice(0,7)}`;
  const onOpenChange=(open:boolean)=>{if(!open)close();};
  const docked=narrow?{variant:'fullscreen' as const}:{variant:'standard' as const,width:pane.size,position:{end:0,top:0},className:styles.drawer};
  return <Dialog isOpen onOpenChange={onOpenChange} purpose="info" padding={0} maxHeight="100dvh" {...docked}>
    <VStack gap={0} className={styles.drawerHeader}><DialogHeader title={(e.after??e.before)?.title??e.id} subtitle={subtitle} onOpenChange={onOpenChange}/></VStack>
    <VStack padding={6} gap={0}><EventDetail event={e} features={features}/></VStack>
    {!narrow&&<VStack gap={0} className={styles.drawerHandle}><ResizeHandle resizable={pane.props} isReversed hasDivider label="변경 상세 너비 조절"/></VStack>}
  </Dialog>;
}
