import { InitError, parseProjectConfig, type Baseline, type ProjectConfig } from './project-config.js';
import { t } from '../shared/i18n/index.js';

export const SCHEMA_VERSION = 2 as const;
export interface SpecProjectConfig { schemaVersion: typeof SCHEMA_VERSION; baseline: Baseline }
export function parseManagedConfig(text: string): ProjectConfig | SpecProjectConfig {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new InitError('INVALID_CONFIG', t('config.jsonUnreadableShort')); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('schemaVersion' in value)) return parseProjectConfig(text);
  const config = value as SpecProjectConfig;
  if (Object.keys(config).sort().join(',') !== 'baseline,schemaVersion') throw new InitError('INVALID_CONFIG', t('config.schemaFields'));
  // Earlier pre-release conventions are not converted; the message names the version so the reader knows why.
  // A newer convention means this CLI is the old one, and the way out is to update it.
  if (config.schemaVersion !== SCHEMA_VERSION) {
    const found: unknown = config.schemaVersion;
    const newer = typeof found === 'number' && found > SCHEMA_VERSION;
    throw new InitError('UNSUPPORTED_SCHEMA', newer ? t('config.newerSchema', { version: String(found) }) : t('config.unsupportedSchema', { version: String(found) }));
  }
  const checked = parseProjectConfig(JSON.stringify({ kind: 'tryce-project', format: 'workflow-1', mode: 'auto', baseline: config.baseline }));
  return { schemaVersion: SCHEMA_VERSION, baseline: checked.baseline };
}
