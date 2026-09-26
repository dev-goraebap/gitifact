import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, CommitFile } from '@gitifact/contracts';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { commitFileOptions, commitFilesOptions } from '../../../entities/project';
import { FileDiff } from './FileDiff';
import { SplitReader } from './SplitReader';
import { LoadMore } from '../../../shared/ui/load-more';
import { InlineLoader, RequestState } from '../../../shared/ui/request-state';
import styles from './commit.module.css';
import { t, useLanguage } from '../../../shared/i18n';

const colors = { added: 'green', modified: 'blue', deleted: 'red', renamed: 'purple' } as const;
const letters = { added: 'A', modified: 'M', deleted: 'D', renamed: 'R' } as const;
const names = () => ({ added: t('source.added'), modified: t('source.modified'), deleted: t('source.deleted'), renamed: t('source.renamed') });
const split = (path: string) => { const at = path.lastIndexOf('/'); return at < 0 ? { name: path, folder: '' } : { name: path.slice(at + 1), folder: path.slice(0, at) }; };

/**
 * The source files a commit changed, twenty at a time: each with how it changed and how many lines, and the chosen
 * one's diff. The first file opens when none is named. Documents are left out, being the documents tab.
 */
export function CommitCode({ session, commit, file, href }: { session: BrowserSessionV3; commit: string; file: string | undefined; href: (path: string) => string }) {
  useLanguage();
  const query = useInfiniteQuery(commitFilesOptions(session, commit));
  const files = query.data?.pages.flatMap(page => page.files) ?? [];
  const listed = files.find(f => f.path === file);
  // A file named in the address may be past the pages read so far; its own answer says how it changed.
  const named = useQuery({ ...commitFileOptions(session, commit, file ?? ''), enabled: !!query.data && !!file && !listed });
  if (query.error) return <Text type="supporting" color="secondary" role="alert">{t('source.listFailed')}</Text>;
  if (!query.data) return <RequestState placeholder={<InlineLoader label={t('source.listLoading')}/>}/>;
  if (!files.length) return <Text color="secondary">{t('source.none')}</Text>;
  const chosen: CommitFile | undefined = listed ?? (file ? named.data?.file : files[0]);
  return <SplitReader label={t('source.title')}
    summary={<Text type="supporting" color="secondary">{t('source.count', { count: query.data.pages[0]!.total })}</Text>}
    footer={<LoadMore label={t('source.more')} query={query}/>}
    items={files.map(f => { const { name, folder } = split(f.path);
      return { key: f.path, label: name, description: f.previousPath ? `${f.previousPath} →` : folder || undefined, href: href(f.path), selected: f === chosen,
        start: <Token label={letters[f.status]} color={colors[f.status]} size="sm"/>,
        end: <HStack gap={1}>
          {f.additions !== null && <Text type="supporting" className={styles.sourceAdded}>+{f.additions}</Text>}
          {f.deletions !== null && <Text type="supporting" className={styles.sourceRemoved}>−{f.deletions}</Text>}
        </HStack> }; })}>
    {chosen ? <>
      <HStack gap={2} className={styles.sourceRow}>
        <Token label={names()[chosen.status]} color={colors[chosen.status]} size="sm"/>
        <Text className={styles.sourcePath}>{chosen.previousPath ? `${chosen.previousPath} → ${chosen.path}` : chosen.path}</Text>
      </HStack>
      <FileDiff key={chosen.path} session={session} commit={commit} file={chosen}/>
    </> : named.error ? <Text type="supporting" color="secondary" role="alert">{t('source.fileFailed')}</Text>
      : <RequestState placeholder={<InlineLoader label={t('source.fileLoading')}/>}/>}
  </SplitReader>;
}
