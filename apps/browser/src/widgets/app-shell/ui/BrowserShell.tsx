import type { MouseEvent } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { VStack } from '@astryxdesign/core/VStack';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useWorkingChanges } from '../../../entities/project';
import { HgiHistory } from '../../../shared/ui/icons/HgiHistory';
import { HgiRequirement } from '../../../shared/ui/icons/HgiRequirement';
import { HgiMembers } from '../../../shared/ui/icons/HgiMembers';
import { HgiGit } from '../../../shared/ui/icons/HgiGit';
import { HgiProduct } from '../../../shared/ui/icons/HgiProduct';
import { HgiBook } from '../../../shared/ui/icons/HgiBook';
import { HgiRocket } from '../../../shared/ui/icons/HgiRocket';
import { HgiInfo } from '../../../shared/ui/icons/HgiInfo';
import { HgiSettings } from '../../../shared/ui/icons/HgiSettings';
import { VersionFooter } from './VersionFooter';
import { SearchPalette } from '../../search-palette';
import styles from './app-shell.module.css';
import { t, useLanguage } from '../../../shared/i18n';
const destinations = () => ([
  ['/product', t('nav.product'), HgiProduct],
  ['/features', t('nav.features'), HgiRequirement],
  ['/wiki', t('nav.wiki'), HgiBook],
  ['/activity', t('nav.history'), HgiHistory],
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
          header={<Link to="/product" className="gitifact-wordmark" aria-label={t('shell.home')} />}
          footer={<VersionFooter />}
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
      <VStack gap={0} className={styles.frame}>
        <VStack gap={0} className={styles.card}>
          <Outlet />
        </VStack>
        <SearchPalette/>
      </VStack>
    </AppShell>
  );
}
