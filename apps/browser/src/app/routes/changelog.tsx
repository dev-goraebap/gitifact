import { createFileRoute } from '@tanstack/react-router';
import { ChangelogPage, loadChangelog } from '../../pages/changelog';

export const Route = createFileRoute('/changelog')({ loader: ({ context }) => loadChangelog(context.queryClient), component: ChangelogPage });
