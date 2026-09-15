import { useState } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionOptions } from '../../../entities/project';
import { RepositoryPanel } from './RepositoryPanel';
import { PageHeader } from '../../../widgets/page-header';
import { RequestState } from '../../../shared/ui/request-state';
import styles from './git-status.module.css';

export function GitStatusPage() {
  const session = useQuery(sessionOptions());
  const client = useQueryClient();
  const [connection, setConnection] = useState(0);
  const reconnect = async () => {
    await client.cancelQueries({ queryKey: ['repository-status'] });
    client.removeQueries({ queryKey: ['repository-status'] });
    await session.refetch();
    setConnection((value) => value + 1);
  };
  if (session.data && !session.error)
    return <RepositoryPanel key={session.data.sessionId + ':' + connection} session={session.data} reconnect={() => { void reconnect(); }} />;
  return (
    <VStack gap={0} className={styles.page}>
      <PageHeader trail={[{ label: 'Git 상태' }]} />
      <VStack gap={0} className={styles.column}>
        <VStack gap={1} className={styles.pageTitle}><Heading level={1}>Git 상태</Heading></VStack>
        {session.isPending && <VStack padding={5}><Text role="status" type="supporting" color="secondary">로컬 서버에 연결하고 있습니다.</Text></VStack>}
        {session.error && <RequestState error={session.error} retry={() => { void reconnect(); }} />}
      </VStack>
    </VStack>
  );
}
