import { defineSyntaxTheme } from '@astryxdesign/core/theme/syntax';

// Stone ships syntax colors that are all near-gray, so highlighted code reads as plain text. These pairs are the
// GitHub light and dark values (the presets Astryx bundles), joined so one theme follows the color mode.
// Plain identifiers, punctuation, comments and the block background stay on theme tokens, so every palette fits.
export const documentSyntax = defineSyntaxTheme({
  name: 'gitifact-document',
  tokens: {
    keyword: ['#cf222e', '#ff7b72'], string: ['#0a3069', '#a5d6ff'], number: ['#0550ae', '#79c0ff'], function: ['#8250df', '#d2a8ff'],
    type: ['#953800', '#ffa657'], operator: ['#cf222e', '#ff7b72'], constant: ['#0550ae', '#79c0ff'], tag: ['#116329', '#7ee787'],
    attribute: ['#0550ae', '#79c0ff'], property: ['#0550ae', '#79c0ff'],
    variable: 'var(--color-text-primary)', punctuation: 'var(--color-text-secondary)', comment: 'var(--color-text-secondary)',
    background: 'var(--color-background-muted)',
  },
});
