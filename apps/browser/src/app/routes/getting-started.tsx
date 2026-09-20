import { createFileRoute } from '@tanstack/react-router';
import { GettingStartedPage } from '../../pages/getting-started';

export const Route = createFileRoute('/getting-started')({ component: GettingStartedPage });
