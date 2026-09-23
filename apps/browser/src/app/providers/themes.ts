import { defineTheme } from '@astryxdesign/core/theme';
import { stoneTheme as stoneSource } from '@astryxdesign/theme-stone';
import { paletteColors, paletteTokens, softText, type Palette } from '../../shared/lib/appearance';

// Every palette extends the Stone source (type, radius, icons, component overrides carry over) and sets its colour
// tokens explicitly. Stone itself only softens its light-mode text, which means it is defined here too rather than
// taken prebuilt: its tokens are injected at runtime like the others.
// Stone names Figtree and JetBrains Mono without loading them, so Windows drew text in Segoe UI with Malgun Gothic
// for Hangul, and code in Consolas with GulimChe. Both bundled faces (global.css) now carry the text: Pretendard for
// prose in either script, JetBrains Mono for code with its missing Hangul falling through to Pretendard.
const sans = { family: 'Pretendard Variable', fallbacks: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif' };
const typography = { body: sans, heading: sans, code: { family: 'JetBrains Mono Variable', fallbacks: '"Pretendard Variable", Consolas, monospace' } };
const derived = (name: Exclude<Palette, 'stone'>) => defineTheme({ name: 'gitifact-' + name, extends: stoneSource, typography, tokens: paletteTokens(paletteColors[name]) });
const stone = defineTheme({ name: 'gitifact-stone', extends: stoneSource, typography, tokens: softText });
export const themes = { stone, sage: derived('sage'), olive: derived('olive'), slate: derived('slate'), clay: derived('clay') } satisfies Record<Palette, unknown>;
