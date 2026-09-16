import { managedRead, managedWrite } from '../adapters/filesystem/managed-file.js';
import { agentPresets, boilerplateFor, candidatePaths, findBlock, injectBlock, isWrapperFile, removeBlock, renderAgentBlock, resolveAgentPaths, type AgentPreset, type CandidatePath } from './agent-block.js';

export interface AgentDocsOptions { version: string; agent?: AgentPreset | undefined; remove?: boolean | undefined; skip?: boolean | undefined }
export interface AgentDocsWrite { path: CandidatePath; previous: string | null; next: string | null }
export interface AgentDocsPlan { mode: 'install' | 'remove' | 'skip'; paths: CandidatePath[]; writes: AgentDocsWrite[] }
export const skippedAgentDocs: AgentDocsPlan = { mode: 'skip', paths: [], writes: [] };

// Reads every candidate file and decides the writes without touching the filesystem, so malformed
// markers are refused before init publishes anything.
export async function planAgentDocs(root: string, options: AgentDocsOptions): Promise<AgentDocsPlan> {
  if (options.skip) return skippedAgentDocs;
  const existing = new Map<CandidatePath, string>();
  for (const path of candidatePaths) {
    const text = await managedRead(root, path);
    if (text !== null) existing.set(path, text);
  }
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
    return { mode: 'remove', paths, writes };
  }
  const block = renderAgentBlock(options.version);
  const { inject, create } = resolveAgentPaths(options.agent, existing);
  for (const path of inject) {
    const previous = existing.get(path)!;
    const next = injectBlock(previous, block, boilerplateFor(path));
    paths.push(path);
    if (next !== previous) writes.push({ path, previous, next });
  }
  if (create) {
    paths.push(create);
    writes.push({ path: create, previous: null, next: injectBlock(null, block, boilerplateFor(create)) });
  }
  // An earlier run may have expanded the block inside a wrapper that only imports another file; take it back out.
  for (const [path, text] of existing) {
    if (paths.includes(path) || !isWrapperFile(text) || !findBlock(text)) continue;
    writes.push({ path, previous: text, next: removeBlock(text, boilerplateFor(path)) });
  }
  return { mode: 'install', paths, writes };
}
export async function applyAgentDocs(root: string, plan: AgentDocsPlan, recheck: () => Promise<void>) {
  for (const write of plan.writes) await managedWrite(root, write.path, write.previous, write.next, recheck);
  return plan.writes.map(write => write.path);
}
