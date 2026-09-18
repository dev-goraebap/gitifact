import { readFile } from 'node:fs/promises';
import { InitError } from '@gitifact/core';
import { defaultLanguage, t, type Language } from '../shared/i18n/index.js';
import { docTopics } from './docs.js';

// Text logic for the managed GITIFACT block in agent instruction files. Only renderAgentBlock reads a file,
// the bundled block body, and tests replace that reader.
export const AGENT_START = '<!-- GITIFACT:START -->';
export const AGENT_END = '<!-- GITIFACT:END -->';
export const candidatePaths = ['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md', '.cursorrules', '.hermes.md', 'HERMES.md'] as const;
export type CandidatePath = typeof candidatePaths[number];
export type AgentPreset = 'claude' | 'cursor' | 'codex' | 'hermes' | 'all';
export const agentPresetNames: readonly AgentPreset[] = ['claude', 'cursor', 'codex', 'hermes', 'all'];
// Search order per tool; the first existing file wins and the last entry is created when none exist.
export const agentPresets: Record<Exclude<AgentPreset, 'all'>, readonly CandidatePath[]> = {
  claude: ['CLAUDE.md', '.claude/CLAUDE.md'],
  cursor: ['.cursorrules', 'AGENTS.md'],
  codex: ['AGENTS.md'],
  hermes: ['.hermes.md', 'HERMES.md', 'AGENTS.md'],
};
export function boilerplateFor(path: string) {
  const name = path === 'AGENTS.md' ? path : path.split('/').pop()!.replace(/^\./, '').replace(/\.md$/, '');
  return '# ' + name + '\n\nProject-specific guidance for AI coding agents.\n';
}
// The block body is one Markdown file per language; only {version}, {language} and {topics} are filled here.
const readBundledBlock = (lang: Language) => readFile(new URL('./i18n/' + lang + '/block.md', import.meta.url), 'utf8');
export interface AgentBlockControls { readBlock?: (lang: Language) => Promise<string> }
export async function renderAgentBlock(version: string, controls: AgentBlockControls = {}, lang: Language = defaultLanguage) {
  const body = await (controls.readBlock ?? readBundledBlock)(lang);
  const filled = body.trimEnd().replace(/\{(version|language|topics)\}/g, (_whole, name: string) =>
    name === 'version' ? version : name === 'language' ? lang : docTopics.join(', '));
  return AGENT_START + '\n' + filled + '\n' + AGENT_END;
}
// The header carries an optional language token. Blocks written before it existed stay readable, and the
// text between the language and `schemaVersion` is localized, so it is not matched literally.
export function parseAgentBlock(text: string) {
  const match = /^gitifact v(\S+)(?: · ([a-z][a-z-]*))? · .*schemaVersion (\d+)$/m.exec(text);
  if (!match) return null;
  return { version: match[1]!, language: (match[2] ?? defaultLanguage) as Language, schemaVersion: Number(match[3]) };
}
export function findBlock(text: string) {
  const start = text.indexOf(AGENT_START);
  if (start === -1) {
    if (text.includes(AGENT_END)) throw new InitError('AGENT_DOCS_MALFORMED', t('agentBlock.endWithoutStart'));
    return null;
  }
  const end = text.indexOf(AGENT_END, start + AGENT_START.length);
  if (end === -1) throw new InitError('AGENT_DOCS_MALFORMED', t('agentBlock.startWithoutEnd'));
  if (text.indexOf(AGENT_START, start + AGENT_START.length) !== -1) throw new InitError('AGENT_DOCS_MALFORMED', t('agentBlock.duplicateStart'));
  return { start, end: end + AGENT_END.length };
}
// A file whose only content is `@` imports of other candidate files loads them instead of holding its own rules.
// A block an earlier run expanded there does not change that, so it is ignored when classifying.
export function isWrapperFile(text: string) {
  const found = findBlock(text);
  const own = found ? text.slice(0, found.start) + text.slice(found.end) : text;
  const lines = own.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every(line => /^@(?:\.\/)?[^\s]+$/.test(line) && (candidatePaths as readonly string[]).includes(line.replace(/^@(?:\.\/)?/, '')));
}
// Claude Code loads CLAUDE.md but not AGENTS.md, so a project whose block lives only in AGENTS.md gets a root CLAUDE.md
// that imports it. Only this exact content counts as the wrapper init wrote; anything else belongs to the user.
export const CLAUDE_WRAPPER_PATH = 'CLAUDE.md';
export function claudeWrapperFor(agents: string | null) { return '@AGENTS.md' + eolOf(agents); }
export function isGeneratedClaudeWrapper(text: string) { return text.trim() === '@AGENTS.md'; }
export function lacksClaudeFile(existing: ReadonlyMap<CandidatePath, string>) { return !existing.has('CLAUDE.md') && !existing.has('.claude/CLAUDE.md'); }
export function resolveAgentPaths(preset: AgentPreset | undefined, existing: ReadonlyMap<CandidatePath, string>): { inject: CandidatePath[]; create: CandidatePath | null } {
  if (preset && preset !== 'all') {
    const order = agentPresets[preset];
    const found = order.find(path => existing.has(path));
    return found ? { inject: [found], create: null } : { inject: [], create: order[order.length - 1]! };
  }
  const inject = candidatePaths.filter(path => existing.has(path) && !isWrapperFile(existing.get(path)!));
  if (inject.length > 0) return { inject, create: null };
  return { inject: [], create: 'AGENTS.md' };
}
const eolOf = (text: string | null) => text?.includes('\r\n') ? '\r\n' : '\n';
export function injectBlock(text: string | null, block: string, boilerplate: string) {
  const eol = eolOf(text);
  const body = block.split('\n').join(eol);
  if (text === null) return boilerplate.split('\n').join(eol) + eol + body + eol;
  const found = findBlock(text);
  if (found) return text.slice(0, found.start) + body + text.slice(found.end);
  const head = text.replace(/\s+$/, '');
  return (head ? head + eol + eol : '') + body + eol;
}
export function removeBlock(text: string, boilerplate: string): string | null {
  const found = findBlock(text);
  if (!found) return text;
  const eol = eolOf(text);
  const before = text.slice(0, found.start).replace(/\s+$/, '');
  const after = text.slice(found.end).replace(/^\s+/, '');
  const rest = before && after ? before + eol + eol + after : before ? before + eol : after;
  const normalize = (value: string) => value.replace(/\r\n/g, '\n').trim();
  if (!normalize(rest) || normalize(rest) === normalize(boilerplate)) return null;
  return rest;
}
