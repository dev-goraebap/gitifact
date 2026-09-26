import { useEffect, useRef, useState } from 'react';
import type { AnimationItem } from 'lottie-web';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import styles from './page-loading.module.css';
import { t, useLanguage } from '../../i18n';

/** How long the rocket keeps moving after its loader starts to fade (--duration-medium, 410ms), so it never freezes in sight. */
const FADE_OUT_MS = 450;
/**
 * The player and the drawing (Rocket in Space by Steven Monson after Ilya Pavlov, LottieFiles, Lottie Simple License), asked for when
 * this module loads so they are in hand before a loader is due: it shows 100ms into a read at the earliest.
 */
const drawing = Promise.all([import('lottie-web/build/player/lottie_light'), import('./rocket-loader.json')])
  .then(([player, data]) => ({ player: player.default, data: data.default }));

/**
 * A line-drawn rocket that plays while `isPlaying`, recolored to the theme by CSS; it holds one frame when motion is reduced.
 * Until the player arrives the space stays empty at its size, so nothing moves when the rocket appears.
 */
export function LoadingMark({ isSmall = false, isPlaying = true }: { isSmall?: boolean; isPlaying?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [animation, setAnimation] = useState<AnimationItem | null>(null);
  useEffect(() => {
    let item: AnimationItem | undefined; let gone = false;
    void drawing.then(({ player, data }) => {
      if (gone || !box.current) return;
      item = player.loadAnimation({ container: box.current, renderer: 'svg', loop: true, autoplay: false, animationData: data,
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
      setAnimation(item);
    });
    return () => { gone = true; item?.destroy(); };
  }, []);
  useEffect(() => {
    if (!animation) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { animation.goToAndStop(STILL_FRAME, true); return; }
    // Each showing starts from the top of the loop, where the rocket already sways and the stars already drift, so even the
    // shortest showing (300ms) moves.
    if (isPlaying) { animation.goToAndPlay(START_FRAME, true); return; }
    // It stops only once faded out: a rocket jumping to a still pose while it fades reads as a stutter.
    const timer = window.setTimeout(() => animation.pause(), FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [animation, isPlaying]);
  return <VStack gap={0} ref={box} className={isSmall ? `${styles.mark} ${styles.small}` : styles.mark} aria-hidden="true"/>;
}
/** The frame shown when the rocket does not move: upright, among its stars. */
const STILL_FRAME = 0;
/** Where each showing starts. */
const START_FRAME = 0;

/**
 * The rocket over a screen being waited for. `window` covers the whole window on the first visit, when there is nothing
 * yet to show; otherwise it veils the content card, whose previous screen stays in view under it until the next is ready.
 */
export function PageLoader({ isVisible, place }: { isVisible: boolean; place: 'window' | 'card' }) {
  useLanguage();
  const className = [styles.overlay, place === 'window' ? styles.window : styles.veil, isVisible && styles.visible].filter(Boolean).join(' ');
  return <VStack gap={3} hAlign="center" vAlign="center" className={className}
    {...(isVisible ? { role: 'status', 'aria-label': t('request.loading') } : { 'aria-hidden': true })}>
    <LoadingMark isPlaying={isVisible}/>
    <Text type="supporting" color="secondary">{t('request.loadingRecords')}</Text>
  </VStack>;
}

/** The same rocket in place, for a read the screen starts itself: another tab, another file, the next page of a list. */
export function InlineLoader({ label }: { label?: string | undefined }) {
  useLanguage();
  return <VStack gap={2} hAlign="center" vAlign="center" className={styles.inline} role="status" aria-label={label ?? t('request.loading')}>
    <LoadingMark isSmall/>
  </VStack>;
}
