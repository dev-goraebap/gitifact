import { INSTRUCTIONS_ROOT, type InstructionDoc } from '@gitifact/core';
import { readInstructionFile } from '../adapters/filesystem/instruction-folder.js';
import { committed, createDocument, draftMark, fileLine, showDocuments, stateMark, working } from './documents.js';
import { listInstructions } from '../queries/instructions.js';
import { checkFields, aside, cursorGone, pageLine, selected, type ListOptions } from './list-options.js';
import { CommandError, runCommand, text, type Format } from './output.js';
import { openProject, type Project } from './project.js';
import { t } from '../shared/i18n/index.js';

export const instructionSorts = ['name', 'updated'] as const;
const columns = ['id', 'name', 'path', 'title', 'description', 'draft', 'state', 'previousPath', 'files', 'updated', 'line'] as const;

/** `instructions list`: AGENTS.md, then the instructions `queries/instructions.ts` picks and pages, each with its files. */
export const runInstructionsList = (options: ListOptions & { sort: typeof instructionSorts[number] }) => runCommand('instructions', options.format, async () => {
  const fields = checkFields(options.fields, columns);
  const project = await openProject(process.cwd());
  const listed = await listInstructions(project, { ...options, withUpdated: !!fields?.includes('updated') }, options) ?? cursorGone(options);
  const { agents, problems, page } = listed; const shown = page.rows;
  const paging = { total: page.total, next: page.next, unit: 'instruction' as const };
  const unreadable = problems.filter(p => p.path.startsWith(INSTRUCTIONS_ROOT + '/'));
  if (fields) {
    // A text cell names the files by path; JSON keeps them whole.
    const picked = selected(shown, fields);
    return { json: { agents, instructions: picked.json, problems: unreadable, page: paging },
      text: selected(shown.map(r => ({ ...r, files: r.files.map(f => f.path) })), fields).text + aside(options.format, pageLine(page)) };
  }
  const out = [agents.exists ? t('instructions.agents') : t('instructions.noAgents')];
  for (const r of shown) {
    const when = r.updated ? ` · ${r.updated.date.slice(0, 10)} ${r.updated.author}` : '';
    out.push(`${r.id} ${r.title}${draftMark(r as { draft?: true })}${stateMark(r.state)} (${r.name}) — ${r.description}${when}`, ...(r.line ? ['  ' + r.line] : []));
    out.push(...r.files.map(f => '  ' + fileLine(f)), ...(r.filesLimited ? ['  ' + t('instructions.filesLimited', { count: r.files.length })] : []));
  }
  if (!shown.length) out.push(options.q !== undefined || options.author !== undefined ? t('docs.noMatch') : t('instructions.empty'));
  out.push(...pageLine(page));
  if (unreadable.length) out.push(t('docs.unreadable', { count: unreadable.length }));
  return { json: { agents, instructions: shown, problems: unreadable, page: paging }, text: text(out) };
});

/** An instruction named by its I- ID or by its folder name, resolved to the ID. */
async function resolveInstructions(project: Project, targets: string[], at: string | undefined): Promise<string[]> {
  const view = at === undefined ? await working(project) : await committed(project, at);
  const byName = new Map([...view.byId.values()].filter((d): d is InstructionDoc => d.kind === 'instruction').map(d => [d.name, d.id]));
  // Folder names are lower case and IDs start with a capital prefix, so the two never collide.
  return targets.map(target => byName.get(target) ?? target);
}

/**
 * `instructions show`: index.md as written, the designs that name the instruction and the other files of its folder;
 * with `--file`, one of those files instead.
 */
export const runInstructionsShow = (targets: string[], options: { format: Format; ref?: string; file?: string }) => runCommand('instructions', options.format, async () => {
  const project = await openProject(process.cwd());
  if (options.file !== undefined && (targets.length !== 1 || options.ref !== undefined)) throw new CommandError('INVALID_VALUE', t('instructions.fileWithOne'));
  const at = options.ref === undefined ? undefined : await project.reader.resolve(options.ref);
  const ids = await resolveInstructions(project, targets, at);
  if (options.file === undefined) return showDocuments(project, ids, at, ['instruction'], 'specs show');
  const instruction = (await working(project)).byId.get(ids[0]!);
  if (instruction?.kind !== 'instruction') throw new CommandError('UNKNOWN_DOCUMENT', t('docs.unknownDocument', { ids: targets[0]! }));
  const found = await readInstructionFile(project.root, instruction.path, options.file);
  if (!found) throw new CommandError('UNKNOWN_FILE', t('instructions.unknownFile', { path: options.file, name: instruction.name }));
  const note = found.text !== null ? [] : [found.tooLarge ? t('instructions.fileTooLarge', { size: found.size }) : t('instructions.fileBinary', { size: found.size })];
  return { json: { id: instruction.id, name: instruction.name, file: { path: options.file, ...found } },
    text: text([`== ${instruction.id} ${instruction.name}/${options.file}`, ...(found.text !== null ? [found.text.replace(/\n$/, '')] : note)]) };
});

/** `instructions new <name>`: an instruction folder with index.md, an issued ID and a draft skeleton. */
export const runInstructionsNew = (name: string, options: { format: Format; title: string; description: string }) => runCommand('instructions', options.format, async () =>
  createDocument(await openProject(process.cwd()), 'instruction', name, options));
