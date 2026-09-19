import { useSyncExternalStore } from 'react';

// Appearance is a per-browser preference, so it lives in localStorage and never reaches the project or the server.
export const modes = ['system', 'light', 'dark'] as const;
export type Mode = typeof modes[number];
// Every palette has a light and a dark side; the mode picks which one shows.
export const palettes = ['stone', 'sage', 'olive', 'slate', 'clay'] as const;
export type Palette = typeof palettes[number];
export interface Appearance { mode: Mode; palette: Palette }

type Pair = readonly [light: string, dark: string];
// A palette is tuned by hand, token by token, the way Gentask does it: seeding everything from one accent lets the
// hue leak into body text, links and menu labels. Text stays close to neutral; only surfaces carry a faint tint,
// and the saturated accent is kept for controls, selection and progress.
export interface PaletteColors { body: Pair; surface: Pair; card: Pair; muted: Pair; accent: Pair; tint: Pair; text: Pair; secondary: Pair; border: Pair; inputBorder: Pair; onAccent?: Pair }
export const paletteColors: Record<Exclude<Palette, 'stone'>, PaletteColors> = {
  sage: { body: ['#e9ece5', '#1b1d1b'], surface: ['#fafaf4', '#232623'], card: ['#fffffb', '#292c29'], muted: ['#edf0e6', '#2d312d'],
    accent: ['#4e6748', '#b5c99c'], tint: ['#e3ead9', '#303a2d'], text: ['#3b4439', '#e8ebe5'], secondary: ['#606c5b', '#adb3a9'], border: ['#d8dfd0', '#393f38'], inputBorder: ['#c8d0c0', '#4b5248'] },
  // Halo · Olive from hoho-hr: warm neutrals under a deep olive green. Converted from its OKLCH tokens; the dark borders are white at 10% and 20%.
  olive: { body: ['#f5f5f1', '#10110d'], surface: ['#fdfdfc', '#191a15'], card: ['#ffffff', '#22241d'], muted: ['#edede7', '#292b23'],
    accent: ['#5e6b18', '#92a245'], tint: ['#ecf3d5', '#2c3112'], text: ['#36372e', '#f2f2ee'], secondary: ['#5b5c4f', '#abac9e'], border: ['#e3e3dd', '#ffffff1a'], inputBorder: ['#cecfc6', '#ffffff33'], onAccent: ['#fafeef', '#101304'] },
  slate: { body: ['#e9edf3', '#171c25'], surface: ['#f9fbff', '#212936'], card: ['#ffffff', '#2a3443'], muted: ['#eaf0f9', '#2d394c'],
    accent: ['#385ca8', '#a9c5ff'], tint: ['#e1eaff', '#304365'], text: ['#36415a', '#edf2fa'], secondary: ['#5c6a80', '#acbad0'], border: ['#d4deed', '#3b4960'], inputBorder: ['#c4cfdf', '#4b5a70'] },
  clay: { body: ['#efe8e1', '#211b19'], surface: ['#fcf9f5', '#2d2420'], card: ['#fffdfa', '#382d27'], muted: ['#f1e8df', '#40322b'],
    accent: ['#965239', '#e6b099'], tint: ['#f3e2d8', '#50382d'], text: ['#473b34', '#f4ebe3'], secondary: ['#79695e', '#c5b2a4'], border: ['#e3d6ca', '#534139'], inputBorder: ['#d5c6b8', '#655248'] },
};
// Light-mode body text is softened from near-black in every palette: at full contrast the text, the menu and the
// wordmark (which draws in the text colour) read heavier than the surfaces around them. Dark mode keeps its values.
export const softText = { '--color-text-primary': ['#3a3a40', '#f3f3f5'], '--color-icon-primary': ['#3a3a40', '#f3f3f5'] } satisfies Record<string, [string, string]>;
// Stone keeps its shipped colours except that softer text; these four values only draw its card on the settings page.
export const stonePreview: Pick<PaletteColors, 'body' | 'surface' | 'accent' | 'text'> = { body: ['#f3f3f5', '#111015'], surface: ['#ffffff', '#1b1b1f'], accent: ['#25252a', '#f3f3f5'], text: ['#3a3a40', '#f3f3f5'] };
export function paletteTokens(colors: PaletteColors): Record<string, [string, string]> {
  const pair = (value: Pair): [string, string] => [value[0], value[1]];
  return {
    '--color-background-body': pair(colors.body), '--color-background-surface': pair(colors.surface),
    '--color-background-card': pair(colors.card), '--color-background-popover': pair(colors.card), '--color-background-muted': pair(colors.muted),
    '--color-accent': pair(colors.accent), '--color-accent-muted': pair(colors.tint), '--color-on-accent': colors.onAccent ? pair(colors.onAccent) : ['#ffffff', colors.body[1]],
    // Stone uses the accent tokens as the color of links and menu labels, so these two follow the text, not the hue.
    '--color-text-accent': pair(colors.text), '--color-icon-accent': pair(colors.text),
    '--color-text-primary': pair(colors.text), '--color-icon-primary': pair(colors.text),
    '--color-text-secondary': pair(colors.secondary), '--color-icon-secondary': pair(colors.secondary),
    '--color-border': pair(colors.border), '--color-border-emphasized': pair(colors.inputBorder),
  };
}

const key = 'gitifact-appearance';
const fallback: Appearance = { mode: 'system', palette: 'stone' };
const listeners = new Set<() => void>();
function read(): Appearance {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? 'null') as Partial<Appearance> | null;
    return { mode: modes.includes(value?.mode as Mode) ? value!.mode as Mode : fallback.mode,
      palette: palettes.includes(value?.palette as Palette) ? value!.palette as Palette : fallback.palette };
  } catch { return fallback; }
}
let current = read();
export function setAppearance(next: Partial<Appearance>) {
  current = { ...current, ...next };
  // Storage can be unavailable (private mode, blocked); the choice then lasts for this page only.
  try { window.localStorage.setItem(key, JSON.stringify(current)); } catch { /* keep the in-memory choice */ }
  listeners.forEach(listener => listener());
}
// Another tab changing the preference updates this one too.
window.addEventListener('storage', event => { if (event.key === key) { current = read(); listeners.forEach(listener => listener()); } });
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useAppearance = () => useSyncExternalStore(subscribe, () => current);
