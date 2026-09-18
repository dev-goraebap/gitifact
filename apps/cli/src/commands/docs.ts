import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { OVERRIDES_DIR } from '@gitifact/core';
import { defaultLanguage, t, type Language } from '../shared/i18n/index.js';

export const docTopics = ['workflow', 'spec', 'design', 'wiki', 'commit'] as const;
export type DocTopic = typeof docTopics[number];
// Every topic ships as two bundled files: `<topic>.md` states the format the CLI enforces and is always printed;
// `<topic>.default.md` is the operating guidance a project may replace with `.gitifact/overrides/<topic>.md`.
export interface DocsControls { readDoc?: (name: string, lang: Language) => Promise<string>; cwd?: string }
export const isDocTopic = (value: string): value is DocTopic => (docTopics as readonly string[]).includes(value);
// Bundled Markdown ships next to the built entry point as dist/i18n/<lang>/docs/<name>.md.
const readBundled = (name: string, lang: Language) => readFile(new URL('./i18n/' + lang + '/docs/' + name + '.md', import.meta.url), 'utf8');
const info = (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
export function listDocTopics(lang: Language = defaultLanguage) {
  const width = Math.max(...docTopics.map(topic => topic.length));
  return docTopics.map(topic => topic.padEnd(width) + '  ' + t(`docs.summary.${topic}`, {}, lang)).join('\n') + '\n';
}
/** The nearest ancestor holding `.gitifact/config.json`; docs also works outside a project, where nothing is overridden. */
export async function findProjectRoot(cwd: string): Promise<string | undefined> {
  for (let dir = cwd; ; dir = dirname(dir)) {
    if ((await info(join(dir, '.gitifact', 'config.json')))?.isFile()) return dir;
    if (dirname(dir) === dir) return undefined;
  }
}
export const overridePath = (topic: DocTopic) => OVERRIDES_DIR + '/' + topic + '.md';
/** The override text when the project has a non-empty one; an empty file is ignored and `spec working` warns about it. */
async function readOverride(root: string | undefined, topic: DocTopic) {
  if (!root) return undefined;
  const path = join(root, ...overridePath(topic).split('/'));
  const stat = await info(path); if (!stat?.isFile() || stat.size > 256 * 1024) return undefined;
  const text = await readFile(path, 'utf8');
  return text.trim() ? text : undefined;
}
export async function renderDoc(topic: DocTopic, controls: DocsControls = {}, lang: Language = defaultLanguage) {
  const read = controls.readDoc ?? readBundled;
  const guidance = (await readOverride(await findProjectRoot(controls.cwd ?? process.cwd()), topic)) ?? await read(topic + '.default', lang);
  return (await read(topic, lang)).trimEnd() + '\n\n' + guidance.trimEnd() + '\n';
}
const failure = (code: string, message: string) => { process.stderr.write(JSON.stringify({ contract: 'docs', version: 1, ok: false, error: { code, message } }) + '\n'); process.exitCode = 1; };
export async function runDocs(topic: string | undefined, options: { eject?: boolean } = {}, controls: DocsControls = {}) {
  if (topic === undefined) { if (options.eject) return failure('TOPIC_REQUIRED', t('docs.ejectNeedsTopic')); process.stdout.write(listDocTopics()); return; }
  if (!isDocTopic(topic)) return failure('UNKNOWN_TOPIC', t('docs.unknownTopic', { topic, topics: docTopics.join(', ') }));
  if (!options.eject) { process.stdout.write(await renderDoc(topic, controls)); return; }
  // Eject copies the bundled guidance into the project so it can be edited; from then on that file is what `docs` prints.
  const root = await findProjectRoot(controls.cwd ?? process.cwd());
  if (!root) return failure('NOT_INITIALIZED', t('docs.notInitialized'));
  const relative = overridePath(topic); const target = join(root, ...relative.split('/'));
  if (await info(target)) return failure('OVERRIDE_EXISTS', t('docs.overrideExists', { path: relative }));
  const body = await (controls.readDoc ?? readBundled)(topic + '.default', defaultLanguage);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, '<!-- ' + t('docs.overrideHeader', { topic }) + ' -->\n\n' + body.trimEnd() + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ contract: 'docs', version: 1, ok: true, topic, ejected: relative }) + '\n');
}
