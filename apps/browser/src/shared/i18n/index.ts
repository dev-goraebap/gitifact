import { createElement, Fragment, type ReactNode } from 'react';
import ko from './ko/messages.json' with { type: 'json' };
import introKo from '@gitifact/intro/ko/intro.md?raw';

// One language is one folder. Screen copy lives in <lang>/messages.json. The product intro is shared with the
// README and the landing site, so its source is packages/intro.
// Astryx component strings come from its own InternationalizationProvider catalog, not from here.
export const defaultLanguage = 'ko' as const;
export type Language = typeof defaultLanguage;
export type MessageKey = keyof typeof ko;
// A new language is declared as Record<MessageKey, string> so a missing key is a compile error.
const catalogs: Record<Language, Record<MessageKey, string>> = { ko };
const documents: Record<Language, { about: string }> = { ko: { about: introKo } };

const placeholder = /\{(\w+)\}/g;

// Fills {name} placeholders with text. A placeholder without a value is left as written so it stays visible.
export function t(key: MessageKey, values: Record<string, unknown> = {}, lang: Language = defaultLanguage): string {
  return catalogs[lang][key].replace(placeholder, (whole, name: string) => (name in values ? String(values[name]) : whole));
}

// Places elements such as <time> or <Link> inside a sentence, so word order can differ per language.
export function tNodes(key: MessageKey, values: Record<string, ReactNode>, lang: Language = defaultLanguage): ReactNode[] {
  return catalogs[lang][key].split(placeholder).map((part, index) =>
    index % 2 === 0 ? part : createElement(Fragment, { key: index }, part in values ? values[part] : '{' + part + '}'));
}

export function localDocument(name: 'about', lang: Language = defaultLanguage): string {
  return documents[lang][name];
}
