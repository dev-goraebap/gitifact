import { useRef, type MouseEvent } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Button } from '@astryxdesign/core/Button';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useWorkingChanges } from '../../../entities/project';
import { HgiHistory } from '../../../shared/ui/icons/HgiHistory';
import { HgiRequirement } from '../../../shared/ui/icons/HgiRequirement';
import { HgiMembers } from '../../../shared/ui/icons/HgiMembers';
import { HgiGit } from '../../../shared/ui/icons/HgiGit';
import { HgiGithub } from '../../../shared/ui/icons/HgiGithub';
import { HgiDashboard } from '../../../shared/ui/icons/HgiDashboard';
import { HgiInstruction } from '../../../shared/ui/icons/HgiInstruction';
import { HgiRocket } from '../../../shared/ui/icons/HgiRocket';
import { HgiInfo } from '../../../shared/ui/icons/HgiInfo';
import { HgiSettings } from '../../../shared/ui/icons/HgiSettings';
import { VersionFooter } from './VersionFooter';
import { useSmoothWheel } from '../../../shared/lib/smooth-scroll';
import { SearchPalette } from '../../../features/search-palette';
import { PageLoader, PageLoadingProvider, usePageLoadingFrame } from '../../../shared/ui/request-state';
import styles from './app-shell.module.css';
import { t, useLanguage } from '../../../shared/i18n';
const destinations = () => ([
  ['/dashboard', t('nav.product'), HgiDashboard],
  ['/features', t('nav.features'), HgiRequirement],
  ['/instructions', t('nav.instructions'), HgiInstruction],
  ['/records', t('nav.history'), HgiHistory],
  ['/contributors', t('nav.contributors'), HgiMembers],
  ['/git', t('nav.git'), HgiGit],
  ['/settings', t('nav.settings'), HgiSettings],
] as const);
const plainClick = (event: MouseEvent) => !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;
export function BrowserShell() {
  useLanguage();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const working = useWorkingChanges();
  // The card is what scrolls; the wheel glides over it.
  const card = useRef<HTMLDivElement>(null);
  useSmoothWheel(card);
  // One loader for the whole screen: it stays hidden until every read it needs to be drawn has answered. The screen is
  // the route drawn, not the address: while the next screen's code loads the previous one is still the one on view.
  const drawn = useRouterState({ select: (s) => s.matches.at(-1)?.pathname ?? s.location.pathname });
  const loading = usePageLoadingFrame(drawn);
  const go = (to: string) => (event: MouseEvent) => { if (plainClick(event)) { event.preventDefault(); void navigate({ to }); } };
  return (
    <AppShell
      height="fill"
      contentPadding={0}
      variant="wash"
      mobileNav={{ breakpoint: 'lg' }}
      sideNav={
        <SideNav
          resizable={{ defaultWidth: 240, minWidth: 200, maxWidth: 400, autoSaveId: 'gitifact-sidenav' }}
          header={<Link to="/dashboard" className="gitifact-wordmark" aria-label={t('shell.home')} />}
          footer={<HStack gap={1} hAlign="between" vAlign="center">
            <VersionFooter />
            <Button label="GitHub" icon={<HgiGithub/>} variant="ghost" size="sm"
              href="https://github.com/dev-goraebap/gitifact" target="_blank" rel="noopener noreferrer"
              tooltip={t('shell.githubTooltip')} />
          </HStack>}
        >
          <SideNavSection title="WORKSPACE">
            {destinations().map(([to, label, MenuIcon]) => (
              <SideNavItem
                key={to}
                label={label}
                icon={<MenuIcon/>}
                href={to}
                isSelected={pathname === to || pathname.startsWith(to + '/')}
                // The uncommitted-spec indicator lives on the Git menu; the Git page carries the explanation.
                endContent={to === '/git' && working ? <StatusDot variant="warning" label={t('shell.workingChanges')} tooltip={t('shell.workingChangesTooltip')}/> : undefined}
                onClick={go(to)}
              />
            ))}
          </SideNavSection>
          <SideNavSection title="GITIFACT">
            <SideNavItem label={t('nav.about')} icon={<HgiInfo/>} href="/about" isSelected={pathname === '/about'} onClick={go('/about')}/>
            <SideNavItem label={t('nav.gettingStarted')} icon={<HgiRocket/>} href="/getting-started" isSelected={pathname === '/getting-started'} onClick={go('/getting-started')}/>
            <SideNavItem label={t('nav.changelog')} icon={<HgiHistory/>} href="/changelog" isSelected={pathname === '/changelog'} onClick={go('/changelog')}/>
          </SideNavSection>
        </SideNav>
      }
    >
      <PageLoadingProvider frame={loading}>
        <VStack gap={0} className={styles.frame}>
          <VStack gap={0} ref={card} className={[styles.card, loading.isHidden && styles.cardWaiting, loading.isRevealing && styles.cardRevealing].filter(Boolean).join(' ')} data-scroll-restoration-id="content" aria-busy={loading.isHidden}>
            <Outlet />
          </VStack>
          <PageLoader isVisible={loading.isShowing}/>
          <SearchPalette/>
        </VStack>
      </PageLoadingProvider>
    </AppShell>
  );
}
