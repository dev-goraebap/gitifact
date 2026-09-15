import { useQuery } from '@tanstack/react-query';
import { Text } from '@astryxdesign/core/Text';
import type { BrowserSessionV1 } from '@tryce/contracts';
import { sessionOptions, statusOptions } from '../api/repository';
/** Last folder of the observed checkout path; a generic label until the status query resolves. */
export function ProjectName() {
  const session = useQuery(sessionOptions());
  return session.data ? <ResolvedName session={session.data} /> : <Text type="supporting" color="secondary">로컬 프로젝트</Text>;
}
function ResolvedName({ session }: { session: BrowserSessionV1 }) {
  const status = useQuery(statusOptions(session));
  const root = status.data?.repository.rootPath;
  return <Text type="supporting" color="secondary">{root?.split(/[\/]/).filter(Boolean).at(-1) ?? '로컬 프로젝트'}</Text>;
}
