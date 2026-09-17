import { parsePreviewFiles, parsePreviewBundle, SpecPreviewError, parseProjectConfig, recordPathPattern, STORE_DIRS, DOCUMENT_DIRS, type PreviewSpec, type PreviewBundle } from '@gitifact/core';

/** Every path prefix Git reads for the record set: spec folders in both store names plus the document folders. */
export const RECORD_PATHSPECS = [...STORE_DIRS.map(d => d + '/spec/'), ...Object.values(DOCUMENT_DIRS).map(d => d + '/')];
import { createGitRunner } from './run-git.js';
import { commandScoped } from './command-scope.js';
import { t } from '../../shared/i18n/index.js';

// A commit that still holds legacy JSON records. Callers detect it by type because the message is localized.
export class LegacyBaselineError extends SpecPreviewError {}

export function specPreviewReader(cwd: string) {
  // Avoid repository/index overrides and replacements when reading immutable commits.
  for (const key of Object.keys(process.env)) if (/^GIT_(DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_COUNT|CONFIG_PARAMETERS|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/i.test(key)) {
    throw new SpecPreviewError(t('reader.gitContextOverride'));
  }
  const runner = createGitRunner();
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '0', GIT_GLOB_PATHSPECS: '0', GIT_NOGLOB_PATHSPECS: '0', GIT_ICASE_PATHSPECS: '0', LC_ALL: 'C' };
  const git = (args: string[], input?: Buffer, acceptedExitCodes = [0]) => runner(['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
    cwd, env, timeoutMs: 15000, maxBytes: 32 * 1024 * 1024, acceptedExitCodes, ...(input ? { input } : {}),
  });
  const decode = (bytes: Buffer) => {
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new SpecPreviewError(t('reader.notUtf8')); }
  };
  return {
    async index() {
      const output = decode(await git(['ls-files', '--stage', '-z', '--', ...RECORD_PATHSPECS]));
      const files = new Map<string, string>();
      for (const row of output.split('\0').filter(Boolean)) {
        const match = /^(\d+) ([a-f0-9]+) ([0-3])\t([\s\S]+)$/.exec(row);
        if (!match) throw new SpecPreviewError(t('reader.invalidIndexEntry'));
        const [, mode, oid, stage, path] = match;
        if (!['100644', '100755'].includes(mode!) || stage !== '0') throw new SpecPreviewError(t('reader.stagingConflictOrLink'));
        // Non-Markdown files in the document folders are outside the record set and simply ignored.
        if (!recordPathPattern.test(path!)) { if (/^\.gitifact\/(?:product|guides)\//.test(path!)) continue; throw new SpecPreviewError(t('reader.stagingUnsupported')); }
        files.set(path!, oid!);
      }
      return files;
    },
    async hasUnmerged() {
      return (await git(['ls-files', '--unmerged', '-z'])).length > 0;
    },
    async baseline() {
      // HEAD^{commit} verifies the object type in the same process; a non-commit HEAD falls through to the corruption check.
      const [headOutput, branchOutput] = await Promise.all([
        git(['rev-parse', '--verify', '--quiet', '--end-of-options', 'HEAD^{commit}'], undefined, [0, 1]),
        git(['symbolic-ref', '--quiet', 'HEAD'], undefined, [0, 1]),
      ]);
      const head = decode(headOutput).trim(); const branch = decode(branchOutput).trim();
      if (head) {
        if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw new SpecPreviewError(t('reader.headUnknown'));
        return { head, branch: branch || null };
      }
      if (!branch.startsWith('refs/heads/') || (await git(['for-each-ref', '--format=%(refname)', '--', branch])).length) throw new SpecPreviewError(t('reader.damagedHead'));
      return { head: null, branch };
    },
    location() {
      return commandScoped('spec-location\0' + cwd, async () => {
        const fields = [['--show-toplevel'], ['--absolute-git-dir'], ['--git-path', 'index'], ['--show-object-format']];
        const line = (bytes: Buffer) => decode(bytes).replace(/\n$/, '');
        let values = line(await git(['rev-parse', '--path-format=absolute', ...fields.flat()])).split('\n');
        // A legal POSIX path can contain newlines. Read fields individually instead of guessing boundaries.
        if (values.length !== fields.length) values = await Promise.all(fields.map(async flags => line(await git(['rev-parse', '--path-format=absolute', ...flags]))));
        const [root, gitDir, indexPath, objectFormat] = values.map(value => value.trim()) as [string, string, string, string];
        if (objectFormat !== 'sha1' && objectFormat !== 'sha256') throw new SpecPreviewError(t('reader.objectFormat'));
        return { root, gitDir, indexPath, objectFormat };
      });
    },
    async resolve(ref: string) {
      const oid = (await git(['rev-parse', '--verify', '--end-of-options', ref + '^{commit}'])).toString('ascii').trim();
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oid)) throw new SpecPreviewError(t('reader.commitUnknown'));
      return oid;
    },
    async files(oid: string, allowLegacyBaseline = false): Promise<Map<string, string>> {
      const entries = decode(await git(['ls-tree', '--full-tree', '-r', '-z', oid, '--', ...RECORD_PATHSPECS]));
      const files = new Map<string, string>();
      let legacy: string | undefined;
      for (const row of entries.split('\0').filter(Boolean)) {
        const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(row);
        if (!match) throw new SpecPreviewError(t('reader.invalidTree'));
        const [, mode, type, object, path] = match;
        if (!['100644', '100755'].includes(mode!) || type !== 'blob') throw new SpecPreviewError(t('reader.linkOrSubmodule', { path }));
        if (!recordPathPattern.test(path!) && !path!.endsWith('/tryce.json')) continue;
        if (path!.endsWith('/tryce.json')) {
          if (!allowLegacyBaseline) throw new LegacyBaselineError(t('reader.legacyJson'));
          legacy = path!.split('/')[0]; continue;
        }
        if (!recordPathPattern.test(path!) || !['100644', '100755'].includes(mode!) || type !== 'blob') throw new SpecPreviewError(t('reader.unsupportedEntry', { path }));
        files.set(path!, object!);
      }
      if (new Set([...files.keys()].map(p => p.split('/')[0])).size > 1) throw new SpecPreviewError(t('reader.mixedStores'));
      if (legacy) {
        if (files.size) throw new SpecPreviewError(t('reader.mixedFormats'));
        parseProjectConfig(decode(await git(['show', `${oid}:${legacy}/config.json`])));
      }
      if (files.size > 2000) throw new SpecPreviewError(t('reader.fileLimit'));
      const blobs = new Map<string, string>(); const ids = [...new Set(files.values())]; let totalBytes = 0;
      for (let i = 0; i < ids.length; i += 128) {
        const batch = ids.slice(i, i + 128);
        const output = await git(['cat-file', '--batch'], Buffer.from(batch.join('\n') + '\n')); let offset = 0;
        for (const id of batch) {
          const end = output.indexOf(10, offset); const header = output.subarray(offset, end).toString('ascii').split(' '); const size = Number(header[2]);
          if (end < offset || header[0] !== id || header[1] !== 'blob' || !Number.isSafeInteger(size) || size < 0 || size > 1024 * 1024 || output[end + size + 1] !== 10) throw new SpecPreviewError(t('reader.blobShape'));
          totalBytes += size;
          if (totalBytes > 16 * 1024 * 1024) throw new SpecPreviewError(t('reader.totalLimit'));
          blobs.set(id, decode(output.subarray(end + 1, end + size + 1))); offset = end + size + 2;
        }
        if (offset !== output.length) throw new SpecPreviewError(t('reader.blobBoundary'));
      }
      return new Map([...files].map(([path, id]) => [path, blobs.get(id)!]));
    },
    async read(oid: string): Promise<PreviewSpec[]> {
      const files = await this.files(oid);
      return parsePreviewFiles(files);
    },
    async readBundle(oid: string): Promise<PreviewBundle> {
      return parsePreviewBundle(await this.files(oid));
    },
  };
}
