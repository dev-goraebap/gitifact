import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext } from '@tanstack/react-router';
import { BrowserShell } from '../../widgets/app-shell';
import { NotFoundPage } from '../../pages/not-found';
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: BrowserShell,
  notFoundComponent: NotFoundPage,
});
