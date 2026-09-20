import { useEffect } from 'react';
import { useLanguage } from '../../shared/i18n';
import { LayerProvider } from '@astryxdesign/core/Layer';
import { LinkProvider } from '@astryxdesign/core/Link';
import { RouterLink } from '../../shared/ui/router-link/RouterLink';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.json';
import { Theme } from '@astryxdesign/core/theme';
import { SyntaxTheme } from '@astryxdesign/core/theme/syntax';
import { documentSyntax } from '../../shared/ui/document';
import { themes } from './themes';
import { useAppearance } from '../../shared/lib/appearance';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';
import { queryClient } from './query-client';
import { RequestState } from '../../shared/ui/request-state';

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultPendingComponent: RequestState,
  defaultPendingMs: 200,
  defaultPendingMinMs: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppProviders() {
  const { mode, palette } = useAppearance();
  const language = useLanguage();
  useEffect(() => {
    // Retry displayed errors in the new language without discarding cached project data.
    void queryClient.invalidateQueries({ predicate: query => query.state.status === 'error' });
  }, [language]);
  return (
    <Theme theme={themes[palette]} mode={mode}>
      <SyntaxTheme theme={documentSyntax}>
      <InternationalizationProvider locale={language === 'ko' ? 'ko-KR' : 'en-US'} messages={{ 'ko-KR': koKR }}>
        <LayerProvider>
          <LinkProvider component={RouterLink}>
            <QueryClientProvider client={queryClient}>
              <RouterProvider router={router} />
            </QueryClientProvider>
          </LinkProvider>
        </LayerProvider>
      </InternationalizationProvider>
      </SyntaxTheme>
    </Theme>
  );
}
