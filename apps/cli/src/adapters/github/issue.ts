import { spawn } from 'node:child_process';

/** The repository feedback goes to: Gitifact's own. */
export const FEEDBACK_REPOSITORY = 'dev-goraebap/gitifact';
/** A new-issue address longer than this is cut by browsers and GitHub, so the body is shortened to fit. */
export const ISSUE_URL_LIMIT = 8000;

export interface GhResult { code: number | null; stdout: string; stderr: string }
/** Runs `gh` with arguments, never through a shell; undefined when there is no `gh` to run. */
export type GhRunner = (args: readonly string[], options: { input?: string; timeoutMs: number }) => Promise<GhResult | undefined>;

export const runGh: GhRunner = (args, { input, timeoutMs }) => new Promise(resolve => {
  let child;
  try { child = spawn('gh', [...args], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch { resolve(undefined); return; }
  const stdout: Buffer[] = []; const stderr: Buffer[] = [];
  const timer = setTimeout(() => child.kill(), timeoutMs);
  child.stdout.on('data', chunk => stdout.push(chunk));
  child.stderr.on('data', chunk => stderr.push(chunk));
  child.stdin.on('error', () => { /* A gh that exits early reports through its exit code. */ });
  child.once('error', () => { clearTimeout(timer); resolve(undefined); });
  child.once('close', code => {
    clearTimeout(timer);
    resolve({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
  });
  child.stdin.end(input ?? '');
});

/** Whether `gh` is installed and signed in to github.com. */
export async function ghSignedIn(run: GhRunner): Promise<boolean> {
  const result = await run(['auth', 'status', '--hostname', 'github.com'], { timeoutMs: 10000 });
  return result?.code === 0;
}

/** Creates the issue under the user's own account; the issue address, or undefined when gh failed. */
export async function createIssue(run: GhRunner, title: string, body: string): Promise<string | undefined> {
  const result = await run(['issue', 'create', '--repo', FEEDBACK_REPOSITORY, '--title', title, '--body-file', '-'], { input: body, timeoutMs: 60000 });
  if (result?.code !== 0) return undefined;
  return result.stdout.trim().split('\n').reverse().find(line => /^https:\/\/github\.com\//.test(line.trim()))?.trim();
}

/**
 * The new-issue page with the title and body filled in, for the user to submit in a browser. A body too long for the
 * address is cut at a character boundary until the address fits; `truncated` says so.
 */
export function newIssueUrl(title: string, body: string, marker: string): { url: string; truncated: boolean } {
  const address = (text: string) => `https://github.com/${FEEDBACK_REPOSITORY}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
  const whole = address(body);
  if (whole.length <= ISSUE_URL_LIMIT) return { url: whole, truncated: false };
  const characters = [...body];
  let low = 0, high = characters.length;
  // The longest prefix whose address fits, found by halving since encoded lengths vary per character.
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (address(characters.slice(0, middle).join('') + marker).length <= ISSUE_URL_LIMIT) low = middle; else high = middle - 1;
  }
  return { url: address(characters.slice(0, low).join('') + marker), truncated: true };
}
