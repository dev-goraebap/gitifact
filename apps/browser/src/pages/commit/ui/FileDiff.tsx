import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, CommitFile } from '@gitifact/contracts';
import { Text } from '@astryxdesign/core/Text';
import { commitFileOptions } from '../../../entities/project';
import { LineDiff, languageOf } from '../../../widgets/diff-view';
import { InlineLoader, RequestState } from '../../../shared/ui/request-state';
import { t, useLanguage } from '../../../shared/i18n';

/** One source file's two sides in a commit, read when the file is shown. */
export function FileDiff({ session, commit, file }: { session: BrowserSessionV3; commit: string; file: CommitFile }) {
  useLanguage();
  const query = useQuery(commitFileOptions(session, commit, file.path));
  if (query.error) return <Text type="supporting" color="secondary" role="alert">{t('source.fileFailed')}</Text>;
  if (!query.data) return <RequestState placeholder={<InlineLoader label={t('source.fileLoading')}/>}/>;
  if (query.data.binary) return <Text type="supporting" color="secondary">{t('source.binary')}</Text>;
  if (query.data.tooLarge) return <Text type="supporting" color="secondary">{t('source.tooLarge')}</Text>;
  return <LineDiff before={query.data.before} after={query.data.after} label={t('source.fileDiff', { path: file.path })} language={languageOf(file.path)}/>;
}
