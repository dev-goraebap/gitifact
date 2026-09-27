import { Link } from '@tanstack/react-router';
import { PageState } from '../../../shared/ui/page-state';
import { t, useLanguage } from '../../../shared/i18n';

/** A commit the address names that HEAD's history lacks, or a hash's start that names none or several. */
export function CommitNotFound({ commit }: { commit: string }) {
  useLanguage();
  return <PageState kind="not-found" title={t('commit.notFoundTitle')} description={t('commit.notFoundDescription', { commit })}
    actions={<Link to="/records">{t('commit.backToList')}</Link>}/>;
}
