import { parseStoreBundle, StoreError, recordPathPattern, STORE_DIR, WIKI_DIR, type StoreBundle } from '@gitifact/core';

/** Every path prefix Git reads for the record set: the spec folders plus the wiki. */
export const RECORD_PATHSPECS = [STORE_DIR + '/spec/', WIKI_DIR + '/'];
import { createGitRunner } from './run-git.js';
import { commandScoped } from './command-scope.js';
import { t } from '../../shared/i18n/index.js';

export function storeReader(cwd: string) {
  // Avoid repository/index overrides and replacements when reading immutable commits.
  for (const key of Object.keys(process.env)) if (/^GIT_(DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_COUNT|CONFIG_PARAMETERS|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/i.test(key)) {
    throw new StoreError(t('reader.gitContextOverride'));
  }
  const runner = createGitRunner();
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '0', GIT_GLOB_PATHSPECS: '0', GIT_NOGLOB_PATHSPECS: '0', GIT_ICASE_PATHSPECS: '0', LC_ALL: 'C' };
  const git = (args: string[], input?: Buffer, acceptedExitCodes = [0]) => runner(['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
    cwd, env, timeoutMs: 15000, maxBytes: 32 * 1024 * 1024, acceptedExitCodes, ...(input ? { input } : {}),
  });
  const decode = (bytes: Buffer) => {
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new StoreError(t('reader.notUtf8')); }
  };
  return {
    /** Git under the same guarded environment, for readers that shape their own commands (the browser's history). */
    run(args: string[], input?: Buffer) { return git(args, input); },
    decode,
    async index() {
      const output = decode(await git(['ls-files', '--stage', '-z', '--', ...RECORD_PATHSPECS]));
      const files = new Map<string, string>();
      for (const row of output.split('\0').filter(Boolean)) {
        const match = /^(\d+) ([a-f0-9]+) ([0-3])\t([\s\S]+)$/.exec(row);
        if (!match) throw new StoreError(t('reader.invalidIndexEntry'));
        const [, mode, oid, stage, path] = match;
        if (!['100644', '100755'].includes(mode!) || stage !== '0') throw new StoreError(t('reader.stagingConflictOrLink'));
        // Non-Markdown files in the wiki folder are outside the record set and simply ignored.
        if (!recordPathPattern.test(path!)) { if (path!.startsWith(WIKI_DIR + '/')) continue; throw new StoreError(t('reader.stagingUnsupported')); }
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
        if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw new StoreError(t('reader.headUnknown'));
        return { head, branch: branch || null };
      }
      if (!branch.startsWith('refs/heads/') || (await git(['for-each-ref', '--format=%(refname)', '--', branch])).length) throw new StoreError(t('reader.damagedHead'));
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
        if (objectFormat !== 'sha1' && objectFormat !== 'sha256') throw new StoreError(t('reader.objectFormat'));
        return { root, gitDir, indexPath, objectFormat };
      });
    },
    async resolve(ref: string) {
      const oid = (await git(['rev-parse', '--verify', '--end-of-options', ref + '^{commit}'])).toString('ascii').trim();
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oid)) throw new StoreError(t('reader.commitUnknown'));
      return oid;
    },
    /** The record files of one commit's tree, path to blob ID. */
    async tree(oid: string): Promise<Map<string, string>> {
      const entries = decode(await git(['ls-tree', '--full-tree', '-r', '-z', oid, '--', ...RECORD_PATHSPECS]));
      const files = new Map<string, string>();
      for (const row of entries.split('\0').filter(Boolean)) {
        const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(row);
        if (!match) throw new StoreError(t('reader.invalidTree'));
        const [, mode, type, object, path] = match;
        if (!['100644', '100755'].includes(mode!) || type !== 'blob') throw new StoreError(t('reader.linkOrSubmodule', { path }));
        if (!recordPathPattern.test(path!)) continue;
        files.set(path!, object!);
      }
      if (files.size > 2000) throw new StoreError(t('reader.fileLimit'));
      return files;
    },
    /** The text of the given blobs, read a few hundred at a time, with the size limits of the store convention. */
    async blobs(ids: readonly string[], limitBytes = 16 * 1024 * 1024): Promise<Map<string, string>> {
      const blobs = new Map<string, string>(); let totalBytes = 0;
      for (let i = 0; i < ids.length; i += 512) {
        const batch = ids.slice(i, i + 512);
        const output = await git(['cat-file', '--batch'], Buffer.from(batch.join('\n') + '\n')); let offset = 0;
        for (const id of batch) {
          const end = output.indexOf(10, offset); const header = output.subarray(offset, end).toString('ascii').split(' '); const size = Number(header[2]);
          if (end < offset || header[0] !== id || header[1] !== 'blob' || !Number.isSafeInteger(size) || size < 0 || size > 1024 * 1024 || output[end + size + 1] !== 10) throw new StoreError(t('reader.blobShape'));
          totalBytes += size;
          if (totalBytes > limitBytes) throw new StoreError(t('reader.totalLimit'));
          blobs.set(id, decode(output.subarray(end + 1, end + size + 1))); offset = end + size + 2;
        }
        if (offset !== output.length) throw new StoreError(t('reader.blobBoundary'));
      }
      return blobs;
    },
    async files(oid: string): Promise<Map<string, string>> {
      const files = await this.tree(oid);
      const blobs = await this.blobs([...new Set(files.values())]);
      return new Map([...files].map(([path, id]) => [path, blobs.get(id)!]));
    },
    async readBundle(oid: string): Promise<StoreBundle> {
      return parseStoreBundle(await this.files(oid));
    },
    /**
     * The 0.7 trees of many commits at once. Their trees are listed a few at a time — one `ls-tree` is a process, and
     * several at once fill the wait — and then every blob they name is read in one pass. Commits in a row share most
     * of their files, so reading each tree on its own asked Git for the same blobs again and again: a first history
     * build of this repository spent about 80ms per tree that way.
     */
    async readBundles(oids: readonly string[]): Promise<Map<string, StoreBundle>> {
      const trees = new Map<string, Map<string, string>>();
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(8, oids.length) }, async () => {
        while (next < oids.length) {
          const oid = oids[next++]!;
          // A tree the 0.7 parser cannot list contributes nothing; the caller treats a missing bundle as empty.
          await this.tree(oid).then(files => { trees.set(oid, files); }, () => undefined);
        }
      }));
      const ids = [...new Set([...trees.values()].flatMap(files => [...files.values()]))];
      const blobs = await this.blobs(ids, 16 * 1024 * 1024 * Math.max(1, trees.size));
      const bundles = new Map<string, StoreBundle>();
      for (const [oid, files] of trees) {
        try { bundles.set(oid, parseStoreBundle(new Map([...files].map(([path, id]) => [path, blobs.get(id)!])))); } catch { /* left out, read as empty */ }
      }
      return bundles;
    },
  };
}
