import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BrowserSessionV3 } from '@gitifact/contracts';
import { stampOptions } from '../../../entities/project';

/**
 * Whether the screen is behind the project: when the reader comes back to the tab, the server works out a stamp of
 * HEAD and the uncommitted documents, and a stamp other than the one the checkout was read at means something changed
 * since. Nothing is read again until the reader asks; a failed question leaves the screen as it is.
 */
export function useBehind(session: BrowserSessionV3, stamp: string | undefined, readAt: number): boolean {
  const client = useQueryClient();
  const [latest, setLatest] = useState<string | undefined>(undefined);
  // A checkout read again is as new as it gets; the next question starts from it.
  useEffect(() => { setLatest(undefined); }, [readAt]);
  useEffect(() => {
    if (stamp === undefined) return;
    let cancelled = false;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      client.fetchQuery(stampOptions(session)).then(answer => { if (!cancelled) setLatest(answer.stamp); }, () => undefined);
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); };
  }, [client, session, stamp]);
  return stamp !== undefined && latest !== undefined && latest !== stamp;
}
