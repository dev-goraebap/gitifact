import { defineTheme } from '@astryxdesign/core/theme';
import { stoneTheme as stoneSource } from '@astryxdesign/theme-stone';
import { stoneTheme } from '@astryxdesign/theme-stone/built';
import { paletteColors, paletteTokens, type Palette } from '../../shared/lib/appearance';

// Stone is the prebuilt default, so the first paint needs no style injection. The other palettes extend its source
// (type, radius, icons, component overrides carry over) and set their color tokens explicitly; they inject at runtime.
const derived = (name: Exclude<Palette, 'stone'>) => defineTheme({ name: 'gitifact-' + name, extends: stoneSource, tokens: paletteTokens(paletteColors[name]) });
export const themes = { stone: stoneTheme, sage: derived('sage'), olive: derived('olive'), slate: derived('slate'), clay: derived('clay') } satisfies Record<Palette, unknown>;
