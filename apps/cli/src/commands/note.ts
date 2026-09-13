import { randomUUID } from 'node:crypto';
import { InitError, RepositoryReadError, parseProjectConfig, parseNote, validateNoteSet, noteIdPattern } from '@tryce/core';
import type { Note, NoteType } from '@tryce/core';
import { notesV1 } from '@tryce/contracts';
import { initRepository } from '../adapters/git/init-repository.js';
import { readConfigFile } from '../adapters/filesystem/config-file.js';
import { digest, preserveConfig, publishNoteFile, readNotes, safeText, withNoteLock } from '../adapters/filesystem/note-store.js';

interface NoteOptions { format?: 'json' | 'text'; dryRun?: boolean; type?: NoteType; message?: string; file?: string; author?: string; ref?: string[]; supersedes?: string }
interface Controls { now?: () => string; newId?: () => string; beforeWrite?: () => Promise<void>; afterBackup?: () => Promise<void> }
export async function noteCommand(cwd: string, action: 'enable' | 'add' | 'list' | 'show', options: NoteOptions, id?: string, env = process.env, controls: Controls = {}) {
  const repo = initRepository(cwd, env);
  const first = await repo.inspect();
  const root = first.state.repository.rootPath;
  const result = (outcome: string, notes: Note[] = [], backupPath: string | null = null) => notesV1.parse({
    contract: 'notes', version: 1, ok: true, outcome, source: 'working-tree', rootPath: root, notes, backupPath,
  });
  const execute = async () => {
    const original = await readConfigFile(root);
    if (original === undefined) throw new InitError('NOT_INITIALIZED', '먼저 tryce init으로 프로젝트를 초기화하세요.');
    const config = parseProjectConfig(original);
    await repo.validateBaseline(config, root, first.state.head.commit, first.state.repository.objectFormat);
    const initialNotes = await readNotes(root);
    const expected = await repo.trackedPaths(root, '.tryce/notes/', first.state.head.commit);
    if (expected.some(path => !initialNotes.paths.includes(path))) throw new InitError('NOTE_DELETED', 'HEAD 또는 index의 기록이 작업 폴더에 없습니다. 삭제된 기록을 확인하세요.');
    const recheck = async () => {
      if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== original
        || (await readNotes(root)).stamp !== initialNotes.stamp) throw new InitError('INPUT_CHANGED', 'HEAD·index·설정·기록이 변경됐습니다. 다시 실행하세요.');
    };
    if (action === 'enable') {
      if (['prototype-1', 'workflow-1'].includes(config.format)) { await recheck(); return result('already-enabled'); }
      if (config.format !== 'workflow-1' && config.mode !== 'prototype') throw new InitError('PROTOTYPE_REQUIRED', '현재 기록 기능은 prototype 모드에서 활성화합니다. 모드는 자동으로 바꾸지 않습니다.');
      if (initialNotes.notes.length) throw new InitError('EXISTING_NOTES', 'init-1 프로젝트에 이미 기록이 있습니다. 자동으로 채택하지 않습니다.');
      const backupPath = '.tryce/config.init-1.' + digest(original) + '.json';
      await repo.checkIgnore(root); await repo.checkIgnore(root, backupPath);
      await recheck();
      if (options.dryRun) return result('planned', [], backupPath);
      await controls.beforeWrite?.();
      await preserveConfig(root, original, recheck);
      await controls.afterBackup?.();
      const converted = JSON.stringify({ ...config, format: 'prototype-1' }, null, 2) + '\n';
      await publishNoteFile(root, '.tryce/config.json', converted, async () => {
        await recheck();
        await repo.checkIgnore(root); await repo.checkIgnore(root, backupPath);
        if (await safeText(root + '/' + backupPath) !== original) throw new InitError('BACKUP_CONFLICT', '전환 원본이 변경됐습니다.');
      }, true);
      if (await readConfigFile(root) !== converted || (await repo.inspect()).stamp !== first.stamp) throw new InitError('INPUT_CHANGED_AFTER_WRITE', '전환 후 입력이 변경됐습니다. 설정과 보존 원본을 확인하세요.');
      return result('enabled', [], backupPath);
    }
    if (!['prototype-1', 'workflow-1'].includes(config.format)) throw new InitError('NOTES_NOT_ENABLED', 'tryce note enable로 기록 형식을 먼저 활성화하세요.');
    if (action === 'list' || action === 'show') {
      if (action === 'show' && (!id || !noteIdPattern.test(id))) throw new InitError('INVALID_NOTE_ID', '올바른 기록 ID가 필요합니다.');
      const selected = action === 'show' ? initialNotes.notes.filter(note => note.id === id) : initialNotes.notes;
      if (action === 'show' && selected.length === 0) throw new InitError('NOTE_NOT_FOUND', '기록을 찾을 수 없습니다: ' + id);
      await recheck();
      return result(action === 'show' ? 'shown' : 'listed', selected);
    }
    if (config.format !== 'workflow-1' && config.mode !== 'prototype') throw new InitError('PROTOTYPE_REQUIRED', 'prototype 모드에서 기록을 추가하세요.');
    if ((options.message === undefined) === (options.file === undefined)) throw new InitError('NOTE_INPUT_REQUIRED', '--message 또는 --file 중 하나로 본문을 지정하세요.');
    if (initialNotes.notes.length >= 1000) throw new InitError('NOTE_LIMIT', '기록이 1,000개에 도달했습니다.');
    const text = options.file === undefined ? options.message : await safeText(options.file);
    const note = parseNote({ kind: 'tryce-note', format: 'note-1', id: 'N-' + (controls.newId ?? randomUUID)(), type: options.type,
      text, author: options.author ?? null, recordedAt: (controls.now ?? (() => new Date().toISOString()))(), references: options.ref ?? [], supersedes: options.supersedes ?? null });
    validateNoteSet([...initialNotes.notes, note]);
    const path = '.tryce/notes/' + note.id + '.json';
    await repo.checkIgnore(root, path);
    await controls.beforeWrite?.();
    // Creating an empty notes directory is harmless but changes its observation stamp.
    const checkBeforePublication = async () => {
      if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== original) throw new InitError('INPUT_CHANGED', '프로젝트 입력이 변경됐습니다.');
      const latest = await readNotes(root);
      if (latest.stamp !== initialNotes.stamp && !(initialNotes.stamp === 'absent' && latest.notes.length === 0)) throw new InitError('INPUT_CHANGED', '기록이 변경됐습니다.');
      await repo.checkIgnore(root, path);
    };
    const serialized = JSON.stringify(note, null, 2) + '\n';
    if (Buffer.byteLength(serialized) > 65536) throw new InitError('NOTE_LIMIT', '직렬화한 기록이 64 KiB를 초과합니다.');
    if (initialNotes.bytes + Buffer.byteLength(serialized) > 16 * 1024 * 1024) throw new InitError('NOTE_LIMIT', '기록 전체 크기가 16 MiB를 초과합니다.');
    await publishNoteFile(root, path, serialized, checkBeforePublication);
    const after = await readNotes(root);
    if (!after.notes.some(n => n.id === note.id && JSON.stringify(n) === JSON.stringify(note))
      || after.notes.length !== initialNotes.notes.length + 1 || (await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== original) {
      throw new InitError('INPUT_CHANGED_AFTER_WRITE', '기록 확정 후 입력이 변경됐습니다. 생성된 기록은 보존했습니다.');
    }
    return result('added', [note]);
  };
  if (action === 'enable' && options.dryRun || action === 'list' || action === 'show') return execute();
  // Do not create directories before confirming an initialized, supported project.
  const source = await readConfigFile(root);
  if (source === undefined) throw new InitError('NOT_INITIALIZED', '먼저 tryce init으로 프로젝트를 초기화하세요.');
  parseProjectConfig(source);
  return withNoteLock(root, execute);
}

