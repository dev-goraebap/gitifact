import { useSyncExternalStore } from 'react';

export type Language = 'ko' | 'en';
export type LanguagePreference = Language | 'system';
export const defaultLanguage = 'en' as const;
export function resolveLanguage(value: string): Language { return /^ko(?:[-_]|$)/i.test(value) ? 'ko' : 'en'; }
const key = 'gitifact-language';
const listeners = new Set<() => void>();
function read(): LanguagePreference {
  try { const value = localStorage.getItem(key); return value === 'ko' || value === 'en' ? value : 'system'; }
  catch { return 'system'; }
}
let preference = read();
export const getLanguagePreference = () => preference;
export const getLanguage = (): Language => preference === 'system' ? resolveLanguage(navigator.language) : preference;
function notify() {
  document.documentElement.lang = getLanguage();
  listeners.forEach(listener => listener());
}
export function setLanguage(value: LanguagePreference) {
  if (!['system', 'ko', 'en'].includes(value)) return;
  preference = value;
  try { localStorage.setItem(key, value); } catch { /* Keep the selection for this tab. */ }
  notify();
}
window.addEventListener('storage', event => { if (event.key === key || event.key === null) { preference = read(); notify(); } });
window.addEventListener('languagechange', notify);
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useLanguage = () => useSyncExternalStore(subscribe, getLanguage);
export const useLanguagePreference = () => useSyncExternalStore(subscribe, getLanguagePreference);
document.documentElement.lang = getLanguage();
