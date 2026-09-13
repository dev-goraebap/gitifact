import { RepositoryReadError } from '@tryce/core';
import type { ObjectFormat, RepositoryChange, RepositoryHead, SubmoduleChanges } from '@tryce/core';

const invalid = (): never => { throw new RepositoryReadError('INVALID_GIT_OUTPUT'); };
export function decodeGit(buffer: Buffer): string {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer); }
  catch { throw new RepositoryReadError('UNSUPPORTED_PATH_ENCODING'); }
}
export function decodeGitLine(buffer: Buffer): string {
  const text = decodeGit(buffer);
  if (!text.endsWith('\n')) return invalid();
  const value = text.slice(0, -1);
  if (!value || value.includes('\0')) return invalid();
  return value;
}
function fieldsAndPath(record: string, count: number): [string[], string] {
  const fields: string[] = [];
  let start = 0;
  for (let index = 0; index < count; index++) {
    const end = record.indexOf(' ', start);
    if (end <= start) return invalid();
    fields.push(record.slice(start, end));
    start = end + 1;
  }
  return [fields, record.slice(start)];
}
function validPath(path: string, directory: boolean): boolean {
  if (!path || path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false;
  const parts = (directory && path.endsWith('/') ? path.slice(0, -1) : path).split('/');
  return parts.every((part) => part !== '' && part !== '.' && part !== '..');
}
function submodule(value: string): SubmoduleChanges | null {
  if (value === 'N...') return null;
  if (!/^S[.C][.M][.U]$/.test(value)) return invalid();
  return { commitChanged: value[1] === 'C', trackedChanges: value[2] === 'M', untrackedChanges: value[3] === 'U' };
}
export interface ParsedStatus {
  head: RepositoryHead;
  changes: RepositoryChange[];
  comparison: string;
}
export function parsePorcelain(buffer: Buffer, format: ObjectFormat): ParsedStatus {
  if (!buffer.length || buffer.at(-1) !== 0) return invalid();
  const records = decodeGit(buffer).slice(0, -1).split('\0');
  const oidPattern = new RegExp('^[0-9a-f]{' + (format === 'sha1' ? 40 : 64) + '}$');
  let branch: string | undefined;
  let commit: string | undefined;
  const entries: { change: RepositoryChange; raw: string }[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    if (record.startsWith('# ')) {
      if (record.startsWith('# branch.oid ')) {
        if (commit !== undefined) return invalid();
        commit = record.slice(13);
      } else if (record.startsWith('# branch.head ')) {
        if (branch !== undefined) return invalid();
        branch = record.slice(14);
      }
      continue;
    }
    let change: RepositoryChange;
    if (record.startsWith('? ')) {
      const path = record.slice(2);
      if (!validPath(path, true)) return invalid();
      change = { kind: 'untracked', path, xy: null, submodule: null };
    } else if (record.startsWith('1 ') || record.startsWith('u ')) {
      const conflict = record[0] === 'u';
      const [fields, path] = fieldsAndPath(record, conflict ? 10 : 8);
      const xy = fields[1]!;
      if (!validPath(path, false)) return invalid();
      if (conflict ? !/^(DD|AU|UD|UA|DU|AA|UU)$/.test(xy) : !/^[.MTAD]{2}$/.test(xy) || xy === '..') return invalid();
      const modes = fields.slice(3, conflict ? 7 : 6);
      if (modes.some((mode) => !/^(000000|100644|100755|120000|160000)$/.test(mode))) return invalid();
      const oids = fields.slice(conflict ? 7 : 6);
      if (oids.some((oid) => !oidPattern.test(oid))) return invalid();
      change = { kind: conflict ? 'unmerged' : 'tracked', path, xy, submodule: submodule(fields[2]!) };
    } else return invalid();
    if (seen.has(change.path)) return invalid();
    seen.add(change.path);
    entries.push({ change, raw: record });
  }
  if (!branch || !commit) return invalid();
  let head: RepositoryHead;
  if (commit === '(initial)') {
    if (branch === '(detached)') return invalid();
    head = { state: 'unborn', branch, commit: null };
  } else {
    if (!oidPattern.test(commit) || /^0+$/.test(commit)) return invalid();
    head = branch === '(detached)'
      ? { state: 'detached', branch: null, commit }
      : { state: 'branch', branch, commit };
  }
  if (head.branch && /[\x00-\x20\x7f~^:?*\[\\]/.test(head.branch)) return invalid();
  entries.sort((a, b) => Buffer.compare(Buffer.from(a.change.path), Buffer.from(b.change.path)));
  return {
    head,
    changes: entries.map((entry) => entry.change),
    // Keep modes and object IDs: an unchanged count/XY is not an unchanged index.
    comparison: JSON.stringify([head, entries.map((entry) => entry.raw)]),
  };
}
