import { DocumentError, InitError, RepositoryReadError, StoreError } from '@gitifact/core';
import { withCommandScope } from '../adapters/git/command-scope.js';
import { t } from '../shared/i18n/index.js';

export type Format = 'text' | 'json';
export const formats: readonly Format[] = ['text', 'json'];

/** A refusal the command explains itself; `details` travel with the error in JSON, and as extra lines in text. */
export class CommandError extends Error {
  constructor(readonly code: string, message: string, readonly details: Record<string, unknown> = {}, readonly lines: string[] = []) { super(message); }
}

/** What a command prints: the JSON fields beside the envelope, the text form, and whether it ends with exit code 1. */
export interface CommandResult { json: Record<string, unknown>; text: string; failed?: boolean }

/**
 * Runs one `docs`, `changes` or `guide` command and prints its result. Text is the default and JSON carries
 * `{contract, version, ok}` like every other command. Errors go to stderr in the same format, with exit code 1.
 */
export async function runCommand(contract: 'docs' | 'changes' | 'guide', format: Format, run: () => Promise<CommandResult>): Promise<void> {
  const envelope = { contract, version: 1 };
  try {
    // One scope per command lets nested reads share the repository location instead of spawning Git again.
    const result = await withCommandScope(run);
    process.stdout.write(format === 'json' ? JSON.stringify({ ...envelope, ok: !result.failed, ...result.json }) + '\n' : result.text);
    if (result.failed) process.exitCode = 1;
  } catch (error) {
    const known = error instanceof CommandError || error instanceof StoreError || error instanceof RepositoryReadError
      || error instanceof InitError || error instanceof DocumentError;
    const code = known ? error.code : contract.toUpperCase() + '_FAILED';
    const message = known ? error.message : t('command.failed');
    const details = error instanceof CommandError ? error.details : {};
    const lines = error instanceof CommandError ? error.lines : [];
    process.stderr.write(format === 'json' ? JSON.stringify({ ...envelope, ok: false, error: { code, message, ...details } }) + '\n'
      : [code + ': ' + message, ...lines].join('\n') + '\n');
    process.exitCode = 1;
  }
}

/** One line per item under a label, or nothing when the list is empty. */
export const section = (label: string, lines: string[], indent = '  ') => lines.length ? [label, ...lines.map(line => indent + line)] : [];
export const text = (lines: string[]) => lines.join('\n') + '\n';
