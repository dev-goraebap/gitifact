import { defineTheme } from '@astryxdesign/core/theme';
import { stoneTheme as stoneSource } from '@astryxdesign/theme-stone';
import { paletteColors, paletteTokens, softText, type Palette } from '../../shared/lib/appearance';

// Every palette extends the Stone source (type, radius, icons, component overrides carry over) and sets its colour
// tokens explicitly. Stone itself only softens its light-mode text, which means it is defined here too rather than
// taken prebuilt: its tokens are injected at runtime like the others.
const derived = (name: Exclude<Palette, 'stone'>) => defineTheme({ name: 'gitifact-' + name, extends: stoneSource, tokens: paletteTokens(paletteColors[name]) });
const stone = defineTheme({ name: 'gitifact-stone', extends: stoneSource, tokens: softText });
export const themes = { stone, sage: derived('sage'), olive: derived('olive'), slate: derived('slate'), clay: derived('clay') } satisfies Record<Palette, unknown>;
