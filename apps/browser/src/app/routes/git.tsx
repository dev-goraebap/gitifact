import { createFileRoute } from '@tanstack/react-router';
import { GitStatusPage, loadGitStatus } from '../../pages/git-status';
export const Route = createFileRoute('/git')({ loader: ({ context }) => loadGitStatus(context.queryClient), component: GitStatusPage });
