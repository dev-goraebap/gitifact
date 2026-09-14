import { InitError, parseProjectConfig, type Baseline, type ProjectConfig } from './project-config.js';

export interface SpecProjectConfig { schemaVersion: 1; baseline: Baseline }
export function parseManagedConfig(text: string): ProjectConfig | SpecProjectConfig {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new InitError('INVALID_CONFIG', '설정 JSON을 읽지 못했습니다.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('schemaVersion' in value)) return parseProjectConfig(text);
  const config = value as SpecProjectConfig;
  if (Object.keys(config).sort().join(',') !== 'baseline,schemaVersion' || config.schemaVersion !== 1) throw new InitError('INVALID_CONFIG', 'schemaVersion과 baseline 설정 필드를 확인하세요.');
  const checked = parseProjectConfig(JSON.stringify({ kind: 'tryce-project', format: 'workflow-1', mode: 'auto', baseline: config.baseline }));
  return { schemaVersion: 1, baseline: checked.baseline };
}
