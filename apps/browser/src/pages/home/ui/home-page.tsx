import { Button } from '@astryxdesign/core/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { sessionOptions } from '../api/repository';
import { RepositoryPanel } from './repository-panel';

export function HomePage({ onAbout }: { onAbout: () => void }) {
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
    <section>
      <h1>프로젝트의 기록을 이어갑니다</h1>
      <p>요구사항과 결정, 구현 이력을 살펴볼 공간입니다.</p>
      <Button label="tryce 소개" variant="primary" onClick={onAbout} />
      {session.isPending && <p role="status">로컬 서버에 연결하고 있습니다.</p>}
      {session.error && <div role="alert">
        <p>{session.error.message}</p>
        <Button label="다시 연결" isDisabled={session.isFetching} onClick={() => { void reconnect(); }} />
      </div>}
      {session.data && !session.error && <RepositoryPanel key={session.data.sessionId + ':' + connection} session={session.data}
        reconnect={() => { void reconnect(); }} />}
    </section>
  );
}
