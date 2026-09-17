import { t, type MessageKey } from '../shared/i18n/index.js';
import { InitError } from './project-config.js';

export const changelogSections = ['added', 'changed', 'removed', 'fixed'] as const;
export type ChangelogSection = typeof changelogSections[number];
export type ChangelogEntry = { version: string; date: string } & Record<ChangelogSection, string[]>;

// Keep a Changelog with the section titles fixed to English tokens, so every language parses the same way.
const versionLine = /^## (\d+)\.(\d+)\.(\d+) - (\d{4})-(\d{2})-(\d{2})$/;
const sectionLine = /^### (Added|Changed|Removed|Fixed)$/;
const itemLine = /^- (\S.*)$/;
const realDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

// The file is the release notes source, so anything outside the fixed shape is refused instead of skipped:
// a silently dropped line would ship notes that differ from what was written.
export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let previous: [number, number, number] | undefined;
  let entry: ChangelogEntry | undefined;
  let section: ChangelogSection | undefined;
  const fail = (line: number, key: MessageKey, values: Record<string, unknown> = {}) =>
    new InitError('INVALID_CHANGELOG', t('changelog.atLine', { line, reason: t(key, values) }));
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const close = (line: number) => {
    if (entry && changelogSections.every(name => entry![name].length === 0)) throw fail(line, 'changelog.emptyVersion', { version: entry.version });
  };
  lines.forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === '') return;
    const version = versionLine.exec(raw);
    if (version) {
      close(line);
      const core: [number, number, number] = [Number(version[1]), Number(version[2]), Number(version[3])];
      if (!realDate(Number(version[4]), Number(version[5]), Number(version[6]))) throw fail(line, 'changelog.invalidDate', { text: raw });
      if (previous && !(core[0] < previous[0] || (core[0] === previous[0] && (core[1] < previous[1] || (core[1] === previous[1] && core[2] < previous[2]))))) {
        throw fail(line, 'changelog.order', { version: core.join('.') });
      }
      previous = core; section = undefined;
      entry = { version: core.join('.'), date: version[4] + '-' + version[5] + '-' + version[6], added: [], changed: [], removed: [], fixed: [] };
      entries.push(entry);
      return;
    }
    const heading = sectionLine.exec(raw);
    if (heading) {
      if (!entry) throw fail(line, 'changelog.sectionBeforeVersion');
      const name = heading[1]!.toLowerCase() as ChangelogSection;
      if (entry[name].length > 0) throw fail(line, 'changelog.duplicateSection', { section: heading[1] });
      section = name;
      return;
    }
    const item = itemLine.exec(raw);
    if (item) {
      if (!entry || !section) throw fail(line, 'changelog.itemOutsideSection');
      entry[section].push(item[1]!.trimEnd());
      return;
    }
    throw fail(line, 'changelog.unknownLine', { text: raw });
  });
  close(lines.length);
  if (entries.length === 0) throw fail(1, 'changelog.noVersions');
  return entries;
}
