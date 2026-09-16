import { lstat, readdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { InitError, parseManagedConfig, parsePreviewFiles, RepositoryReadError, SpecPreviewError } from '@gitifact/core';
import { specPreviewReader } from '../adapters/git/spec-preview-reader.js';
import { withCommandScope } from '../adapters/git/command-scope.js';
import { LEGACY_LOCKS } from '../adapters/filesystem/spec-preview-store.js';

const operations = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_START', 'index.lock'];
const info = (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
const decode = (bytes: Buffer) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const fail = (code: string, message: string): never => { throw new InitError(code, message); };

/**
 * Moves a Tryce checkout to the Gitifact store: `.tryce` becomes `.gitifact` and the `tryce-*` markers at
 * line starts become `gitifact-*`. IDs, reasons, config and committed history are untouched; the caller
 * commits the result with `spec commit`. Skills and ignore rules are reported, not rewritten.
 */
export async function migrateStore(cwd: string, dryRun = false) {
  const reader = specPreviewReader(cwd); const { root, gitDir } = await reader.location();
  for (const marker of operations) if (await info(join(gitDir, marker))) fail('GIT_OPERATION_IN_PROGRESS', 'Git 작업이 진행 중입니다: ' + marker);
  if (await reader.hasUnmerged()) fail('GIT_OPERATION_IN_PROGRESS', 'Git 충돌을 먼저 해결하세요.');
  for (const name of [...LEGACY_LOCKS, 'gitifact-spec-preview.lock', 'gitifact-spec-commit.lock']) if (await info(join(gitDir, name))) fail('LOCKED', '잠금 또는 복구 자료가 있습니다: ' + join(gitDir, name));
  const from = join(root, '.tryce'); const to = join(root, '.gitifact');
  const fromInfo = await info(from);
  if (await info(to)) fail('ALREADY_MIGRATED', '.gitifact가 이미 있습니다. .tryce가 남아 있으면 내용을 비교한 뒤 직접 정리하세요.');
  if (!fromInfo) return fail('NOTHING_TO_MIGRATE', '.tryce 저장소가 없습니다.');
  if (!fromInfo.isDirectory() || fromInfo.isSymbolicLink()) fail('PATH_CONFLICT', '.tryce는 링크가 아닌 일반 디렉터리여야 합니다.');
  const configInfo = await info(join(from, 'config.json'));
  if (!configInfo?.isFile() || configInfo.isSymbolicLink()) fail('NOT_INITIALIZED', '.tryce/config.json이 없습니다.');
  const config = parseManagedConfig(decode(await readFile(join(from, 'config.json'))));
  if (!('schemaVersion' in config)) fail('UNSUPPORTED_FORMAT', '구형 JSON 형식은 전환하지 않습니다. 기록을 보존하고 별도 절차를 확인하세요.');
  const top = (await readdir(from)).sort();
  if (top.some(name => name !== 'config.json' && name !== 'spec')) fail('UNSUPPORTED_FORMAT', '.tryce에 config.json·spec 외 항목이 있습니다. 정리한 뒤 다시 실행하세요.');
  const files = new Map<string, string>(); const rewrites: { path: string; content: string }[] = []; const legacyRecords: string[] = [];
  const marker = /^<!-- tryce-(spec|req|design|ref): /;
  if (top.includes('spec')) {
    for (const feature of (await readdir(join(from, 'spec'))).sort()) {
      const dir = join(from, 'spec', feature); const stat = await info(dir);
      if (!stat?.isDirectory() || stat.isSymbolicLink()) fail('UNSUPPORTED_FORMAT', '명세 폴더가 아닙니다: ' + feature);
      for (const name of (await readdir(dir)).sort()) {
        if (!['requirements.md', 'design.md', 'history.jsonl', 'tryce.json'].includes(name)) fail('UNSUPPORTED_FORMAT', '지원하지 않는 명세 파일입니다: .tryce/spec/' + feature + '/' + name);
        const fileStat = await info(join(dir, name));
        if (!fileStat?.isFile() || fileStat.isSymbolicLink() || fileStat.nlink !== 1 || fileStat.size > 1024 * 1024) fail('UNSUPPORTED_FORMAT', '일반 파일이 아니거나 1 MiB를 넘습니다: ' + name);
        const newPath = `.gitifact/spec/${feature}/${name}`;
        // Old JSON records are moved untouched; `spec commit` may only select them for deletion.
        if (name === 'tryce.json') { legacyRecords.push(newPath); continue; }
        const text = decode(await readFile(join(dir, name)));
        if (name === 'history.jsonl') { files.set(newPath, text); continue; }
        // Same fence rule as the parser: examples inside code blocks are prose and stay as written.
        let fence: { char: string; size: number } | undefined;
        const next = text.split('\n').map(line => {
          if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; return line; }
          const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
          if (open) { fence = { char: open[1]![0]!, size: open[1]!.length }; return line; }
          return marker.test(line) ? line.replace(/^<!-- tryce-/, '<!-- gitifact-') : line;
        }).join('\n');
        files.set(newPath, next);
        if (next !== text) rewrites.push({ path: newPath, content: next });
      }
    }
  }
  // The rewritten set must parse as a complete Gitifact store before anything is moved.
  const specs = parsePreviewFiles(files);
  const result = (outcome: 'planned' | 'migrated') => ({ contract: 'migrate', version: 1, ok: true, outcome, rootPath: root, from: '.tryce', to: '.gitifact',
    specs: specs.map(s => ({ id: s.id, path: s.path, requirements: s.requirements.length, history: s.history.length, design: !!s.design })),
    rewritten: rewrites.map(r => r.path), legacyRecords,
    next: ['변경을 확인한 뒤 gitifact spec commit으로 .tryce 삭제와 .gitifact 추가를 함께 커밋하세요.',
      ...(legacyRecords.length ? ['구형 JSON 명세(tryce.json)는 읽지 않습니다. 내용을 Markdown 명세로 옮긴 뒤 삭제를 spec commit에 선택하세요.'] : []),
      '.agents/skills/tryce-workflow와 .claude 복사본이 있으면 정리하고 gitifact init을 다시 실행해 AGENTS.md 등의 GITIFACT 블록을 갱신하세요.',
      '.gitignore·AGENTS.md·CLAUDE.md의 .tryce·tryce-workflow 언급을 새 이름으로 맞추세요.'] });
  if (dryRun) return result('planned');
  await rename(from, to);
  for (const r of rewrites) {
    const full = join(root, r.path); const temp = join(root, '.gitifact', 'spec', '.gitifact-migrate-' + randomBytes(8).toString('hex'));
    await writeFile(temp, r.content, { flag: 'wx' });
    try { await rename(temp, full); } finally { await unlink(temp).catch(() => {}); }
  }
  return result('migrated');
}

export async function runMigrate(options: { dryRun?: boolean }) {
  try {
    const dto = await withCommandScope(() => migrateStore(process.cwd(), !!options.dryRun));
    process.stdout.write(JSON.stringify(dto) + '\n');
  } catch (error) {
    const known = error instanceof InitError || error instanceof SpecPreviewError || error instanceof RepositoryReadError;
    process.stderr.write(JSON.stringify({ contract: 'migrate', version: 1, ok: false, error: { code: known ? error.code : 'MIGRATE_FAILED', message: known ? error.message : '전환에 실패했습니다. .tryce와 .gitifact의 상태를 확인하세요.' } }) + '\n');
    process.exitCode = 1;
  }
}
