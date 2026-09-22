import { InitError } from '@gitifact/core';
import { managedRead, managedWrite } from '../adapters/filesystem/managed-file.js';

/**
 * Every commit adds reason lines to the end of `.gitifact/history.jsonl`, so two branches that both commit always
 * touch the same place. `merge=union` keeps the lines of both sides instead of stopping at a conflict. Git has the
 * driver built in, so one line in `.gitattributes` is enough on every clone; init adds it and leaves a rule that is
 * already there alone.
 */
export const HISTORY_MERGE_RULE = '/.gitifact/history.jsonl merge=union';
const covered = (text: string) => text.split(/\r?\n/).some(line => /^\/?\.gitifact\/history\.jsonl\s(?:.*\s)?merge=union(?:\s|$)/.test(line.trim() + ' '));

export interface HistoryAttributesPlan { previous: string | null; next: string | null }
/** What init would write: nothing when the rule is present, otherwise the file with the rule appended in its own line endings. */
export async function planHistoryAttributes(root: string): Promise<HistoryAttributesPlan> {
  const previous = await managedRead(root, '.gitattributes');
  if (previous !== null && covered(previous)) return { previous, next: null };
  if (previous === null) return { previous, next: HISTORY_MERGE_RULE + '\n' };
  const eol = previous.includes('\r\n') ? '\r\n' : '\n';
  return { previous, next: previous + (previous === '' || previous.endsWith('\n') ? '' : eol) + HISTORY_MERGE_RULE + eol };
}
/**
 * Writes the rule. The file is read again first: a parallel init may have added the rule since the plan was made, and
 * then there is nothing left to do. The plan made at the start still refused a malformed path before any write.
 */
export async function applyHistoryAttributes(root: string, _plan: HistoryAttributesPlan, recheck: () => Promise<void>) {
  const fresh = await planHistoryAttributes(root);
  if (fresh.next === null) return;
  try { await managedWrite(root, '.gitattributes', fresh.previous, fresh.next, recheck); }
  catch (error) {
    // Refused because the file changed under the write: fine when what changed it was the same rule, from a parallel init.
    // The file may also appear between the read and the link that publishes a new one (EEXIST).
    const raced = (error instanceof InitError && error.code === 'INPUT_CHANGED') || (error as NodeJS.ErrnoException).code === 'EEXIST';
    if (raced && (await planHistoryAttributes(root)).next === null) return;
    throw error;
  }
}
