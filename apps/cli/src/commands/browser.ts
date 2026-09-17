import { InvalidArgumentError } from 'commander';
import { startBrowserServer } from '../server/browser-server.js';
import { t } from '../shared/i18n/index.js';

export function parsePort(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) > 65535) throw new InvalidArgumentError(t('browser.invalidPort'));
  return Number(value);
}
export async function runBrowser(options: { port: number; dev?: boolean }) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const server = await startBrowserServer({
      cwd: process.cwd(), port: options.port, dev: options.dev ?? false, signal: controller.signal,
    });
    if (!controller.signal.aborted) process.stdout.write(server.url + '/\n');
    await server.closed;
  } catch (error) {
    if (!controller.signal.aborted) {
      process.stderr.write((error instanceof Error ? error.message : t('browser.failed')) + '\n');
      process.exitCode = 1;
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}
