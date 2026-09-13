import { createFileRoute } from '@tanstack/react-router';
import { GitStatusPage } from '../../pages/git-status';
export const Route = createFileRoute('/git')({ component: GitStatusPage });