export async function runNote(action: 'enable' | 'add' | 'list' | 'show', options: NoteOptions, id?: string) {
  try {
    const dto = await noteCommand(process.cwd(), action, options, id);
    if (!dto.ok) throw new Error('Unexpected result');
    process.stdout.write(options.format === 'text' ? [dto.outcome, ...dto.notes.map(note =>
      `${note.id} [${note.type}] ${note.recordedAt}${note.author ? ' — ' + note.author : ''}\n${note.text}\n참조: ${note.references.join(', ') || '없음'} / 정정 대상: ${note.supersedes ?? '없음'}`),
      ...(dto.backupPath ? ['전환 원본: ' + dto.backupPath] : [])].join('\n\n') + '\n' : JSON.stringify(dto) + '\n');
  } catch (error) {
    const known = error instanceof InitError || error instanceof RepositoryReadError;
    const dto = notesV1.parse({ contract: 'notes', version: 1, ok: false, error: { code: known ? error.code : 'NOTE_FAILED',
      message: known ? error.message : '기록 작업에 실패했습니다. 생성 파일·잠금·보존 원본을 확인하세요.' } });
    process.stderr.write(options.format === 'text' && !dto.ok ? dto.error.code + ': ' + dto.error.message + '\n' : JSON.stringify(dto) + '\n');
    process.exitCode = 1;
  }
}
