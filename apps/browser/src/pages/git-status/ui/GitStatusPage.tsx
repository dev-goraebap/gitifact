import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionOptions } from '../../../entities/project';
import { RepositoryPanel } from './RepositoryPanel';
import { PageHeader } from '../../../widgets/page-header';
import { Heading } from '@astryxdesign/core/Heading';
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
  return (
    <VStack gap={0}>
      <PageHeader page="Git 상태" />
      <VStack padding={6} gap={5}>
      <Heading level={1}>Git 상태</Heading>
      <Text color="secondary">현재 checkout에서 관측한 변경 파일입니다.</Text>
      {session.isPending && <Text role="status">로컬 서버에 연결하고 있습니다.</Text>}
      {session.error && (
        <VStack role="alert" gap={3}>
          <Text>{session.error.message}</Text>
          <Button
            label="다시 연결"
            isDisabled={session.isFetching}
            onClick={() => {
              void reconnect();
            }}
          />
        </VStack>
      )}
      {session.data && !session.error && (
        <RepositoryPanel
          key={session.data.sessionId + ':' + connection}
          session={session.data}
          reconnect={() => {
            void reconnect();
          }}
        />
      )}
      </VStack>
    </VStack>
  );
}
