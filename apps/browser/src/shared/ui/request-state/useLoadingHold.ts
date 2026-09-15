import { useEffect, useRef, useState } from 'react';

/**
 * Turns a raw loading flag into a skeleton flag that neither flashes nor blinks:
 * the skeleton appears only after `delay` ms of loading, and once shown it stays for at least `minimum` ms.
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
    const remaining = Math.max(0, minimum - (Date.now() - (shownAt.current ?? 0)));
    const timer = window.setTimeout(() => { shownAt.current = null; setShowing(false); }, remaining);
    return () => window.clearTimeout(timer);
  }, [isLoading, showing, delay, minimum]);
  return showing;
}
