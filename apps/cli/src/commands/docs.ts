import { lstat, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { WIKI_ENTRY_PATH } from '@gitifact/core';
import { getLanguage, t, type Language } from '../shared/i18n/index.js';

export const docTopics = ['workflow', 'spec', 'design', 'wiki', 'writing', 'commit'] as const;
export type DocTopic = typeof docTopics[number];
// Every topic ships as `<topic>.md`. The wiki topic is followed by the project's own operating policy, which is the body
// of `.gitifact/wiki/README.md`; `wiki.default.md` is the bundled policy used when there is no README and the template
// `init` writes it from.
export interface DocsControls { readDoc?: (name: string, lang: Language) => Promise<string>; cwd?: string }
export const isDocTopic = (value: string): value is DocTopic => (docTopics as readonly string[]).includes(value);
// Bundled Markdown ships next to the built entry point as dist/i18n/<lang>/docs/<name>.md.
export const readBundledDoc = (name: string, lang: Language) => readFile(new URL('./i18n/' + lang + '/docs/' + name + '.md', import.meta.url), 'utf8');
const info = (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
export function listDocTopics(lang: Language = getLanguage()) {
  const width = Math.max(...docTopics.map(topic => topic.length));
  return docTopics.map(topic => topic.padEnd(width) + '  ' + t(`docs.summary.${topic}`, {}, lang)).join('\n') + '\n';
}
/** The nearest ancestor holding `.gitifact/config.json`; docs also works outside a project, where the bundled policy applies. */
export async function findProjectRoot(cwd: string): Promise<string | undefined> {
  for (let dir = cwd; ; dir = dirname(dir)) {
    if ((await info(join(dir, '.gitifact', 'config.json')))?.isFile()) return dir;
    if (dirname(dir) === dir) return undefined;
  }
}
/** The README body without frontmatter and title, its headings one level down so they sit under the policy heading. */
async function readWikiPolicy(root: string | undefined) {
  if (!root) return undefined;
  const path = join(root, ...WIKI_ENTRY_PATH.split('/'));
  const stat = await info(path); if (!stat?.isFile() || stat.size > 1024 * 1024) return undefined;
  const lines = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n').split('\n');
  if (lines[0] === '---') { const end = lines.indexOf('---', 1); if (end > 0) lines.splice(0, end + 1); }
  while (lines.length && !lines[0]!.trim()) lines.shift();
  if (lines[0]?.startsWith('# ')) lines.shift();
  let fence = false;
  const body = lines.map(line => {
    if (/^ {0,3}(`{3,}|~{3,})/.test(line)) fence = !fence;
    return !fence && /^#{1,5} /.test(line) ? '#' + line : line;
  }).join('\n').trim();
  return body || undefined;
}
export async function renderDoc(topic: DocTopic, controls: DocsControls = {}, lang: Language = getLanguage()) {
  const read = controls.readDoc ?? readBundledDoc;
  const format = (await read(topic, lang)).trimEnd();
  if (topic !== 'wiki') return format + '\n';
  const own = await readWikiPolicy(await findProjectRoot(controls.cwd ?? process.cwd()));
  const policy = own ?? (await read('wiki.default', lang)).trim().replace(/^(#{1,5}) /gm, '#$1 ');
  const heading = own ? t('docs.wikiPolicyProject', {}, lang) : t('docs.wikiPolicyDefault', {}, lang);
  return format + '\n\n## ' + heading + '\n\n' + policy + '\n';
}
export async function runDocs(topic: string | undefined, controls: DocsControls = {}) {
  if (topic === undefined) { process.stdout.write(listDocTopics()); return; }
  if (!isDocTopic(topic)) {
    const failure = { contract: 'docs', version: 1, ok: false, error: { code: 'UNKNOWN_TOPIC', message: t('docs.unknownTopic', { topic, topics: docTopics.join(', ') }) } };
    process.stderr.write(JSON.stringify(failure) + '\n'); process.exitCode = 1; return;
  }
  process.stdout.write(await renderDoc(topic, controls));
}
