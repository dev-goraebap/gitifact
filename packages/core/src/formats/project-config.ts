import { t } from '../shared/i18n/index.js';

export type ProjectMode = 'normal' | 'prototype' | 'auto' | 'approval';
export type Baseline = { kind: 'empty' } | { kind: 'commit'; objectFormat: 'sha1' | 'sha256'; commit: string };
export interface ProjectConfig {
  kind: 'tryce-project';
  format: 'init-1' | 'prototype-1' | 'workflow-1';
  mode: ProjectMode;
  baseline: Baseline;
}
export class InitError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).sort().join(',') === expected.sort().join(',');

export function parseProjectConfig(text: string): ProjectConfig {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new InitError('INVALID_CONFIG', t('config.jsonUnreadable')); }
  if (object(value) && value.kind === 'tryce-project' && typeof value.format === 'string' && !['init-1', 'prototype-1', 'workflow-1'].includes(value.format)) {
    throw new InitError('UNSUPPORTED_FORMAT', t('config.unsupportedFormat'));
  }
  const invalid = () => new InitError('INVALID_CONFIG', t('config.invalidFields'));
  if (!object(value) || !keys(value, ['kind', 'format', 'mode', 'baseline']) || value.kind !== 'tryce-project'
    || !['init-1', 'prototype-1', 'workflow-1'].includes(String(value.format)) || typeof value.format !== 'string'
    || typeof value.mode !== 'string' || !(value.format === 'workflow-1' ? ['auto', 'approval'] : ['normal', 'prototype']).includes(value.mode) || !object(value.baseline)) throw invalid();
  const b = value.baseline;
  if (b.kind === 'empty') { if (!keys(b, ['kind'])) throw invalid(); }
  else if (b.kind === 'commit') {
    if (!keys(b, ['kind', 'objectFormat', 'commit']) || typeof b.objectFormat !== 'string' || !['sha1', 'sha256'].includes(b.objectFormat)
      || typeof b.commit !== 'string' || !(b.objectFormat === 'sha1' ? /^[a-f0-9]{40}$/ : /^[a-f0-9]{64}$/).test(b.commit)
      || /^0+$/.test(b.commit)) throw invalid();
  } else throw invalid();
  return value as unknown as ProjectConfig;
}
