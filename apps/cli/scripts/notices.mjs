import { readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function writeNotices() {
  const seen = new Map();
  const missingLicenses = [];
  async function dependency(name, from) {
    for (const base of createRequire(from).resolve.paths(name) ?? []) {
      const path = join(base, name, 'package.json');
      try { return await realpath(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    throw new Error(`Missing runtime dependency: ${name}`);
  }
  async function visit(path) {
    path = await realpath(path);
    const pkg = JSON.parse(await readFile(path, 'utf8'));
    const key = `${pkg.name}@${pkg.version}`;
    if (seen.has(key)) return;
    seen.set(key, null);
    if (!pkg.name.startsWith('@gitifact/')) {
      const names = (await readdir(dirname(path))).filter(name => /^(licen[sc]e|notice)(\.|$)/i.test(name)).sort();
      const texts = await Promise.all(names.map(name => readFile(join(dirname(path), name), 'utf8')));
      if (!texts.length && ['@astryxdesign/core@0.6.0', '@astryxdesign/theme-neutral@0.6.0'].includes(key)) {
        texts.push(await readFile(new URL('../licenses/astryx-LICENSE', import.meta.url), 'utf8'));
      }
      if (!texts.length && key === '@stylexjs/stylex@0.19.0') texts.push(await readFile(new URL('../licenses/stylex-LICENSE', import.meta.url), 'utf8'));
      if (!texts.length && key === '@hugeicons/core-free-icons@4.3.0') texts.push(await readFile(new URL('../licenses/hugeicons-LICENSE', import.meta.url), 'utf8'));
      // mermaid's fastdom and strictdom keep their MIT text in the README instead of a license file; the copies
      // under licenses/ are that section, extracted from the installed packages.
      if (!texts.length && key === 'fastdom@1.0.12') texts.push(await readFile(new URL('../licenses/fastdom-LICENSE', import.meta.url), 'utf8'));
      if (!texts.length && key === 'strictdom@1.0.1') texts.push(await readFile(new URL('../licenses/strictdom-LICENSE', import.meta.url), 'utf8'));
      // Pretendard keeps its OFL text under dist/ rather than at the package root.
      if (!texts.length && key === 'pretendard@1.3.9') texts.push(await readFile(new URL('../licenses/pretendard-LICENSE', import.meta.url), 'utf8'));
      if (!texts.length) missingLicenses.push(key);
      seen.set(key, `${key} (${typeof pkg.license === 'string' ? pkg.license : 'see license text'})\n\n${texts.join('\n\n')}`);
    }
    for (const name of Object.keys(pkg.dependencies ?? {})) await visit(await dependency(name, path));
  }
  await visit(fileURLToPath(new URL('../../browser/package.json', import.meta.url)));
  const cli = fileURLToPath(new URL('../package.json', import.meta.url));
  await visit(await dependency('commander', cli));
  await visit(await dependency('@gitifact/contracts', cli));
  if (missingLicenses.length) throw new Error(`Missing license texts: ${missingLicenses.join(', ')}`);
  const notices = [...seen.entries()].filter(([, text]) => text).sort(([a], [b]) => a.localeCompare(b));
  await writeFile(new URL('../dist/THIRD_PARTY_NOTICES.txt', import.meta.url),
    'License notices for runtime dependencies used by the CLI and browser. Bundling may remove unused portions.\n\n' + notices.map(([, text]) => text).join('\n\n-----\n\n'));
  await writeFile(new URL('../LICENSE', import.meta.url), await readFile(new URL('../../../LICENSE', import.meta.url)));
}
