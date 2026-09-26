import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, InstructionFile, SpecInstruction } from '@gitifact/contracts';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Text } from '@astryxdesign/core/Text';
import { instructionFileOptions } from '../../../entities/project';
import { DocumentBody } from '../../../shared/ui/document';
import { RequestState } from '../../../shared/ui/request-state';
import { t, useLanguage } from '../../../shared/i18n';

// Code block languages by file extension; anything else is shown as plain text.
const languages: Record<string, string> = { sh: 'bash', bash: 'bash', js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', tsx: 'tsx', jsx: 'jsx',
  py: 'python', json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', css: 'css', html: 'html', sql: 'sql', ps1: 'powershell' };

const withoutFrontmatter = (text: string) => text.replace(/^---\r?\n(?:.*\r?\n)*?---(?:\r?\n|$)/, '');

/**
 * One file of the instruction folder, read when opened: Markdown as a document whose links resolve from that file,
 * other text as code, and a binary or oversized file as a line saying why it is not shown.
 */
export function InstructionFileView({ session, instruction, file }: { session: BrowserSessionV3; instruction: SpecInstruction; file: InstructionFile }) {
  useLanguage();
  // Moving to another file keeps the one on screen until the next arrives, instead of shrinking to a skeleton.
  const query = useQuery({ ...instructionFileOptions(session, instruction.id, file.path, file.size), placeholderData: keepPreviousData });
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!query.data) return <RequestState/>;
  // While the next file is read the previous one stays, drawn by its own path.
  const { text, binary, path } = query.data;
  if (text === null) return <Text color="secondary">{binary ? t('instructions.binary') : t('instructions.tooLarge')}</Text>;
  const extension = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
  // A reference file's frontmatter is its title and description, shown above; the document is what follows.
  if (extension === 'md') return <DocumentBody path={instruction.path.slice(0, -'index.md'.length) + path}>{withoutFrontmatter(text)}</DocumentBody>;
  return <CodeBlock code={text} language={languages[extension] ?? 'plaintext'} width="100%"/>;
}
