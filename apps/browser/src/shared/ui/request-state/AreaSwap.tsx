import { useEffect, useState, type ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { LoadingMark } from './PageLoading';
import { useLoadingHold } from './useLoadingHold';
import styles from './page-loading.module.css';
import { t, useLanguage } from '../../i18n';

/**
 * One part of a screen that changes on its own, as a page move does: what it shows stays until the next is prepared.
 * `target` is what the part should show and `prepare` reads it ahead (its data and diagrams); `shown` follows `target`
 * once that is done, and `isPreparing` holds meanwhile. A preparation that fails still moves on, so the part shows the
 * failure instead of waiting for good.
 */
export function useSwap<T>(target: T, prepare: (value: T) => Promise<unknown>) {
  const [shown, setShown] = useState(target);
  const [isPreparing, setPreparing] = useState(false);
  useEffect(() => {
    if (Object.is(target, shown)) { setPreparing(false); return; }
    let gone = false;
    setPreparing(true);
    void prepare(target).catch(() => undefined).then(() => { if (!gone) { setShown(target); setPreparing(false); } });
    return () => { gone = true; };
    // `prepare` is read when the target changes; a new function for the same target starts nothing.
  }, [target, shown]);
  return { shown, isPreparing };
}

/**
 * The part `useSwap` changes, with the same veil a page move has over that part only: it shows once the wait passes
 * 100ms, stays at least 300ms and lifts once the next content is drawn. `contentKey` names what is shown, so the next
 * content fades in where it stands.
 */
export function AreaSwap({ isPreparing, contentKey, children }: { isPreparing: boolean; contentKey: string; children: ReactNode }) {
  useLanguage();
  const veiled = useLoadingHold(isPreparing, { delay: 100, minimum: 300 });
  return <div className={styles.areaHost}>
    <div key={contentKey} className={styles.areaContent}>{children}</div>
    <VStack gap={0} hAlign="center" className={[styles.overlay, styles.area, veiled && styles.visible].filter(Boolean).join(' ')}
      {...(veiled ? { role: 'status', 'aria-label': t('request.loading') } : { 'aria-hidden': true })}>
      <LoadingMark isSmall isPlaying={veiled}/>
    </VStack>
  </div>;
}
