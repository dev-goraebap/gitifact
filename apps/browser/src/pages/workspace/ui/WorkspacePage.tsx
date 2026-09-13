import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { sessionOptions } from '../../../entities/project';
import type { WorkspaceSearch } from '../model/search';
import { ProjectPanel } from './ProjectPanel';
export type WorkspaceProps = {
  view: 'overview' | 'requirements' | 'decisions';
  search: WorkspaceSearch;
  onSearch: (next: WorkspaceSearch, replace?: boolean) => void;
};
export function WorkspacePage(props: WorkspaceProps) {
  const session = useQuery(sessionOptions());
  const client = useQueryClient();
  const [connection, setConnection] = useState(0);
  const reconnect = async () => {
    await client.cancelQueries({ queryKey: ['browser-project'] });
    client.removeQueries({ queryKey: ['browser-project'] });
    await session.refetch();
    setConnection((value) => value + 1);
  };
  if (session.error)
    return (
      <VStack padding={6} gap={4} role="alert">
        <Text>{session.error.message}</Text>
        <Button
          label="다시 연결"
          isDisabled={session.isFetching}
          onClick={() => {
            void reconnect();
          }}
        />
      </VStack>
    );
  if (!session.data)
    return (
      <VStack padding={6} role="status">
        <Text>로컬 서버에 연결하고 있습니다.</Text>
      </VStack>
    );
  return (
    <ProjectPanel
      key={session.data.sessionId + ':' + connection}
      session={session.data}
      reconnect={() => {
        void reconnect();
      }}
      {...props}
    />
  );
}
