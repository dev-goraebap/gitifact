import { AppShell } from '@astryxdesign/core/AppShell';
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { HgiHistory } from '../../../shared/ui/icons/HgiHistory';
import { HgiRequirement } from '../../../shared/ui/icons/HgiRequirement';
import { HgiMembers } from '../../../shared/ui/icons/HgiMembers';
import { HgiGit } from '../../../shared/ui/icons/HgiGit';
import { HgiInfo } from '../../../shared/ui/icons/HgiInfo';
import styles from './app-shell.module.css';
const destinations = [
  ['/', '활동', HgiHistory],
  ['/features', '제품 기능', HgiRequirement],
  ['/contributors', '기여자', HgiMembers],
  ['/git', 'Git 상태', HgiGit],
] as const;
export function BrowserShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
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
                isSelected={pathname === to}
                onClick={(event) => {
                  if (
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey &&
                    event.button === 0
                  ) {
                    event.preventDefault();
                    void navigate({ to });
                  }
                }}
              />
            ))}
          </SideNavSection>
          <SideNavSection title="GITIFACT">
            <SideNavItem
              label="소개"
              icon={<HgiInfo/>}
              href="/about"
              isSelected={pathname === '/about'}
              onClick={(event) => {
                if (
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey &&
                  event.button === 0
                ) {
                  event.preventDefault();
                  void navigate({ to: '/about' });
                }
              }}
            />
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
