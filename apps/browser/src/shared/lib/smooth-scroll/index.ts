import { useEffect, type RefObject } from 'react';
import Lenis from 'lenis';

/**
 * Wheel scrolling that glides instead of stepping, on one scrolling element (the content card). The browser only
 * smooths scrolls it starts itself (`scroll-behavior` covers anchors and scrollTo, not the wheel), so the wheel goes
 * through Lenis. It stays off for readers who ask for less motion, and areas that scroll on their own inside the card
 * (the requirement index, wide tables) keep their native scroll.
 */
export function useSmoothWheel(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const wrapper = ref.current;
    if (!wrapper || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ wrapper, content: wrapper, autoRaf: true, allowNestedScroll: true, lerp: 0.12 });
    // Lenis measures how far it may scroll when its elements resize, but the card keeps its size while a page loads
    // into it or another replaces it. Without this it kept the empty card's length and the wheel moved nothing.
    const measure = new ResizeObserver(() => lenis.resize());
    const watch = () => { measure.disconnect(); for (const child of wrapper.children) measure.observe(child); };
    const pages = new MutationObserver(watch);
    pages.observe(wrapper, { childList: true });
    watch();
    // A click right after a wheel scroll lands while the glide still runs. The router starts the next page at the top,
    // but the glide went on toward the old page's target and pulled the new page back down, so a press stops it first.
    const halt = () => { if (lenis.isScrolling) lenis.scrollTo(wrapper.scrollTop, { immediate: true, force: true }); };
    window.addEventListener('pointerdown', halt, true);
    window.addEventListener('keydown', halt, true);
    return () => { window.removeEventListener('pointerdown', halt, true); window.removeEventListener('keydown', halt, true);
      pages.disconnect(); measure.disconnect(); lenis.destroy(); };
  }, [ref]);
}
