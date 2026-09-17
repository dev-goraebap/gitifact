import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import styles from './product.module.css';
import { t } from '../../../shared/i18n';

/**
 * Before/after reveal: the after body sits underneath, the before body is layered on top and clipped to the
 * left of a draggable handle, so pulling the handle to the right uncovers the earlier text in place.
 * Both layers share one grid cell, so the block is as tall as the taller of the two.
 * The handle is hand-rolled: Astryx's ResizeHandle only accepts pointer input on its own 1px root, which does not
 * work for a line that has to be grabbed anywhere over flowing text.
 */
export function ChangeCompare({ before, after }: { before: ReactNode; after: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState(0);
  const [dragging, setDragging] = useState(false);
  const width = () => container.current?.clientWidth ?? 0;
  const clamp = (x: number) => Math.min(width(), Math.max(0, Math.round(x)));
  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = container.current?.getBoundingClientRect();
    if (rect) setReveal(clamp(event.clientX - rect.left));
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    fromPointer(event);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => { if (dragging) fromPointer(event); };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 80 : 16;
    const next = { ArrowRight: reveal + step, ArrowLeft: reveal - step, Home: 0, End: width() }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setReveal(clamp(next));
  };
  const percent = width() ? Math.round((reveal / width()) * 100) : 0;
  const style = { '--reveal': `${reveal}px` } as CSSProperties;
  return <VStack gap={3}>
    <HStack gap={2} wrap="wrap" className={styles.compareLegend}>
      <Button label={t('compare.before')} size="sm" variant={reveal > 0 ? 'secondary' : 'ghost'} onClick={() => setReveal(width())} />
      <Button label={t('compare.after')} size="sm" variant={reveal > 0 ? 'ghost' : 'secondary'} onClick={() => setReveal(0)} />
      <Text type="supporting" color="secondary">{t('compare.hint')}</Text>
    </HStack>
    <VStack ref={container} gap={0} className={styles.compare} style={style} data-dragging={dragging || undefined}>
      <VStack gap={0} className={styles.compareAfter} aria-label={t('compare.after')}>{after}</VStack>
      <VStack gap={0} className={styles.compareBefore} aria-label={t('compare.before')}>{before}</VStack>
      <VStack gap={0} role="separator" aria-orientation="vertical" aria-label={t('compare.reveal')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} tabIndex={0}
        className={styles.compareHandle} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown} />
    </VStack>
  </VStack>;
}
