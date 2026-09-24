import { readFile, stat } from 'node:fs/promises';
import { CommandError } from './output.js';
import { t } from '../shared/i18n/index.js';

const LIMIT = 1024 * 1024;

/** The JSON an agent hands a command with `--file`: a file path, or `-` for standard input. Up to 1 MB of UTF-8. */
export async function readJsonInput(file: string, stdin: AsyncIterable<Uint8Array> = process.stdin): Promise<unknown> {
  const bytes = file === '-' ? await readStdin(stdin) : await readInputFile(file);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new CommandError('INVALID_INPUT', t('input.json')); }
}

async function readInputFile(path: string) {
  const source = await stat(path).catch(() => undefined);
  if (!source?.isFile() || source.size > LIMIT) throw new CommandError('INVALID_INPUT', t('input.file'));
  return readFile(path);
}
async function readStdin(stream: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > LIMIT) throw new CommandError('INVALID_INPUT', t('input.size'));
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
