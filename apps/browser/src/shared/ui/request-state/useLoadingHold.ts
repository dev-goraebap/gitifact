import { useEffect, useRef, useState } from 'react';

/** The longest a loader waits for the page to settle once its wait is over, so a busy page never keeps it for good. */
const SETTLE_CAP_MS = 1000;
/** How long a loader stays once the next screen is drawn, so the change settles before the veil starts to lift. */
const LINGER_MS = 200;

/**
 * Calls `done` once the screen that ended a wait is drawn: after a frame, at an idle moment with no long task since the
 * last look. Drawing a new screen runs as one or two long tasks of 80–150ms (a record's page runs two with a short gap
 * between), and a loader lifted in between froze halfway. Gives up waiting after `SETTLE_CAP_MS`. Returns a cancel.
 */
function whenDrawn(done: () => void): () => void {
  const start = performance.now();
  let busy = false; let cancelled = false;
  let frame = 0; let idle = 0; let timer = 0;
  const watch = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')
    ? new PerformanceObserver(() => { busy = true; }) : undefined;
  watch?.observe({ type: 'longtask' });
  const finish = () => { watch?.disconnect(); if (!cancelled) done(); };
  const quiet = (then: () => void) => typeof requestIdleCallback === 'function'
    ? (idle = requestIdleCallback(then, { timeout: 200 })) : (timer = window.setTimeout(then, 50));
  const look = () => {
    frame = requestAnimationFrame(() => quiet(() => {
      if (cancelled) return;
      if (busy && performance.now() - start < SETTLE_CAP_MS) { busy = false; look(); return; }
      finish();
    }));
  };
  look();
  return () => {
    cancelled = true; watch?.disconnect(); cancelAnimationFrame(frame); window.clearTimeout(timer);
    if (idle && typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
  };
}

/**
 * Turns a raw loading flag into a loader flag that neither flashes nor blinks: the loader appears only after `delay` ms
 * of loading, and once shown it stays for at least `minimum` ms. It also stays until the screen that ends the wait is
 * drawn, and `LINGER_MS` past that, so the heavy frames of laying it out fall under the loader instead of on its fade.
 */
export function useLoadingHold(isLoading: boolean, { delay = 200, minimum = 300 } = {}) {
  const [showing, setShowing] = useState(false);
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    if (isLoading) {
      if (showing) return;
      const timer = window.setTimeout(() => { shownAt.current = Date.now(); setShowing(true); }, delay);
      return () => window.clearTimeout(timer);
    }
    if (!showing) return;
    let cancel = () => {};
    const remaining = Math.max(0, minimum - (Date.now() - (shownAt.current ?? 0)));
    const timer = window.setTimeout(() => { cancel = whenDrawn(() => { const linger = window.setTimeout(() => { shownAt.current = null; setShowing(false); }, LINGER_MS); cancel = () => window.clearTimeout(linger); }); }, remaining);
    return () => { window.clearTimeout(timer); cancel(); };
  }, [isLoading, showing, delay, minimum]);
  return showing;
}
