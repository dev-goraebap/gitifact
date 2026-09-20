import { useQuery } from '@tanstack/react-query';
import { Text } from '@astryxdesign/core/Text';
import type { BrowserSessionV2 } from '@gitifact/contracts';
import { sessionOptions, statusOptions } from '../api/repository';
import { t, useLanguage } from '../../../shared/i18n';
/** Last folder of the observed checkout path; a generic label until the status query resolves. */
export function ProjectName() {
  useLanguage();
  const session = useQuery(sessionOptions());
  return session.data ? <ResolvedName session={session.data} /> : <Text type="supporting" color="secondary">{t('project.local')}</Text>;
}
function ResolvedName({ session }: { session: BrowserSessionV2 }) {
  useLanguage();
  const status = useQuery(statusOptions(session));
  const root = status.data?.repository.rootPath;
  return <Text type="supporting" color="secondary">{root?.split(/[\/]/).filter(Boolean).at(-1) ?? t('project.local')}</Text>;
}
