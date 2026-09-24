import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, InstructionFile, SpecInstruction } from '@gitifact/contracts';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { instructionFileOptions } from '../../../entities/project';
import { DocumentBody } from '../../../shared/ui/document';
import { RequestState } from '../../../shared/ui/request-state';
import { t, useLanguage } from '../../../shared/i18n';

// Code block languages by file extension; anything else is shown as plain text.
const languages: Record<string, string> = { sh: 'bash', bash: 'bash', js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', tsx: 'tsx', jsx: 'jsx',
  py: 'python', json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', css: 'css', html: 'html', sql: 'sql', ps1: 'powershell' };

/**
 * One file of the instruction folder, read when opened: Markdown as a document whose links resolve from that file,
 * other text as code, and a binary or oversized file as a line saying why it is not shown.
 */
export function InstructionFileView({ session, instruction, file }: { session: BrowserSessionV3; instruction: SpecInstruction; file: InstructionFile }) {
  useLanguage();
  const query = useQuery(instructionFileOptions(session, instruction.id, file.path, file.size));
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!query.data) return <VStack gap={2} role="status" aria-label={t('request.loadingProject')} aria-busy="true">
    <Skeleton width="60%" height="var(--spacing-4)"/><Skeleton width="80%" height="var(--spacing-4)"/><Skeleton width="40%" height="var(--spacing-4)"/>
  </VStack>;
  const { text, binary } = query.data;
  if (text === null) return <Text color="secondary">{binary ? t('instructions.binary') : t('instructions.tooLarge')}</Text>;
  const extension = file.path.includes('.') ? file.path.slice(file.path.lastIndexOf('.') + 1).toLowerCase() : '';
  if (extension === 'md') return <DocumentBody path={instruction.path.slice(0, -'index.md'.length) + file.path}>{text}</DocumentBody>;
  return <CodeBlock code={text} language={languages[extension] ?? 'plaintext'} width="100%"/>;
}
