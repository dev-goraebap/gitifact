import type { MouseEvent } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useWorkingChanges } from '../../../entities/project';
import { HgiHistory } from '../../../shared/ui/icons/HgiHistory';
import { HgiRequirement } from '../../../shared/ui/icons/HgiRequirement';
import { HgiMembers } from '../../../shared/ui/icons/HgiMembers';
import { HgiGit } from '../../../shared/ui/icons/HgiGit';
import { HgiProduct } from '../../../shared/ui/icons/HgiProduct';
import { HgiBook } from '../../../shared/ui/icons/HgiBook';
import { HgiInfo } from '../../../shared/ui/icons/HgiInfo';
import styles from './app-shell.module.css';
const destinations = [
  ['/product', '제품 개요', HgiProduct],
  ['/features', '요구사항', HgiRequirement],
  ['/guides', '지침', HgiBook],
  ['/', '활동', HgiHistory],
  ['/contributors', '참여자', HgiMembers],
  ['/git', 'Git 상태', HgiGit],
] as const;
const plainClick = (event: MouseEvent) => !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;
export function BrowserShell() {
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
          header={<Link to="/" className="gitifact-wordmark" aria-label="GITIFACT 홈" />}
          footer={
            <VStack padding={4} gap={2}>
              <Text type="supporting">로컬 프로젝트 · 읽기 전용</Text>
              <Text type="supporting" color="secondary">
                변경할 내용은 에이전트와 이야기하세요.
              </Text>
            </VStack>
          }
        >
          <SideNavSection title="WORKSPACE">
            {destinations.map(([to, label, MenuIcon]) => (
              <SideNavItem
                key={to}
                label={label}
                icon={<MenuIcon/>}
                href={to}
                isSelected={to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/')}
                // The uncommitted-spec indicator lives on the Git menu; the Git page carries the explanation.
                endContent={to === '/git' && working ? <StatusDot variant="warning" label="미커밋 명세 변경 있음" tooltip="미커밋 명세 변경 있음 · Git 상태에서 확인"/> : undefined}
                onClick={go(to)}
              />
            ))}
          </SideNavSection>
          <SideNavSection title="GITIFACT">
            <SideNavItem label="소개" icon={<HgiInfo/>} href="/about" isSelected={pathname === '/about'} onClick={go('/about')}/>
          </SideNavSection>
        </SideNav>
      }
    >
      <VStack gap={0} className={styles.frame}>
        <VStack gap={0} className={styles.card}>
          <Outlet />
        </VStack>
      </VStack>
    </AppShell>
  );
}
