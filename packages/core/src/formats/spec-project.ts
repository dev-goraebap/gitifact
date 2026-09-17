import { InitError, parseProjectConfig, type Baseline, type ProjectConfig } from './project-config.js';
import { t } from '../shared/i18n/index.js';

export interface SpecProjectConfig { schemaVersion: 1; baseline: Baseline }
export function parseManagedConfig(text: string): ProjectConfig | SpecProjectConfig {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new InitError('INVALID_CONFIG', t('config.jsonUnreadableShort')); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('schemaVersion' in value)) return parseProjectConfig(text);
  const config = value as SpecProjectConfig;
  if (Object.keys(config).sort().join(',') !== 'baseline,schemaVersion' || config.schemaVersion !== 1) throw new InitError('INVALID_CONFIG', t('config.schemaFields'));
  const checked = parseProjectConfig(JSON.stringify({ kind: 'tryce-project', format: 'workflow-1', mode: 'auto', baseline: config.baseline }));
  return { schemaVersion: 1, baseline: checked.baseline };
}
