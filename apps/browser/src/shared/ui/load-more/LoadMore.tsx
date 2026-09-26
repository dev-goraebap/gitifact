import { Button } from '@astryxdesign/core/Button';
import { t, useLanguage } from '../../i18n';

/** The next page of a list read a page at a time; nothing when the list is whole. */
export function LoadMore({ label, query }: { label: string; query: { hasNextPage: boolean; isFetchingNextPage: boolean; isFetchNextPageError: boolean; isFetching: boolean; fetchNextPage: () => unknown } }) {
  useLanguage();
  if (!query.hasNextPage) return null;
  return <Button isDisabled={query.isFetching} onClick={() => { void query.fetchNextPage(); }}
    label={query.isFetchingNextPage ? t('history.loadingMore') : query.isFetchNextPageError ? t('history.retryMore') : label}/>;
}
