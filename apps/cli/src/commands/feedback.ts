import { release } from 'node:os';
import { createIssue, ghSignedIn, newIssueUrl, runGh, type GhRunner } from '../adapters/github/issue.js';
import { readJsonInput } from './input.js';
import { CommandError, runCommand, text, type Format } from './output.js';
import { findProjectConfig } from '../shared/project-config.js';
import { t } from '../shared/i18n/index.js';

const types = ['bug', 'idea'] as const;
export interface Feedback { type: typeof types[number]; title: string; body: string }

/** The input an agent wrote after the user confirmed the draft: exactly a type, a one-line title and a body. */
export function parseFeedback(input: unknown): Feedback {
  const invalid = () => new CommandError('INVALID_INPUT', t('feedback.invalid'));
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw invalid();
  const { type, title, body, ...rest } = input as Record<string, unknown>;
  if (Object.keys(rest).length || !types.includes(type as Feedback['type'])) throw invalid();
  if (typeof title !== 'string' || !title.trim() || /[\r\n]/.test(title) || [...title].length > 200) throw invalid();
  if (typeof body !== 'string' || !body.trim() || [...body].length > 20000) throw invalid();
  return { type: type as Feedback['type'], title: title.trim(), body: body.trim() };
}

/** The project's storage version, from the nearest `.gitifact/config.json` above the folder, or none. */
async function schemaVersion(from: string): Promise<string> {
  const config = (await findProjectConfig(from))?.text;
  if (config === undefined) return 'none';
  try { const value = (JSON.parse(config) as { schemaVersion?: unknown }).schemaVersion; return typeof value === 'number' ? String(value) : 'none'; }
  catch { return 'none'; }
}

/** The body as sent: the user's text, then what helps reproduce it. Nothing from the project's files goes in. */
export async function issueBody(feedback: Feedback, version: string, cwd: string): Promise<string> {
  return [feedback.body, '', '---', `- Type: ${feedback.type}`, `- Gitifact: ${version}`, `- OS: ${process.platform} ${release()}`,
    `- Node: ${process.version}`, `- schemaVersion: ${await schemaVersion(cwd)}`].join('\n') + '\n';
}

/**
 * Sends one issue to the Gitifact repository: through the user's own `gh` when it is signed in, otherwise as a
 * new-issue address the user submits in a browser. A dry run checks `gh` and sends nothing.
 */
export async function sendFeedback(feedback: Feedback, body: string, dryRun: boolean, run: GhRunner = runGh) {
  const signedIn = await ghSignedIn(run);
  const page = () => newIssueUrl(feedback.title, body, '\n\n' + t('feedback.cut'));
  if (dryRun) return { dryRun: true, method: signedIn ? 'gh' as const : 'url' as const, ...(signedIn ? { url: null, truncated: false } : page()), ghFailed: false };
  const created = signedIn ? await createIssue(run, feedback.title, body) : undefined;
  if (created) return { dryRun: false, method: 'gh' as const, url: created, truncated: false, ghFailed: false };
  return { dryRun: false, method: 'url' as const, ...page(), ghFailed: signedIn };
}

/** `feedback --file`: reads the confirmed draft and sends it, or with `--dry-run` shows what would be sent. */
export const runFeedback = (options: { format: Format; file: string; dryRun?: boolean }, version: string, run?: GhRunner) => runCommand('feedback', options.format, async () => {
  const feedback = parseFeedback(await readJsonInput(options.file));
  const body = await issueBody(feedback, version, process.cwd());
  const sent = await sendFeedback(feedback, body, !!options.dryRun, run);
  const headline = sent.dryRun ? (sent.method === 'gh' ? t('feedback.dryRunGh') : t('feedback.dryRunUrl'))
    : sent.method === 'gh' ? t('feedback.created', { url: sent.url! }) : sent.ghFailed ? t('feedback.ghFailed') : t('feedback.openUrl');
  const out = [headline,
  ...(sent.method === 'url' ? [sent.url!] : []),
  ...(sent.truncated ? [t('feedback.truncated')] : []),
  ...(sent.dryRun || sent.truncated ? ['', t('feedback.title', { title: feedback.title }), body.replace(/\n$/, '')] : [])];
  return { json: { ...sent, title: feedback.title, body }, text: text(out) };
});
