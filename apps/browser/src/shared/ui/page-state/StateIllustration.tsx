import empty from './assets/empty.svg';
import search from './assets/search.svg';
import missing from './assets/not-found.svg';
import error from './assets/error.svg';
export type StateKind = 'empty' | 'search' | 'not-found' | 'error';
const images = { empty, search, 'not-found': missing, error };
export function StateIllustration({ kind, compact = false }: { kind: StateKind; compact?: boolean }) {
  return <img src={images[kind]} alt="" aria-hidden="true" width={320} height={220}
    style={{ display: 'block', width: compact ? '10rem' : 'min(18rem, 60vw)', maxWidth: '100%', height: 'auto' }} />;
}
