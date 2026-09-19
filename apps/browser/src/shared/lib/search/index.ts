import { useSyncExternalStore } from 'react';

/**
 * How long a search field waits after the last keystroke before it searches. Filtering happens locally and is fast,
 * but running it on every keystroke made the list and the palette flicker through intermediate matches while a word
 * was still being typed — and in Korean, through the partial syllables an input method produces.
 */
export const typingDelay = 500;

// The palette is opened from the header on every page and from a hotkey anywhere, so its one piece of state lives
// here rather than in either widget. Nothing about it is worth keeping between sessions.
let open = false;
const listeners = new Set<() => void>();
const emit = () => { listeners.forEach(listener => listener()); };
export function openSearch() { if (!open) { open = true; emit(); } }
export function closeSearch() { if (open) { open = false; emit(); } }
export function setSearchOpen(next: boolean) { if (next !== open) { open = next; emit(); } }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useSearchOpen = () => useSyncExternalStore(subscribe, () => open);
