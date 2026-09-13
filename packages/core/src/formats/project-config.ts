export type ProjectMode = 'normal' | 'prototype';
export type Baseline = { kind: 'empty' } | { kind: 'commit'; objectFormat: 'sha1' | 'sha256'; commit: string };
export interface ProjectConfig {
  kind: 'tryce-project';
  format: 'init-1' | 'prototype-1';
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
  try { value = JSON.parse(text); } catch { throw new InitError('INVALID_CONFIG', '설정 JSON을 읽지 못했습니다. 원문을 보존하세요.'); }
  if (object(value) && value.kind === 'tryce-project' && typeof value.format === 'string' && !['init-1', 'prototype-1'].includes(value.format)) {
    throw new InitError('UNSUPPORTED_FORMAT', '지원하지 않는 프로젝트 형식입니다. 호환 CLI가 필요합니다.');
  }
  const invalid = () => new InitError('INVALID_CONFIG', '프로젝트 설정의 필드나 값이 올바르지 않습니다.');
  if (!object(value) || !keys(value, ['kind', 'format', 'mode', 'baseline']) || value.kind !== 'tryce-project'
    || !['init-1', 'prototype-1'].includes(String(value.format)) || typeof value.format !== 'string'
    || typeof value.mode !== 'string' || !['normal', 'prototype'].includes(value.mode) || !object(value.baseline)) throw invalid();
  const b = value.baseline;
  if (b.kind === 'empty') { if (!keys(b, ['kind'])) throw invalid(); }
  else if (b.kind === 'commit') {
    if (!keys(b, ['kind', 'objectFormat', 'commit']) || typeof b.objectFormat !== 'string' || !['sha1', 'sha256'].includes(b.objectFormat)
      || typeof b.commit !== 'string' || !(b.objectFormat === 'sha1' ? /^[a-f0-9]{40}$/ : /^[a-f0-9]{64}$/).test(b.commit)
      || /^0+$/.test(b.commit)) throw invalid();
  } else throw invalid();
  return value as unknown as ProjectConfig;
}

export function initialConfig(mode: ProjectMode | undefined, commit: string | null, objectFormat: 'sha1' | 'sha256'): ProjectConfig {
  if (!mode || !['normal', 'prototype'].includes(mode)) throw new InitError('MODE_REQUIRED', '최초 초기화에는 --mode normal 또는 --mode prototype을 지정하세요.');
  return parseProjectConfig(JSON.stringify({ kind: 'tryce-project', format: 'init-1', mode,
    baseline: commit ? { kind: 'commit', objectFormat, commit } : { kind: 'empty' } }));
}
