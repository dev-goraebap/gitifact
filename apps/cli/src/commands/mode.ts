import { InitError, parseProjectConfig, validText } from '@tryce/core';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { workflowTransaction } from '../adapters/filesystem/workflow-store.js';
import { digest, publishNoteFile, safeText, readNotes } from '../adapters/filesystem/note-store.js';
import { fileInfo, readConfigFile } from '../adapters/filesystem/config-file.js';

export async function modeCommand(cwd: string, mode?: string, options: { reason?: string; dryRun?: boolean } = {}, env = process.env, beforeWrite?: () => Promise<void>) {
  return workflowTransaction(cwd, !!mode && !options.dryRun, async c => {
    if (!mode) { await c.recheck(); return { mode: c.config.mode, projectFormat: c.config.format, source: 'working-tree' }; }
    if (!['auto', 'approval'].includes(mode) || !validText(options.reason, 2000)) throw new InitError('MODE_INPUT_REQUIRED', 'auto/approval과 사용자 선택을 설명하는 --reason이 필요합니다.');
    if (c.config.format === 'workflow-1' && c.config.mode === mode) { await c.recheck(); return { outcome: 'unchanged', mode }; }
    if (c.config.format !== 'workflow-1' && c.records.sets.length) throw new InitError('EXISTING_REQUIREMENTS', '기존 요구사항 파일을 자동 채택하지 않습니다.');
    if (c.config.format === 'init-1' && (await readNotes(c.root)).notes.length) throw new InitError('EXISTING_NOTES', 'init-1의 기존 note를 자동 채택하지 않습니다.');
    const converted = JSON.stringify(parseProjectConfig(JSON.stringify({ ...c.config, format: 'workflow-1', mode })), null, 2) + '\n';
    const backup = `.tryce/config.${c.config.format}.${digest(c.original)}.json`;
    // Store transition evidence with the preserved bytes; neither entry invents a user approval.
    const evidence = `.tryce/mode-${randomUUID()}.json`;
    await c.repo.checkIgnore(c.root); await c.repo.checkIgnore(c.root, backup); await c.repo.checkIgnore(c.root, evidence);
    await c.recheck(); if (options.dryRun) return { outcome: 'planned', from: c.config.mode, mode, backup, evidence };
    await beforeWrite?.();
    if (await fileInfo(join(c.root, backup))) { if (await safeText(join(c.root, backup)) !== c.original) throw new InitError('BACKUP_CONFLICT', '전환 원본이 다릅니다.'); }
    else await publishNoteFile(c.root, backup, c.original, c.recheck);
    const record = { kind: 'mode-transition-intent', at: new Date().toISOString(), fromFormat: c.config.format, from: c.config.mode, to: mode, backup, reason: options.reason };
    const evidenceText = JSON.stringify(record, null, 2) + '\n';
    if (await fileInfo(join(c.root, evidence))) {
      if (await safeText(join(c.root, evidence)) !== evidenceText) throw new InitError('BACKUP_CONFLICT', '이 전환의 기존 근거가 다릅니다. 기존 파일을 확인하세요.');
    } else await publishNoteFile(c.root, evidence, evidenceText, c.recheck);
    await publishNoteFile(c.root, '.tryce/config.json', converted, async () => {
      await c.recheck(); await c.repo.checkIgnore(c.root); await c.repo.checkIgnore(c.root, backup); await c.repo.checkIgnore(c.root, evidence);
      if (await safeText(join(c.root, backup)) !== c.original || await safeText(join(c.root, evidence)) !== evidenceText) throw new InitError('BACKUP_CONFLICT', '전환 근거가 변경됐습니다.');
    }, true);
    if (await readConfigFile(c.root) !== converted || (await c.repo.inspect()).stamp !== c.first.stamp) throw new InitError('INPUT_CHANGED_AFTER_WRITE', '전환 후 상태를 확인하세요. 원본은 보존했습니다.');
    return { outcome: 'changed', mode, projectFormat: 'workflow-1', backup, evidence, git: 'not-committed' };
  }, env);
}
