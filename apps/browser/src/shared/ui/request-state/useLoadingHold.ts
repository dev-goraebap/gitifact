import { useEffect, useRef, useState } from 'react';

/**
 * Turns a raw loading flag into a loader flag that neither flashes nor blinks: the loader appears only after `delay` ms
 * of loading, and once shown it stays for at least `minimum` ms. It also stays two frames past the end of the wait: the
 * screen that ends it is laid out and painted in the frame after it arrives, and that heavy frame then falls under the
 * loader instead of on the first frame of its fade.
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
    let frame = 0;
    const settle = () => { frame = window.requestAnimationFrame(() => { frame = window.requestAnimationFrame(() => { shownAt.current = null; setShowing(false); }); }); };
    const remaining = Math.max(0, minimum - (Date.now() - (shownAt.current ?? 0)));
    const timer = window.setTimeout(settle, remaining);
    return () => { window.clearTimeout(timer); window.cancelAnimationFrame(frame); };
  }, [isLoading, showing, delay, minimum]);
  return showing;
}
