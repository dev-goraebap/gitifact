import { t } from '../shared/i18n/index.js';

export type Baseline = { kind: 'empty' } | { kind: 'commit'; objectFormat: 'sha1' | 'sha256'; commit: string };
export class InitError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
// 3 is the 0.8.0 document format: one file per document with frontmatter. The number only announces the format; the
// CLI never converts between them, and a project on 2 moves by following `guide show migrate`.
export const SCHEMA_VERSION = 3 as const;
/** The 0.7 convention, the one format a migration starts from. */
const PREVIOUS_SCHEMA_VERSION = 2;
/** The languages the agent block is written in. */
export const PROJECT_LANGUAGES = ['ko', 'en'] as const;
export type ProjectLanguage = typeof PROJECT_LANGUAGES[number];
// `cli` is the release the project was last set to and `language` the language of its agent block; `init` and `update`
// write both. Neither is required, so a project made before 0.8.3 still reads.
export interface SpecProjectConfig { schemaVersion: typeof SCHEMA_VERSION; baseline: Baseline; cli?: string; language?: ProjectLanguage }
/** A plain release number, the only form `cli` takes. */
export const CLI_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).sort().join(',') === expected.sort().join(',');

function parseBaseline(value: unknown): Baseline {
  const invalid = () => new InitError('INVALID_CONFIG', t('config.invalidFields'));
  if (!object(value)) throw invalid();
  if (value.kind === 'empty') { if (!keys(value, ['kind'])) throw invalid(); }
  else if (value.kind === 'commit') {
    if (!keys(value, ['kind', 'objectFormat', 'commit']) || typeof value.objectFormat !== 'string' || !['sha1', 'sha256'].includes(value.objectFormat)
      || typeof value.commit !== 'string' || !(value.objectFormat === 'sha1' ? /^[a-f0-9]{40}$/ : /^[a-f0-9]{64}$/).test(value.commit)
      || /^0+$/.test(value.commit)) throw invalid();
  } else throw invalid();
  return value as unknown as Baseline;
}

/** True when the config is the 0.7 storage convention, which the documents must be migrated from. Unreadable text is false. */
export function needsMigration(text: string): boolean {
  try { return (JSON.parse(text) as { schemaVersion?: unknown })?.schemaVersion === PREVIOUS_SCHEMA_VERSION; } catch { return false; }
}

export function parseManagedConfig(text: string): SpecProjectConfig {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new InitError('INVALID_CONFIG', t('config.jsonUnreadableShort')); }
  // Configurations from before schemaVersion (Tryce's `kind: tryce-project`) are not read.
  if (!object(value) || !('schemaVersion' in value)) throw new InitError('UNSUPPORTED_FORMAT', t('config.unsupportedFormat'));
  // Fields this CLI does not know are allowed, so a later release can add one without stopping this one.
  if (!('baseline' in value)) throw new InitError('INVALID_CONFIG', t('config.schemaFields'));
  // Earlier conventions are not converted; the message names the version so the reader knows why.
  // A newer convention means this CLI is the old one, and the way out is to update it.
  if (value.schemaVersion !== SCHEMA_VERSION) {
    const found: unknown = value.schemaVersion;
    const newer = typeof found === 'number' && found > SCHEMA_VERSION;
    if (found === PREVIOUS_SCHEMA_VERSION) throw new InitError('UNSUPPORTED_SCHEMA', t('config.migrationRequired'));
    throw new InitError('UNSUPPORTED_SCHEMA', newer ? t('config.newerSchema', { version: String(found) }) : t('config.unsupportedSchema', { version: String(found) }));
  }
  const config: SpecProjectConfig = { schemaVersion: SCHEMA_VERSION, baseline: parseBaseline(value.baseline) };
  if ('cli' in value) {
    if (typeof value.cli !== 'string' || !CLI_VERSION_PATTERN.test(value.cli)) throw new InitError('INVALID_CONFIG', t('config.cliVersion'));
    config.cli = value.cli;
  }
  if ('language' in value) {
    if (!PROJECT_LANGUAGES.includes(value.language as ProjectLanguage)) throw new InitError('INVALID_CONFIG', t('config.language', { languages: PROJECT_LANGUAGES.join(', ') }));
    config.language = value.language as ProjectLanguage;
  }
  return config;
}

/** The config text: the known fields in a fixed order, then the fields the file had that this CLI does not know. */
export function formatManagedConfig(config: SpecProjectConfig, previous?: string): string {
  let unknown: Record<string, unknown> = {};
  if (previous !== undefined) {
    const value: unknown = JSON.parse(previous);
    if (object(value)) { const { schemaVersion: _s, baseline: _b, cli: _c, language: _l, ...rest } = value; unknown = rest; }
  }
  const known = { schemaVersion: config.schemaVersion, baseline: config.baseline,
    ...(config.cli === undefined ? {} : { cli: config.cli }), ...(config.language === undefined ? {} : { language: config.language }) };
  return JSON.stringify({ ...known, ...unknown }, null, 2) + '\n';
}
