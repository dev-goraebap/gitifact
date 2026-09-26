import { explicitLanguage, getLanguage, type Language } from '../shared/i18n/index.js';
import { managedRead, managedWrite } from '../adapters/filesystem/managed-file.js';
import { agentPresets, boilerplateFor, candidatePaths, claudeWrapperFor, CLAUDE_WRAPPER_PATH, findBlock, injectBlock, isGeneratedClaudeWrapper, isWrapperFile, lacksClaudeFile, legacyBlockLanguage, removeBlock, renderAgentBlock, resolveAgentPaths, type AgentBlockControls, type AgentPreset, type CandidatePath } from './agent-block.js';

// version: the running release, which init and update write to the config as `cli`. language: the config's block language.
export interface AgentDocsOptions extends AgentBlockControls { version: string; agent?: AgentPreset | undefined; remove?: boolean | undefined; skip?: boolean | undefined;
  // update: rewrite only files that already carry a block and never create one.
  onlyExisting?: boolean | undefined; language?: Language | undefined }
export interface AgentDocsWrite { path: CandidatePath; previous: string | null; next: string | null }
// missing: files init would add but this plan does not write (only an onlyExisting plan reports them).
// language: the one language every block is written in, which the caller keeps in the config.
export interface AgentDocsPlan { mode: 'install' | 'remove' | 'skip'; paths: CandidatePath[]; writes: AgentDocsWrite[]; missing: CandidatePath[]; language: Language }
export const skippedAgentDocs = (language: Language = explicitLanguage() ?? getLanguage()): AgentDocsPlan =>
  ({ mode: 'skip', paths: [], writes: [], missing: [], language });

// Malformed markers are refused by the plan itself; while choosing the language they only mean none can be read.
const blockOf = (text: string) => { try { const found = findBlock(text); return found ? text.slice(found.start, found.end) : undefined; } catch { return undefined; } };

// Reads every candidate file and decides the writes without touching the filesystem, so malformed
// markers are refused before init publishes anything.
export async function planAgentDocs(root: string, options: AgentDocsOptions): Promise<AgentDocsPlan> {
  if (options.skip) return skippedAgentDocs(explicitLanguage() ?? options.language ?? getLanguage());
  const existing = new Map<CandidatePath, string>();
  for (const path of candidatePaths) {
    const text = await managedRead(root, path);
    if (text !== null) existing.set(path, text);
  }
  // --lang first, then the config. A project from before 0.8.3 has neither and keeps the language its blocks were written in.
  const language = explicitLanguage() ?? options.language
    ?? [...existing.values()].map(text => { const block = blockOf(text); return block === undefined ? undefined : legacyBlockLanguage(block); }).find(Boolean)
    ?? getLanguage();
  const writes: AgentDocsWrite[] = [];
  const paths: CandidatePath[] = [];
  if (options.remove) {
    const scope = options.agent && options.agent !== 'all' ? agentPresets[options.agent] : candidatePaths;
    for (const path of scope) {
      const text = existing.get(path);
      if (text === undefined || !findBlock(text)) continue;
      paths.push(path);
      writes.push({ path, previous: text, next: removeBlock(text, boilerplateFor(path)) });
    }
    // The wrapper init added would import a file that no longer exists.
    const wrapper = existing.get(CLAUDE_WRAPPER_PATH);
    if (writes.some(write => write.path === 'AGENTS.md' && write.next === null) && wrapper !== undefined && isGeneratedClaudeWrapper(wrapper)) {
      paths.push(CLAUDE_WRAPPER_PATH);
      writes.push({ path: CLAUDE_WRAPPER_PATH, previous: wrapper, next: null });
    }
    return { mode: 'remove', paths, writes, missing: [], language };
  }
  let block: string | undefined;
  const blockFor = async () => block ??= await renderAgentBlock(options, language);
  const { inject, create } = options.onlyExisting
    ? { inject: candidatePaths.filter(path => existing.has(path) && findBlock(existing.get(path)!) && !isWrapperFile(existing.get(path)!)), create: null }
    : resolveAgentPaths(options.agent, existing);
  for (const path of inject) {
    const previous = existing.get(path)!;
    const next = injectBlock(previous, await blockFor(), boilerplateFor(path));
    paths.push(path);
    if (next !== previous) writes.push({ path, previous, next });
  }
  if (create) {
    paths.push(create);
    writes.push({ path: create, previous: null, next: injectBlock(null, await blockFor(), boilerplateFor(create)) });
  }
  const missing: CandidatePath[] = [];
  if (paths.includes('AGENTS.md') && lacksClaudeFile(existing)) {
    if (options.onlyExisting) missing.push(CLAUDE_WRAPPER_PATH);
    else {
      paths.push(CLAUDE_WRAPPER_PATH);
      writes.push({ path: CLAUDE_WRAPPER_PATH, previous: null, next: claudeWrapperFor(existing.get('AGENTS.md') ?? null) });
    }
  }
  // An earlier run may have expanded the block inside a wrapper that only imports another file; take it back out.
  for (const [path, text] of existing) {
    if (paths.includes(path) || !isWrapperFile(text) || !findBlock(text)) continue;
    writes.push({ path, previous: text, next: removeBlock(text, boilerplateFor(path)) });
  }
  return { mode: 'install', paths, writes, missing, language };
}
export async function applyAgentDocs(root: string, plan: AgentDocsPlan, recheck: () => Promise<void>) {
  for (const write of plan.writes) await managedWrite(root, write.path, write.previous, write.next, recheck);
  return plan.writes.map(write => write.path);
}
