import { readFile, cp, rm } from 'node:fs/promises';
import { relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';
import { writeNotices } from './notices.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const browserSource = fileURLToPath(new URL('../../browser/dist/', import.meta.url));
const browserDestination = fileURLToPath(new URL('../dist/browser/', import.meta.url));
// Only replace this package's generated assets, and fail before removing them if the source is absent.
await readFile(join(browserSource, 'index.html'));
if (relative(packageRoot, browserDestination) !== join('dist', 'browser')) throw new Error('Unexpected browser asset destination');
await rm(browserDestination, { recursive: true, force: true });
await cp(browserSource, browserDestination, { recursive: true });
const i18nSource = fileURLToPath(new URL('../src/shared/i18n/', import.meta.url));
const i18nDestination = fileURLToPath(new URL('../dist/i18n/', import.meta.url));
await readFile(join(i18nSource, 'ko', 'docs', 'workflow.md'));
if (relative(packageRoot, i18nDestination) !== join('dist', 'i18n')) throw new Error('Unexpected i18n asset destination');
await rm(i18nDestination, { recursive: true, force: true });
// Only the long-form Markdown ships as a file; messages.json is bundled into main.js by esbuild.
await cp(i18nSource, i18nDestination, { recursive: true, filter: source => !source.endsWith('.ts') && !source.endsWith('.json') });
await writeNotices();
const options = {
  absWorkingDir: packageRoot,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  banner: { js: '#!/usr/bin/env node' },
  define: { __CLI_VERSION__: JSON.stringify(version) },
  // Commander is CommonJS and may require Node built-ins from the ESM bundle.
  inject: [fileURLToPath(new URL('./node-require.mjs', import.meta.url))],
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const watcher = await context(options);
  await watcher.watch();
  const stop = async () => {
    await watcher.dispose();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} else {
  await build(options);
}
