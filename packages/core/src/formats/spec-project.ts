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
export interface SpecProjectConfig { schemaVersion: typeof SCHEMA_VERSION; baseline: Baseline }

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

export function parseManagedConfig(text: string): SpecProjectConfig {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new InitError('INVALID_CONFIG', t('config.jsonUnreadableShort')); }
  // Configurations from before schemaVersion (Tryce's `kind: tryce-project`) are not read.
  if (!object(value) || !('schemaVersion' in value)) throw new InitError('UNSUPPORTED_FORMAT', t('config.unsupportedFormat'));
  if (!keys(value, ['baseline', 'schemaVersion'])) throw new InitError('INVALID_CONFIG', t('config.schemaFields'));
  // Earlier conventions are not converted; the message names the version so the reader knows why.
  // A newer convention means this CLI is the old one, and the way out is to update it.
  if (value.schemaVersion !== SCHEMA_VERSION) {
    const found: unknown = value.schemaVersion;
    const newer = typeof found === 'number' && found > SCHEMA_VERSION;
    if (found === PREVIOUS_SCHEMA_VERSION) throw new InitError('UNSUPPORTED_SCHEMA', t('config.migrationRequired'));
    throw new InitError('UNSUPPORTED_SCHEMA', newer ? t('config.newerSchema', { version: String(found) }) : t('config.unsupportedSchema', { version: String(found) }));
  }
  return { schemaVersion: SCHEMA_VERSION, baseline: parseBaseline(value.baseline) };
}
