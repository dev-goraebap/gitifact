import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { InitError, RepositoryReadError, briefList, briefNotes, parseProjectConfig, summarizeChanges } from '@tryce/core';
import { briefReportV1, briefV1 } from '@tryce/contracts';
import type { BriefV1 } from '@tryce/contracts';
import { createRepositoryReader } from '../adapters/git/repository-reader.js';
import { initRepository } from '../adapters/git/init-repository.js';
import { readConfigFile, fileInfo } from '../adapters/filesystem/config-file.js';
import { readNotes } from '../adapters/filesystem/note-store.js';
import { briefDocuments } from '../adapters/filesystem/brief-documents.js';
import { escapeTerminal } from '../output/repository-status.js';

interface Options { all?: boolean; format?: 'json' | 'text' }
const describe = (error: unknown) => error instanceof InitError || error instanceof RepositoryReadError
  ? { code: error.code, message: error.message }
  : { code: 'BRIEF_READ_FAILED', message: '자료를 읽지 못했습니다. 파일 접근 권한과 상태를 확인하세요.' };
const failed = (error: unknown) => ({ state: 'error' as const, error: describe(error) });
const unavailable = (reason: string) => ({ state: 'not-available' as const, reason });
const available = <T>(data: T) => ({ state: 'available' as const, data });

export async function readBrief(cwd: string, options: Options = {}, env = process.env, beforeVerify?: () => Promise<void>): Promise<BriefV1> {
  try {
    const startedAt = new Date().toISOString();
    const reader = createRepositoryReader(cwd, { env });
    const first = await reader.read();
    const root = first.repository.rootPath;
    const repo = initRepository(root, env);
    const readProject = async () => {
      const text = await readConfigFile(root);
      if (text === undefined) {
        if ((await repo.trackedPaths(root, '.tryce/config.json', first.head.commit)).length) throw new InitError('CONFIG_DELETED', 'HEAD 또는 index의 설정이 작업 폴더에서 삭제됐습니다.');
        return null;
      }
      const config = parseProjectConfig(text);
      await repo.validateBaseline(config, root, first.head.commit, first.repository.objectFormat);
      return { text, config };
    };
    const projectResult = await readProject().then(value => ({ value, error: null }), error => ({ value: null, error }));
    const project = projectResult.error ? failed(projectResult.error) : projectResult.value
      ? available({ source: 'working-tree' as const, path: '.tryce/config.json' as const, ...projectResult.value.config, baselineVerified: true as const })
      : unavailable('not-initialized');
    // kind belongs to the stored document, not the brief project view.
    const projectView = project.state === 'available' ? available({ source: project.data.source, path: project.data.path,
      format: project.data.format, mode: project.data.mode, baseline: project.data.baseline, baselineVerified: true as const }) : project;
    const getNotes = async () => {
      if (await fileInfo(join(root, '.tryce/.notes.lock'))) throw new InitError('PROJECT_BUSY', '기록 작업이 진행 중이거나 잠금이 남아 있습니다.');
      const result = await readNotes(root);
      const paths = await repo.trackedPaths(root, '.tryce/notes/', first.head.commit);
      if (paths.some(path => !result.paths.includes(path))) throw new InitError('NOTE_DELETED', 'HEAD 또는 index의 기록이 작업 폴더에서 삭제됐습니다.');
      return result;
    };
    const enabled = projectResult.value?.config.format === 'prototype-1';
    const [noteResult, documentResult] = await Promise.all([
      enabled ? getNotes().then(value => ({ value, error: null }), error => ({ value: null, error })) : Promise.resolve({ value: null, error: null }),
      briefDocuments(root).then(value => ({ value, error: null }), error => ({ value: null, error })),
    ]);
    let notes = noteResult.error ? failed(noteResult.error) : noteResult.value
      ? available(briefNotes(noteResult.value.notes, options.all)) : unavailable(projectResult.error ? 'configuration-unavailable' : 'notes-not-enabled');
    let documents = documentResult.error ? failed(documentResult.error) : available(briefList(documentResult.value ?? [], 30, options.all));
    let checkedProject = projectView;
    await beforeVerify?.();
    if (!projectResult.error) {
      try {
        if (await readConfigFile(root) !== (projectResult.value?.text ?? undefined)) throw new InitError('INPUT_CHANGED', '조회 중 프로젝트 설정이 변경됐습니다.');
      } catch (error) { checkedProject = failed(error); notes = unavailable('configuration-changed'); }
    }
    if (notes.state === 'available' && noteResult.value) {
      try { if ((await getNotes()).stamp !== noteResult.value.stamp) throw new InitError('INPUT_CHANGED', '조회 중 기록이 변경됐습니다.'); }
      catch (error) { notes = failed(error); }
    }
    if (documents.state === 'available') {
      try { if (JSON.stringify(await briefDocuments(root)) !== JSON.stringify(documentResult.value)) throw new InitError('INPUT_CHANGED', '조회 중 문서 목록이 변경됐습니다.'); }
      catch (error) { documents = failed(error); }
    }
    if (JSON.stringify(await reader.read()) !== JSON.stringify(first)) throw new InitError('REPOSITORY_CHANGED', '조회 중 Git 상태가 변경됐습니다. 다시 실행하세요.');
    const report = briefReportV1.parse({
      observation: { id: randomUUID(), startedAt, completedAt: new Date().toISOString(), consistency: 'best-effort' },
      repository: first.repository,
      git: { source: 'head-index-working-tree', head: first.head, summary: summarizeChanges(first.changes), changes: briefList(first.changes, 20, options.all) },
      project: checkedProject, notes, documents,
      scope: { all: !!options.all, notes: 'working-tree', documents: 'root-AGENTS-README-and-docs-markdown' },
      checks: { state: 'not-run', reason: 'brief-is-observation-only' },
      unsupported: ['requirement-state', 'task-state', 'open-questions', 'history-analysis', 'skill-discovery'],
      followUp: { complete: 'tryce brief --all', notes: 'tryce note list', note: 'tryce note show <id>', git: 'tryce status' },
    });
    const partial = [checkedProject, notes, documents].some(item => item.state === 'error');
    return briefV1.parse(partial ? { contract: 'brief', version: 1, ok: false, report,
      error: { code: 'INCOMPLETE_BRIEF', message: '일부 자료를 확인하지 못했습니다. 자료별 오류와 원문을 확인하세요.' } }
      : { contract: 'brief', version: 1, ok: true, report });
  } catch (error) { return briefV1.parse({ contract: 'brief', version: 1, ok: false, report: null, error: describe(error) }); }
}

