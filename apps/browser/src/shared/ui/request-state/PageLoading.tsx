import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { AnimationItem } from 'lottie-web';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { useLoadingHold } from './useLoadingHold';
import styles from './page-loading.module.css';
import { t, useLanguage } from '../../i18n';

/**
 * How a page's first reads report to the frame that holds the one loader, and whether the screen is on view. They are two
 * contexts: the report never changes, so a screen that only reports is not drawn again when the loader comes and goes.
 */
const ReportContext = createContext<(id: string, pending: boolean) => void>(() => {});
const RevealedContext = createContext(true);

/**
 * The loader of the content frame. Every read a screen needs before it can be drawn reports here; the screen stays hidden
 * until all of them answer, so it appears once and whole instead of in parts. The loader waits 100ms before showing, so a
 * fast answer shows nothing, and once shown it stays 300ms, so it never blinks. `place` names the screen: a new screen
 * starts hidden again, while reads after the screen appeared (another file, the next filter) are drawn where they happen.
 */
export function usePageLoadingFrame(place: string) {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [revealedAt, setRevealedAt] = useState<string | null>(null);
  // The latest count, which a render's own `pending` may not hold yet: a screen's first reads report after its first render.
  const count = useRef(0);
  const report = useCallback((id: string, isPending: boolean) => setPending(previous => {
    if (previous.has(id) === isPending) return previous;
    const next = new Set(previous);
    if (isPending) next.add(id); else next.delete(id);
    count.current = next.size;
    return next;
  }), []);
  const revealed = revealedAt === place;
  // The last answer's screen is laid out and painted in the frame after it is committed. The wait lasts until that frame
  // has passed, so that heavy frame falls under the loader rather than on the first frame of the fade.
  const [settling, setSettling] = useState(false);
  const hadPending = useRef(false);
  useEffect(() => {
    if (pending.size > 0) { hadPending.current = true; setSettling(false); return; }
    if (!hadPending.current) return;
    hadPending.current = false; setSettling(true);
    let second = 0;
    const first = window.requestAnimationFrame(() => { second = window.requestAnimationFrame(() => setSettling(false)); });
    return () => { window.cancelAnimationFrame(first); window.cancelAnimationFrame(second); };
  }, [pending.size]);
  const waiting = !revealed && (pending.size > 0 || settling);
  const showing = useLoadingHold(waiting, { delay: 100, minimum: 300 });
  // The screen counts as on view one frame after nothing is left to wait for, once its reports have surely arrived.
  useEffect(() => {
    if (waiting || showing || revealed) return;
    const frame = window.requestAnimationFrame(() => { if (count.current === 0) setRevealedAt(place); });
    return () => window.cancelAnimationFrame(frame);
  }, [waiting, showing, revealed, place]);
  // The fade that follows a wait, kept on the compositor for its length so a heavy screen does not stutter as it appears.
  const isHidden = waiting || showing;
  const [isRevealing, setRevealing] = useState(false);
  const wasHidden = useRef(false);
  useEffect(() => {
    if (isHidden) { wasHidden.current = true; return; }
    if (!wasHidden.current) return;
    wasHidden.current = false; setRevealing(true);
    const timer = window.setTimeout(() => setRevealing(false), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [isHidden]);
  return { report, revealed, isHidden, isRevealing, isShowing: showing };
}
/** How long the screen's fade-in and the loader's fade-out take together, with room to spare (see the CSS). */
const REVEAL_MS = 500;
/** How long the rocket keeps moving after its loader starts to fade, so it never freezes in sight. */
const FADE_OUT_MS = 300;
export function PageLoadingProvider({ frame, children }: { frame: ReturnType<typeof usePageLoadingFrame>; children: ReactNode }) {
  return <ReportContext.Provider value={frame.report}><RevealedContext.Provider value={frame.revealed}>{children}</RevealedContext.Provider></ReportContext.Provider>;
}

/** Reports a read the screen needs before it can be drawn. */
export function usePageLoading(isPending: boolean) {
  const report = useContext(ReportContext);
  const id = useId();
  // Layout effects report before the browser paints, so a screen with a read under way never shows for a frame.
  useLayoutEffect(() => { report(id, isPending); }, [report, id, isPending]);
  useLayoutEffect(() => () => report(id, false), [report, id]);
}

/** Whether the screen is already on view: a read that starts then shows its own small placeholder in place. */
export const usePageRevealed = () => useContext(RevealedContext);

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

/** The frame's loader, laid over the content card while a screen's first reads are under way. */
export function PageLoader({ isVisible }: { isVisible: boolean }) {
  useLanguage();
  return <VStack gap={3} hAlign="center" vAlign="center" className={isVisible ? `${styles.overlay} ${styles.visible}` : styles.overlay}
    {...(isVisible ? { role: 'status', 'aria-label': t('request.loading') } : { 'aria-hidden': true })}>
    <LoadingMark isPlaying={isVisible}/>
    <Text type="supporting" color="secondary">{t('request.loadingRecords')}</Text>
  </VStack>;
}

/** The same rocket in place, for a read that starts after the screen is on view. */
export function InlineLoader({ label }: { label?: string | undefined }) {
  useLanguage();
  return <VStack gap={2} hAlign="center" vAlign="center" className={styles.inline} role="status" aria-label={label ?? t('request.loading')}>
    <LoadingMark isSmall/>
  </VStack>;
}
