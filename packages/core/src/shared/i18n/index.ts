import ko from './ko/messages.json' with { type: 'json' };

// One language is one folder. Validation messages live in <lang>/messages.json; tsc copies it to dist.
export const defaultLanguage = 'ko' as const;
export type Language = typeof defaultLanguage;
export type MessageKey = keyof typeof ko;
// A new language is declared as Record<MessageKey, string> so a missing key is a compile error.
const catalogs: Record<Language, Record<MessageKey, string>> = { ko };

// Fills {name} placeholders. Values are converted like string concatenation, and a placeholder without a
// value is left as written so a missing argument is visible instead of silently empty.
export function t(key: MessageKey, values: Record<string, unknown> = {}, lang: Language = defaultLanguage): string {
  return catalogs[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
