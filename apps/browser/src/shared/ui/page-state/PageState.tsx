import { EmptyState, type EmptyStateProps } from '@astryxdesign/core/EmptyState';
import { StateIllustration, type StateKind } from './StateIllustration';
export function PageState({ kind = 'empty', style, ...props }: Omit<EmptyStateProps, 'icon'> & { kind?: StateKind }) {
  return <EmptyState {...props} icon={<StateIllustration kind={kind} compact={props.isCompact ?? false} />}
    style={{ width: '100%', minHeight: props.isCompact ? undefined : 'min(30rem, 65vh)', ...style }} />;
}
