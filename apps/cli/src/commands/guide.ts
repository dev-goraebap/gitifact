import { readFile } from 'node:fs/promises';
import { parseFrontmatterBlock } from '@gitifact/core';
import { getLanguage, t, type Language } from '../shared/i18n/index.js';
import { CommandError, runCommand, text, type Format } from './output.js';

// `migrate` moves a 0.7 project to the 0.8.0 documents; it goes with the 0.7 history reader at 1.0.0.
export const guideTopics = ['workflow', 'spec', 'design', 'instructions', 'records', 'writing', 'commit', 'migrate'] as const;
export type GuideTopic = typeof guideTopics[number];
// Every topic ships as `<topic>.md` with a `title` and `description` in its frontmatter; the file name is the topic.
export interface GuideControls { readGuide?: (name: string, lang: Language) => Promise<string> }
export const isGuideTopic = (value: string): value is GuideTopic => (guideTopics as readonly string[]).includes(value);
// Bundled Markdown ships next to the built entry point as dist/i18n/<lang>/docs/<name>.md.
export const readBundledGuide = (name: string, lang: Language) => readFile(new URL('./i18n/' + lang + '/docs/' + name + '.md', import.meta.url), 'utf8');

/** The `title` and `description` of a guide file. */
export function guideSummary(source: string) {
  const { fields } = parseFrontmatterBlock(source.replace(/\r\n/g, '\n'), 'guide');
  const value = (key: string) => { const field = fields.get(key); return field?.type === 'scalar' ? field.value : ''; };
  return { title: value('title'), description: value('description') };
}
/** A guide file as shipped. */
export async function renderGuide(topic: GuideTopic, controls: GuideControls = {}, lang: Language = getLanguage()) {
  const read = controls.readGuide ?? readBundledGuide;
  return (await read(topic, lang)).trimEnd() + '\n';
}

/** `guide list`: each topic with the title and description from its frontmatter. */
export const runGuideList = (options: { format: Format }, controls: GuideControls = {}) => runCommand('guide', options.format, async () => {
  const read = controls.readGuide ?? readBundledGuide; const lang = getLanguage();
  const topics = await Promise.all(guideTopics.map(async name => ({ name, ...guideSummary(await read(name, lang)) })));
  const width = Math.max(...guideTopics.map(topic => topic.length));
  return { json: { topics }, text: text(topics.map(g => `${g.name.padEnd(width)}  ${g.title} — ${g.description}`)) };
});

/** `guide show <topic>`: the guide file itself, so the text an agent reads is the text Gitifact ships. */
export const runGuideShow = (topic: string, options: { format: Format }, controls: GuideControls = {}) => runCommand('guide', options.format, async () => {
  if (!isGuideTopic(topic)) throw new CommandError('UNKNOWN_TOPIC', t('guide.unknownTopic', { topic, topics: guideTopics.join(', ') }));
  const shown = await renderGuide(topic, controls);
  return { json: { topic, text: shown }, text: shown };
});
