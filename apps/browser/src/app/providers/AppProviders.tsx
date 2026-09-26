import { useEffect, type ReactNode } from 'react';
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
import { createRouter, RouterProvider, useRouterState } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';
import { queryClient } from './query-client';
import { PageLoader, useLoadingHold } from '../../shared/ui/request-state';

/** The first visit has no screen to keep in view while the first one's reads are primed, so the rocket stands alone. */
function FirstVisit({ children }: { children: ReactNode }) {
  const waiting = useRouterState({ select: s => !s.resolvedLocation });
  const showing = useLoadingHold(waiting, { delay: 100, minimum: 300 });
  return <>{children}<PageLoader isVisible={showing} place="window"/></>;
}

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  // The content card scrolls, not the window: a new screen starts it at the top (or at the #section it names), and
  // going back restores where the reader was. The card carries the matching data-scroll-restoration-id.
  scrollToTopSelectors: ['[data-scroll-restoration-id="content"]'],
  // No pending component: a move keeps the previous screen until the next one's loader has primed what it draws (the
  // shell veils it meanwhile), so a screen is only ever shown whole.
  InnerWrap: FirstVisit,
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