export function briefText(dto: BriefV1): string {
  const lines: string[] = [];
  if (!dto.ok) lines.push(dto.error.code + ': ' + dto.error.message);
  const r = dto.report;
  if (!r) return lines.join('\n') + '\n';
  lines.push('저장소: ' + escapeTerminal(r.repository.rootPath),
    '관측: ' + r.observation.completedAt + ' (best-effort)',
    'HEAD: ' + r.git.head.state + ' ' + escapeTerminal(r.git.head.branch ?? '') + ' ' + (r.git.head.commit ?? ''),
    'Git: ' + JSON.stringify(r.git.summary), 'tryce 검사: 미실행');
  if (r.project.state === 'available') lines.push('프로젝트: ' + r.project.data.mode + ' / ' + r.project.data.format,
    '기준선: ' + (r.project.data.baseline.kind === 'empty' ? '기존 커밋 없음' : r.project.data.baseline.commit));
  for (const [name, part] of [['프로젝트', r.project], ['기록', r.notes], ['문서', r.documents]] as const) {
    if (part.state === 'error') lines.push(name + ': ' + part.error.code + ' ' + escapeTerminal(part.error.message));
    if (part.state === 'not-available') lines.push(name + ': ' + part.reason);
  }
  const counts = (name: string, page: { total: number; included: number; omitted: number }) =>
    lines.push(`${name}: 전체 ${page.total}, 포함 ${page.included}, 생략 ${page.omitted}`);
  counts('Git 변경', r.git.changes);
  for (const change of r.git.changes.items) lines.push((change.xy ?? '??') + ' ' + escapeTerminal(change.path));
  if (r.notes.state === 'available') {
    counts('기록 (작업 폴더)', r.notes.data);
    for (const note of r.notes.data.items) lines.push(`${note.id} [${note.type}] ${note.recordedAt} / 작성자 ${escapeTerminal(note.author ?? '')}`,
      escapeTerminal(note.text) + (note.textTruncated ? ' [본문 생략 있음]' : ''),
      '참조: ' + note.references.join(', ') + ' / 정정 대상: ' + (note.supersedes ?? '') + ' / 후속 정정: ' + note.correctedBy.join(', '),
      '원문: ' + note.path);
  }
  if (r.documents.state === 'available') { counts('문서 위치', r.documents.data); for (const doc of r.documents.data.items) lines.push(doc.kind + ': ' + escapeTerminal(doc.path)); }
  lines.push('미지원: 요구사항·작업 상태, 미결 질문, 이력 분석, 스킬 탐색',
    '전체 관측: tryce brief --all / 기록 원문: tryce note show <id> / Git 상세: tryce status');
  return lines.join('\n') + '\n';
}
export async function runBrief(options: Options) {
  const dto = await readBrief(process.cwd(), options);
  (dto.ok ? process.stdout : process.stderr).write(options.format === 'text' ? briefText(dto) : JSON.stringify(dto) + '\n');
  if (!dto.ok) process.exitCode = 1;
}
