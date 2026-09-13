import { readFile, cp, rm } from 'node:fs/promises';
import { relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const browserSource = fileURLToPath(new URL('../../browser/dist/', import.meta.url));
const browserDestination = fileURLToPath(new URL('../dist/browser/', import.meta.url));
// Only replace this package's generated assets, and fail before removing them if the source is absent.
await readFile(join(browserSource, 'index.html'));
if (relative(packageRoot, browserDestination) !== join('dist', 'browser')) throw new Error('Unexpected browser asset destination');
await rm(browserDestination, { recursive: true, force: true });
await cp(browserSource, browserDestination, { recursive: true });
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
