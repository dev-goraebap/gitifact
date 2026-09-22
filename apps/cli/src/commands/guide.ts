import { lstat, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseFrontmatterBlock, WIKI_ENTRY_PATH } from '@gitifact/core';
import { getLanguage, t, type Language } from '../shared/i18n/index.js';
import { CommandError, runCommand, text, type Format } from './output.js';

export const guideTopics = ['workflow', 'spec', 'design', 'wiki', 'writing', 'commit'] as const;
export type GuideTopic = typeof guideTopics[number];
// Every topic ships as `<topic>.md` with a `title` and `description` in its frontmatter; the file name is the topic.
// The wiki topic is followed by the project's own operating policy, which is the body of `.gitifact/wiki/README.md`;
// `wiki.default.md` is the bundled policy used when there is no README and the template `init` writes it from.
export interface GuideControls { readGuide?: (name: string, lang: Language) => Promise<string>; cwd?: string }
export const isGuideTopic = (value: string): value is GuideTopic => (guideTopics as readonly string[]).includes(value);
// Bundled Markdown ships next to the built entry point as dist/i18n/<lang>/docs/<name>.md.
export const readBundledGuide = (name: string, lang: Language) => readFile(new URL('./i18n/' + lang + '/docs/' + name + '.md', import.meta.url), 'utf8');
const info = (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });

/** The `title` and `description` of a guide file. */
export function guideSummary(source: string) {
  const { fields } = parseFrontmatterBlock(source.replace(/\r\n/g, '\n'), 'guide');
  const value = (key: string) => { const field = fields.get(key); return field?.type === 'scalar' ? field.value : ''; };
  return { title: value('title'), description: value('description') };
}
/** The nearest ancestor holding `.gitifact/config.json`; guides also work outside a project, where the bundled policy applies. */
export async function findProjectRoot(cwd: string): Promise<string | undefined> {
  for (let dir = cwd; ; dir = dirname(dir)) {
    if ((await info(join(dir, '.gitifact', 'config.json')))?.isFile()) return dir;
    if (dirname(dir) === dir) return undefined;
  }
}
/** The README body without frontmatter, its headings one level down so they sit under the policy heading. */
async function readWikiPolicy(root: string | undefined) {
  if (!root) return undefined;
  const path = join(root, ...WIKI_ENTRY_PATH.split('/'));
  const stat = await info(path); if (!stat?.isFile() || stat.size > 1024 * 1024) return undefined;
  const lines = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n').split('\n');
  if (lines[0] === '---') { const end = lines.indexOf('---', 1); if (end > 0) lines.splice(0, end + 1); }
  while (lines.length && !lines[0]!.trim()) lines.shift();
  // Pages written before the title moved to frontmatter still start with it.
  if (lines[0]?.startsWith('# ')) lines.shift();
  let fence = false;
  const body = lines.map(line => {
    if (/^ {0,3}(`{3,}|~{3,})/.test(line)) fence = !fence;
    return !fence && /^#{1,5} /.test(line) ? '#' + line : line;
  }).join('\n').trim();
  return body || undefined;
}
/** A guide file as shipped; the wiki guide is followed by the project's operating policy, or the bundled one. */
export async function renderGuide(topic: GuideTopic, controls: GuideControls = {}, lang: Language = getLanguage()) {
  const read = controls.readGuide ?? readBundledGuide;
  const format = (await read(topic, lang)).trimEnd();
  if (topic !== 'wiki') return format + '\n';
  const own = await readWikiPolicy(await findProjectRoot(controls.cwd ?? process.cwd()));
  const policy = own ?? (await read('wiki.default', lang)).trim().replace(/^(#{1,5}) /gm, '#$1 ');
  const heading = own ? t('guide.wikiPolicyProject', {}, lang) : t('guide.wikiPolicyDefault', {}, lang);
  return format + '\n\n## ' + heading + '\n\n' + policy + '\n';
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
