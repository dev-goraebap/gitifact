import { InitError, parseProjectConfig, type Baseline, type ProjectConfig } from './project-config.js';

export interface SpecProjectConfig { kind: 'tryce-project'; format: 'spec-1'; baseline: Baseline }
export function parseManagedConfig(text: string): ProjectConfig | SpecProjectConfig {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new InitError('INVALID_CONFIG', '설정 JSON을 읽지 못했습니다.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || (value as { format?: unknown }).format !== 'spec-1') return parseProjectConfig(text);
  const config = value as SpecProjectConfig;
  if (Object.keys(config).sort().join(',') !== 'baseline,format,kind' || config.kind !== 'tryce-project') throw new InitError('INVALID_CONFIG', 'spec-1 설정 필드를 확인하세요.');
  const checked = parseProjectConfig(JSON.stringify({ kind: config.kind, format: 'workflow-1', mode: 'auto', baseline: config.baseline }));
  return { kind: 'tryce-project', format: 'spec-1', baseline: checked.baseline };
}
