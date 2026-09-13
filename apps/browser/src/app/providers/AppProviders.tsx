import { LayerProvider } from '@astryxdesign/core/Layer';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.json';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppProviders() {
  return (
    <Theme theme={neutralTheme}>
      <InternationalizationProvider locale="ko-KR" messages={{ 'ko-KR': koKR }}>
        <LayerProvider>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </LayerProvider>
      </InternationalizationProvider>
    </Theme>
  );
}
