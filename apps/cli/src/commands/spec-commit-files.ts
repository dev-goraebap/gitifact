import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SpecPreviewError, recordPathPattern, isProductAssetPath } from '@gitifact/core';

export const fail = (message: string): never => { throw new SpecPreviewError(message); };
export const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
export const optional = (path: string) => readFile(path).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
export const info = (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
export const record = (path: string) => recordPathPattern.test(path);
export function validPath(path: string) {
  if (typeof path !== 'string' || path.length > 1000 || /[\\:\x00-\x1f\x7f]/.test(path)
    || path.split('/').some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git')) fail('저장소 상대 경로의 명세 또는 일반 파일만 선택하세요.');
}
export async function fingerprint(root: string, path: string) {
  validPath(path); const parts = path.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const target = join(root, ...parts.slice(0, i)); const stat = await info(target);
    if (!stat) return null;
    if (stat.isSymbolicLink() || (i < parts.length ? !stat.isDirectory() : !stat.isFile())) fail('링크·디렉터리·특수 파일은 선택할 수 없습니다.');
    if (i < parts.length && await info(join(target, '.git'))) fail('중첩 저장소는 선택할 수 없습니다.');
    if (i === parts.length) {
      if (stat.nlink !== 1 || stat.size > 16 * 1024 * 1024) fail('하드 링크 또는 파일 크기 한도를 확인하세요.');
      return hash(Buffer.concat([Buffer.from(String(stat.mode & 0o111) + '\0'), await readFile(target)]));
    }
  }
  return null;
}
export function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('잘못된 커밋 입력입니다.');
  return input as Record<string, unknown>;
}
export function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || value.includes('\0')) return fail('빈 문자열 또는 입력 한도 초과입니다.');
  return value;
}
export function paths(value: unknown, limit = 128): string[] {
  if (!Array.isArray(value) || !value.length || value.length > limit || value.some(p => typeof p !== 'string')) return fail('파일 목록 개수 또는 형식이 잘못됐습니다.');
  const list = [...new Set(value as string[])].sort(); list.forEach(validPath); return list;
}
export function policyPaths(files: string[]) {
  const all = new Set(['AGENTS.md', 'CLAUDE.md', '.agents/skills/gitifact-workflow/SKILL.md', '.gitignore', '.gitattributes', '.gitifact/config.json', '.tryce/config.json']);
  for (const file of files) { const parts = file.split('/'); for (let i = 1; i < parts.length; i++) for (const name of ['AGENTS.md', 'CLAUDE.md', '.gitignore', '.gitattributes']) all.add(parts.slice(0, i).join('/') + '/' + name); }
  return [...all].sort();
}
export async function checkLegacySelection(root: string, selected: string[]) {
  // Old JSON records (in either store) may only be selected for deletion; after `gitifact migrate` the whole `.tryce` store leaves the same way.
  const legacyJson = /^\.(?:gitifact|tryce)\/(?:spec\/[^/]+\/tryce\.json|notes\/N-[a-f0-9-]+\.json|mode-[a-f0-9-]+\.json|config\.(?:init-1|prototype-1)\.[a-f0-9]+\.json)$/;
  for (const p of selected.filter(p => p.startsWith('.gitifact/') && !record(p) && p !== '.gitifact/config.json')) {
    // Images beside PRODUCT.md travel with the description; they are committed, not parsed.
    if (isProductAssetPath(p)) continue;
    if (!legacyJson.test(p) || await fingerprint(root, p) !== null) fail('.gitifact의 구형 기록은 삭제만 선택할 수 있습니다: ' + p);
  }
  for (const p of selected.filter(p => p.startsWith('.tryce/'))) {
    if (!(record(p) || p === '.tryce/config.json' || legacyJson.test(p)) || await fingerprint(root, p) !== null) fail('.tryce의 이전 기록은 전환 시 삭제만 선택할 수 있습니다: ' + p);
  }
}
