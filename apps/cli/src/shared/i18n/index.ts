import { AsyncLocalStorage } from 'node:async_hooks';
import { configureCoreLanguage } from '@gitifact/core';
import ko from './ko/messages.json' with { type: 'json' };
import en from './en/messages.json' with { type: 'json' };

export const defaultLanguage = 'en' as const;
export type Language = 'ko' | 'en';
export type MessageKey = keyof typeof ko;
const catalogs: Record<Language, Record<MessageKey, string>> = { ko, en };
const requestLanguage = new AsyncLocalStorage<Language>();
let current: Language = environmentLanguage();
let explicit: Language | undefined;
export function resolveLanguage(value: string | undefined): Language {
  return /^ko(?:[-_.@]|$)/i.test(value ?? '') ? 'ko' : 'en';
}
export function environmentLanguage(env: NodeJS.ProcessEnv = process.env): Language {
  return resolveLanguage(env.GITIFACT_LANG || env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale);
}
export function configureLanguage(language: Language, selected?: Language) { current = language; explicit = selected; }
export const getLanguage = (): Language => requestLanguage.getStore() ?? current;
export const explicitLanguage = () => explicit;
export function withLanguage<T>(language: Language, action: () => T): T { return requestLanguage.run(language, action); }
configureCoreLanguage(getLanguage);
export function t(key: MessageKey, values: Record<string, unknown> = {}, lang: Language = getLanguage()): string {
  return catalogs[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
