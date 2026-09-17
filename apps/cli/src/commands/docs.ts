import { readFile } from 'node:fs/promises';
import { defaultLanguage, t, type Language } from '../shared/i18n/index.js';

export const docTopics = ['workflow', 'spec', 'design', 'product', 'commit'] as const;
export type DocTopic = typeof docTopics[number];
export interface DocsControls { readDoc?: (topic: DocTopic, lang: Language) => Promise<string> }
export const isDocTopic = (value: string): value is DocTopic => (docTopics as readonly string[]).includes(value);
// Bundled Markdown ships next to the built entry point as dist/i18n/<lang>/docs/<topic>.md.
const readBundled = (topic: DocTopic, lang: Language) => readFile(new URL('./i18n/' + lang + '/docs/' + topic + '.md', import.meta.url), 'utf8');
export function listDocTopics(lang: Language = defaultLanguage) {
  const width = Math.max(...docTopics.map(topic => topic.length));
  return docTopics.map(topic => topic.padEnd(width) + '  ' + t(`docs.summary.${topic}`, {}, lang)).join('\n') + '\n';
}
export async function runDocs(topic: string | undefined, controls: DocsControls = {}) {
  if (topic === undefined) { process.stdout.write(listDocTopics()); return; }
  if (!isDocTopic(topic)) {
    const failure = { contract: 'docs', version: 1, ok: false, error: { code: 'UNKNOWN_TOPIC', message: t('docs.unknownTopic', { topic, topics: docTopics.join(', ') }) } };
    process.stderr.write(JSON.stringify(failure) + '\n'); process.exitCode = 1; return;
  }
  process.stdout.write(await (controls.readDoc ?? readBundled)(topic, defaultLanguage));
}
