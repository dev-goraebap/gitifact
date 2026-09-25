import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, CommitFile } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { commitFileOptions } from '../../../entities/project';
import { LineDiff, languageOf } from '../../../widgets/diff-view';
import { t, useLanguage } from '../../../shared/i18n';

/** One source file's two sides in a commit, read when the file is shown. */
export function FileDiff({ session, commit, file }: { session: BrowserSessionV3; commit: string; file: CommitFile }) {
  useLanguage();
  const query = useQuery(commitFileOptions(session, commit, file.path));
  if (query.error) return <Text type="supporting" color="secondary" role="alert">{t('source.fileFailed')}</Text>;
  if (!query.data) return <VStack gap={2} role="status" aria-label={t('source.fileLoading')}>
    {[92, 86, 74].map((w, i) => <Skeleton key={i} index={i} width={`${w}%`} height="var(--spacing-4)"/>)}
  </VStack>;
  if (query.data.binary) return <Text type="supporting" color="secondary">{t('source.binary')}</Text>;
  if (query.data.tooLarge) return <Text type="supporting" color="secondary">{t('source.tooLarge')}</Text>;
  return <LineDiff before={query.data.before} after={query.data.after} label={t('source.fileDiff', { path: file.path })} language={languageOf(file.path)}/>;
}
